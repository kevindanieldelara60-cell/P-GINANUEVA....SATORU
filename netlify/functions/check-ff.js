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

  // Función que abre pagostore, ingresa el UID, y chequea UN item
  const checkItem = async (item) => {
    const code = `
      export default async ({ page }) => {
        await page.setUserAgent("Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36");

        // Abrimos la página con el item específico
        await page.goto("https://pagostore.garena.com/?item=${item.itemId}", {
          waitUntil: "networkidle2",
          timeout: 25000,
        });
        await new Promise(r => setTimeout(r, 2000));

        // Ingresamos el UID en el campo de texto
        const input = await page.$('input[placeholder*="ID"], input[placeholder*="jugador"], input[type="text"], input[type="number"]');
        if (input) {
          await input.click({ clickCount: 3 });
          await input.type("${uid}", { delay: 80 });
          await new Promise(r => setTimeout(r, 500));

          // Clickeamos "Iniciar Sesión"
          const btn = await page.$('button[type="submit"], .login-btn, button.btn-login');
          if (btn) {
            await btn.click();
          } else {
            // Buscamos el botón por texto
            const buttons = await page.$$("button");
            for (const b of buttons) {
              const txt = await page.evaluate(el => el.innerText, b);
              if (txt && (txt.includes("Iniciar") || txt.includes("Sesión") || txt.includes("Login"))) {
                await b.click();
                break;
              }
            }
          }

          // Esperamos que cargue la cuenta y los métodos de pago
          await new Promise(r => setTimeout(r, 4000));
        }

        // Ahora detectamos si hay precio tachado (= descuento activo)
        const result = await page.evaluate(() => {
          // Buscamos cualquier elemento con text-decoration line-through que tenga "DOP"
          const all = Array.from(document.querySelectorAll("*"));
          for (const el of all) {
            const text = (el.innerText || "").trim();
            if (!text.includes("DOP")) continue;
            const style = window.getComputedStyle(el);
            if (
              style.textDecoration.includes("line-through") ||
              style.textDecorationLine === "line-through"
            ) return true;
          }
          // Buscar <s> o <del> con DOP
          for (const el of document.querySelectorAll("s, del")) {
            if ((el.innerText || "").includes("DOP")) return true;
          }
          // Buscar en HTML crudo
          const html = document.body.innerHTML;
          return html.includes("line-through") && html.includes("DOP");
        });

        // Intentamos sacar el nick también
        const nick = await page.evaluate(() => {
          const text = document.body.innerText;
          const match = text.match(/Nombre de usuario[:\\s]+([^\\n\\r]+)/i);
          if (match) return match[1].trim();
          return null;
        });

        return { data: { hasDiscount: result, nick }, type: "application/json" };
      };
    `;

    try {
      const res = await fetch(
        `https://production-sfo.browserless.io/function?token=${process.env.BROWSERLESS_KEY}`,
        { method: "POST", headers: { "Content-Type": "application/javascript" }, body: code }
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
    // Corremos todos los items en paralelo
    const itemResults = await Promise.all(ITEMS.map(item => checkItem(item)));

    const discounts = {};
    let nick = null;
    itemResults.forEach(r => {
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
