exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  const uid = event.queryStringParameters?.uid;
  if (!uid || !/^\d{5,15}$/.test(uid)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "UID inválido" }),
    };
  }

  const ITEMS = [
    { key: "110",  itemId: "49518" },
    { key: "341",  itemId: "49519" },
    { key: "572",  itemId: "49520" },
    { key: "1166", itemId: "49521" },
    { key: "2398", itemId: "49522" },
    { key: "6160", itemId: "49523" },
  ];

  // Código Puppeteer que se ejecuta en Browserless
  // Recibe uid e itemId via context — sin interpolación, sin errores de escape
  const puppeteerCode = `
    export default async ({ page, context }) => {
      const { uid, itemId } = context;

      await page.setUserAgent(
        "Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36"
      );

      // Abrimos la página del item
      await page.goto("https://pagostore.garena.com/?item=" + itemId, {
        waitUntil: "networkidle2",
        timeout: 25000,
      });
      await new Promise(r => setTimeout(r, 1500));

      // Buscamos el input del UID y lo llenamos
      let inputFilled = false;
      try {
        // Esperamos que aparezca el input
        await page.waitForSelector("input", { timeout: 5000 });
        const inputs = await page.$$("input");
        for (const input of inputs) {
          const type = await page.evaluate(el => el.type, input);
          const ph   = await page.evaluate(el => el.placeholder || "", input);
          if (type === "hidden") continue;
          // Limpiamos y escribimos el UID
          await input.click({ clickCount: 3 });
          await page.keyboard.press("Backspace");
          await input.type(uid, { delay: 50 });
          inputFilled = true;
          break;
        }
      } catch(e) {}

      if (inputFilled) {
        // Buscamos y clickeamos el botón "Iniciar Sesión"
        try {
          const buttons = await page.$$("button");
          for (const btn of buttons) {
            const txt = await page.evaluate(el => el.innerText || "", btn);
            if (txt.includes("Iniciar") || txt.includes("Login") || txt.includes("Sesión")) {
              await btn.click();
              break;
            }
          }
        } catch(e) {}

        // Esperamos que cargue la cuenta y los precios
        await new Promise(r => setTimeout(r, 4000));
      }

      // Extraemos nick y detectamos descuento
      const result = await page.evaluate(() => {
        // Nick
        let nick = null;
        const bodyText = document.body.innerText || "";
        const nickMatch = bodyText.match(/Nombre de usuario[:\\s]+([^\\n\\r]+)/i);
        if (nickMatch) nick = nickMatch[1].trim();

        // Detección de descuento:
        // Cuando hay descuento aparece el precio tachado con line-through
        // Buscamos en el HTML completo
        const html = document.body.innerHTML;

        // Método 1: buscar "line-through" en el HTML
        const hasLineThrough = html.includes("line-through");

        // Método 2: buscar elementos con text-decoration computado
        let hasStrikethrough = false;
        const allEls = document.querySelectorAll("*");
        for (const el of allEls) {
          if (!(el.innerText || "").includes("DOP")) continue;
          const cs = window.getComputedStyle(el);
          const td = cs.getPropertyValue("text-decoration");
          const tdl = cs.getPropertyValue("text-decoration-line");
          if (td.includes("line-through") || tdl.includes("line-through")) {
            hasStrikethrough = true;
            break;
          }
        }

        // Método 3: elementos <s> o <del> con precio
        let hasStrikeEl = false;
        for (const el of document.querySelectorAll("s, del")) {
          if ((el.innerText || "").includes("DOP")) {
            hasStrikeEl = true;
            break;
          }
        }

        // Método 4: buscar clase que contenga "origin" o "old" o "cross" junto a DOP
        let hasDiscountClass = false;
        const dopEls = Array.from(allEls).filter(el =>
          (el.innerText || "").trim().startsWith("DOP")
        );
        for (const el of dopEls) {
          const cls = el.className || "";
          if (cls.match(/origin|old|cross|strike|through|promo|discount/i)) {
            hasDiscountClass = true;
            break;
          }
          // También el padre
          if (el.parentElement) {
            const pcls = el.parentElement.className || "";
            if (pcls.match(/origin|old|cross|strike|through|promo|discount/i)) {
              hasDiscountClass = true;
              break;
            }
          }
        }

        const hasDiscount = hasLineThrough || hasStrikethrough || hasStrikeEl || hasDiscountClass;

        return { nick, hasDiscount };
      });

      return {
        data: result,
        type: "application/json",
      };
    };
  `;

  // Ejecutamos todos los items en paralelo
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

  try {
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
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
