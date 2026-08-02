exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  const uid = event.queryStringParameters?.uid;
  if (!uid || !/^\d{5,15}$/.test(uid)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "UID inválido" }) };
  }

  const ITEMS = [
    { key: "110",  itemId: "49518" },
    { key: "341",  itemId: "49519" },
    { key: "572",  itemId: "49520" },
    { key: "1166", itemId: "49521" },
    { key: "2398", itemId: "49522" },
    { key: "6160", itemId: "49523" },
  ];

  const puppeteerCode = `
    export default async ({ page, context }) => {
      const { uid, itemId } = context;

      await page.goto("https://pagostore.garena.com/?item=" + itemId, {
        waitUntil: "networkidle2",
        timeout: 25000,
      });
      await new Promise(r => setTimeout(r, 2000));

      // Truco para React: simular escritura real tecla por tecla
      const input = await page.$("input.form-input");
      if (input) {
        await input.click({ clickCount: 3 });
        await input.press("Backspace");
        
        // Escribimos el UID caracter por caracter como si fuera un humano
        for (const char of uid) {
          await input.press(char);
          await new Promise(r => setTimeout(r, 80));
        }
        
        await new Promise(r => setTimeout(r, 800));

        // Clickeamos Iniciar Sesión
        const loginBtn = await page.evaluateHandle(() => {
          return Array.from(document.querySelectorAll("button"))
            .find(b => b.innerText.trim() === "Iniciar Sesión");
        });
        
        if (loginBtn) {
          await loginBtn.asElement()?.click();
        }

        // Esperamos que cargue la cuenta
        await new Promise(r => setTimeout(r, 6000));
      }

      // Tomamos screenshot para debug y detectamos descuento
      const result = await page.evaluate(() => {
        const html = document.body.innerHTML;
        const text = document.body.innerText;
        
        // Detectamos descuento
        const hasDiscount = html.includes("line-through");
        
        // Nick — buscamos después de "Nombre de usuario"
        let nick = null;
        const match = text.match(/Nombre de usuario[^a-zA-Z0-9]*([\w\W]{2,40}?)(?:\\n|ID de jugador)/i);
        if (match) nick = match[1].trim();

        // También buscamos si el login funcionó
        const loggedIn = text.includes("ID de jugador") && !text.includes("Introduce el ID");

        return { hasDiscount, nick, loggedIn };
      });

      return {
        data: result,
        type: "application/json"
      };
    };
  `;

  const checkItem = async (item) => {
    try {
      const res = await fetch(
        `https://production-sfo.browserless.io/function?token=${process.env.BROWSERLESS_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: puppeteerCode,
            context: { uid, itemId: item.itemId },
          }),
        }
      );
      const data = await res.json();
      const inner = data?.data || {};
      return {
        key: item.key,
        hasDiscount: inner.hasDiscount === true,
        loggedIn: inner.loggedIn === true,
        nick: inner.nick || null,
      };
    } catch (e) {
      return { key: item.key, hasDiscount: false, loggedIn: false, nick: null };
    }
  };

  const results = await Promise.all(ITEMS.map(item => checkItem(item)));

  const discounts = {};
  let nick = null;
  let anyLoggedIn = false;
  results.forEach(r => {
    discounts[r.key] = r.hasDiscount;
    if (r.nick && !nick) nick = r.nick;
    if (r.loggedIn) anyLoggedIn = true;
  });

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ nick, discounts, debug_loggedIn: anyLoggedIn }),
  };
};
