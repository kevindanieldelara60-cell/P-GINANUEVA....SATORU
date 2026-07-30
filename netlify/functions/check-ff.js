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

  const checkItem = async (item) => {
    const code = `
      export default async ({ page }) => {
        await page.setUserAgent("Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36");
        await page.goto("https://pagostore.garena.com/?item=${item.itemId}&uid=${uid}", {
          waitUntil: "networkidle2",
          timeout: 20000,
        });
        await new Promise(r => setTimeout(r, 3000));

        const result = await page.evaluate(() => {
          // La señal más confiable: existe un elemento con text-decoration line-through
          // que contenga "DOP" — ese es el precio original tachado que aparece solo con descuento
          const all = Array.from(document.querySelectorAll("*"));
          for (const el of all) {
            const text = (el.innerText || "").trim();
            if (!text.includes("DOP")) continue;
            // Revisamos el estilo computado
            const style = window.getComputedStyle(el);
            if (style.textDecoration.includes("line-through")) return true;
            if (style.textDecorationLine === "line-through") return true;
            // También revisamos el HTML por si está inline
            if (el.style && el.style.textDecoration && el.style.textDecoration.includes("line-through")) return true;
          }
          // Fallback: buscar en el HTML crudo
          const html = document.body.innerHTML;
          if (html.includes("line-through") && html.includes("DOP")) return true;
          // Buscar elemento <s> o <del> con DOP
          const struck = document.querySelectorAll("s, del");
          for (const el of struck) {
            if ((el.innerText || "").includes("DOP")) return true;
          }
          return false;
        });

        return { data: result, type: "application/json" };
      };
    `;
    try {
      const res = await fetch(
        `https://production-sfo.browserless.io/function?token=${process.env.BROWSERLESS_KEY}`,
        { method: "POST", headers: { "Content-Type": "application/javascript" }, body: code }
      );
      const data = await res.json();
      return { key: item.key, hasDiscount: data === true || data?.data === true || data === "true" };
    } catch {
      return { key: item.key, hasDiscount: false };
    }
  };

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
          const selectors = [".username",".player-name","[class*='username']","[class*='nickname']","[class*='account']"];
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
        { method: "POST", headers: { "Content-Type": "application/javascript" }, body: code }
      );
      const data = await res.json();
      return data?.data || null;
    } catch {
      return null;
    }
  };

  try {
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
