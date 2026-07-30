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

  const code = `
    export default async ({ page }) => {
      const uid = "${uid}";
      const items = ${JSON.stringify(ITEMS)};
      const results = {};

      await page.setUserAgent("Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36");

      // Cargamos la primera página con el UID
      await page.goto("https://pagostore.garena.com/?item=49518&uid=" + uid, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });
      await new Promise(r => setTimeout(r, 2000));

      // Extraemos el nickname
      let nick = null;
      try {
        nick = await page.evaluate(() => {
          const selectors = [
            ".username", ".player-name", ".account-name",
            "[class*='username']", "[class*='nickname']", "[class*='account']"
          ];
          for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el && el.innerText.trim()) return el.innerText.trim();
          }
          // Buscar texto que diga "Nombre de usuario:"
          const allText = document.body.innerText;
          const match = allText.match(/Nombre de usuario[:\\s]+([^\\n]+)/i);
          return match ? match[1].trim() : null;
        });
      } catch(e) {}

      // Verificamos descuento en cada item
      for (const item of items) {
        try {
          await page.goto("https://pagostore.garena.com/?item=" + item.itemId + "&uid=" + uid, {
            waitUntil: "networkidle2",
            timeout: 30000,
          });
          await new Promise(r => setTimeout(r, 3000));

          const hasDiscount = await page.evaluate(() => {
            // Buscamos precio en rojo (color rojo = descuento activo)
            const allElements = document.querySelectorAll("*");
            for (const el of allElements) {
              const style = window.getComputedStyle(el);
              const color = style.color;
              const text = el.innerText || "";
              // Rojo = rgb(255, ...) con valores bajos en G y B
              if (color.startsWith("rgb(") && text.includes("DOP")) {
                const parts = color.match(/rgb\\((\\d+),\\s*(\\d+),\\s*(\\d+)\\)/);
                if (parts) {
                  const r = parseInt(parts[1]);
                  const g = parseInt(parts[2]);
                  const b = parseInt(parts[3]);
                  if (r > 150 && g < 100 && b < 100) return true;
                }
              }
            }
            // También buscamos precio tachado
            return (
              !!document.querySelector("[style*='line-through']") ||
              !!document.querySelector(".original-price") ||
              !!document.querySelector(".old-price") ||
              !!document.querySelector("del") ||
              document.body.innerHTML.includes("line-through")
            );
          });

          results[item.key] = hasDiscount;
        } catch(e) {
          results[item.key] = false;
        }
      }

      return {
        data: { nick, discounts: results },
        type: "application/json",
      };
    };
  `;

  try {
    const response = await fetch(
      `https://production-sfo.browserless.io/function?token=${process.env.BROWSERLESS_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/javascript" },
        body: code,
      }
    );

    const data = await response.json();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
