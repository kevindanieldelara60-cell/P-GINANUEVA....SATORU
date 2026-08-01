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

      // Llenamos el input usando el placeholder exacto
      await page.evaluate((uid) => {
        const input = Array.from(document.querySelectorAll("input"))
          .find(el => el.placeholder && el.placeholder.includes("ID del jugador"));
        if (input) {
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
          nativeInputValueSetter.call(input, uid);
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }, uid);

      await new Promise(r => setTimeout(r, 500));

      // Clickeamos "Iniciar Sesión" usando el texto exacto
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll("button"))
          .find(el => el.innerText.trim() === "Iniciar Sesión");
        if (btn) btn.click();
      });

      // Esperamos que cargue la cuenta y los métodos de pago
      await new Promise(r => setTimeout(r, 5000));

      // Detectamos descuento y nick
      const result = await page.evaluate(() => {
        // Buscamos precio tachado con DOP
        let hasDiscount = false;

        // Método 1: text-decoration computado
        const allEls = Array.from(document.querySelectorAll("*"));
        for (const el of allEls) {
          const text = el.innerText || "";
          if (!text.includes("DOP")) continue;
          const style = window.getComputedStyle(el);
          if (
            style.textDecoration.includes("line-through") ||
            style.textDecorationLine.includes("line-through")
          ) {
            hasDiscount = true;
            break;
          }
        }

        // Método 2: HTML crudo
        if (!hasDiscount) {
          hasDiscount = document.body.innerHTML.includes("line-through");
        }

        // Nick
        let nick = null;
        const bodyText = document.body.innerText || "";
        const match = bodyText.match(/Nombre de usuario[:\\s]+([^\\n\\r]+)/i);
        if (match) nick = match[1].trim();

        // También buscamos el nick en el campo después del login
        if (!nick) {
          const accountEls = document.querySelectorAll(
            "[class*='account'], [class*='username'], [class*='nickname'], [class*='player']"
          );
          for (const el of accountEls) {
            const t = (el.innerText || "").trim();
            if (t && t.length > 1 && t.length < 50) {
              nick = t;
              break;
            }
          }
        }

        return { hasDiscount, nick };
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
        nick: inner.nick || null,
      };
    } catch {
      return { key: item.key, hasDiscount: false, nick: null };
    }
  };

  const results = await Promise.all(ITEMS.map(item => checkItem(item)));

  const discounts = {};
  let nick = null;
  results.forEach(r => {
    discounts[r.key] = r.hasDiscount;
    if (r.nick && !nick) nick = r.nick;
  });

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ nick, discounts }),
  };
};
