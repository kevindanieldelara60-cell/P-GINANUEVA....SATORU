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

  // Verificamos cada item en paralelo — una sesión de browser por item
  const checkItem = async (item) => {
    const code = `
      export default async ({ page }) => {
        await page.setUserAgent("Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36");
        await page.goto("https://pagostore.garena.com/?item=${item.itemId}&uid=${uid}", {
          waitUntil: "networkidle2",
          timeout: 20000,
        });
        await new Promise(r => setTimeout(r, 2500));

        const result = await page.evaluate(() => {
          // Buscamos precio en rojo = descuento activo
          const allElements = document.querySelectorAll("*");
          for (const el of allElements) {
            const style = window.getComputedStyle(el);
            const color = style.color;
            const text = el.innerText || "";
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
          return (
            !!document.querySelector("[style*='line-through']") ||
            !!document.querySelector(".original-price") ||
            !!document.querySelector(".old-price") ||
            !!document.querySelector("del") ||
            document.body.innerHTML.includes("line-through")
          );
        });

        return { data: result, type: "application/json" };
      };
    `;

    try {
      const res = await fetch(
        `https://production-sfo.browserless.io/function?token=${process.env.BROWSERLESS_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/javascript" },
          body: code,
        }
      );
      const data = await res.json();
      return { key: item.key, hasDiscount: data === true || data?.data === true || data === "true" };
    } catch {
      return { key: item.key, hasDiscount: false };
    }
  };

  // Obtenemos el nick en paralelo con el primer item
  const getNick = async () => {
    const code = `
      export default async ({ page }) => {
        await page.setUserAgent("Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36");
        await page.goto("https://pagostore.garena.com/?item=49518&uid=${uid}", {
          waitUntil: "networkidle2",
          timeout: 20000,
        });
        await new Promise(r => setTimeout(r, 2000));
        const nick = await page.evaluate(() => {
          const text = document.body.innerText;
          const match = text.match(/Nombre de usuario[:\\s]+([^\\n\\r]+)/i);
          if (match) return match[1].trim();
          const selectors = [".username",".player-name","[class*='username']","[class*='nickname']","[class*='account-name']"];
          for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el && el.innerText.trim()) return el.innerText.trim();
          }
          return null;
        });
        return { data: nick, type: "application/json" };
      };
    `;
    try {
      const res = await fetch(
        `https://production-sfo.browserless.io/function?token=${process.env.BROWSERLESS_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/javascript" },
          body: code,
        }
      );
      const data = await res.json();
      return data?.data || null;
    } catch {
      return null;
    }
  };

  try {
    // Lanzamos todo en paralelo
    const [nickResult, ...itemResults] = await Promise.all([
      getNick(),
      ...ITEMS.map(item => checkItem(item)),
    ]);

    const discounts = {};
    itemResults.forEach(r => { discounts[r.key] = r.hasDiscount; });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ nick: nickResult, discounts }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
