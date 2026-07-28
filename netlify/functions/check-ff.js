const puppeteer = require("puppeteer-core");
const chromium  = require("@sparticuz/chromium");

const ITEMS = [
  { key: "110",  itemId: "49518" },
  { key: "341",  itemId: "49519" },
  { key: "572",  itemId: "49520" },
  { key: "1166", itemId: "49521" },
  { key: "2398", itemId: "49522" },
  { key: "6160", itemId: "49523" },
];

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

  let browser;
  try {
    browser = await puppeteer.connect({
      browserWSEndpoint: `wss://chrome.browserless.io?token=${process.env.BROWSERLESS_KEY}`,
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36"
    );

    // Cargamos la primera página con el UID
    await page.goto(
      `https://pagostore.garena.com/?item=49518&uid=${uid}`,
      { waitUntil: "networkidle2", timeout: 20000 }
    );

    // Esperamos 2 segundos para que cargue bien
    await new Promise(r => setTimeout(r, 2000));

    const results = {};

    for (const item of ITEMS) {
      try {
        await page.goto(
          `https://pagostore.garena.com/?item=${item.itemId}&uid=${uid}`,
          { waitUntil: "networkidle2", timeout: 15000 }
        );

        // Esperamos que cargue la sección de pago
        await new Promise(r => setTimeout(r, 2500));

        // Buscamos precio tachado = tiene descuento
        const hasDiscount = await page.evaluate(() => {
          const body = document.body.innerHTML;
          return (
            body.includes("line-through") ||
            !!document.querySelector("[style*='line-through']") ||
            !!document.querySelector(".original-price") ||
            !!document.querySelector(".old-price") ||
            !!document.querySelector("del") ||
            !!document.querySelector("s")
          );
        });

        results[item.key] = hasDiscount;

      } catch {
        results[item.key] = false;
      }
    }

    // Intentamos obtener el nombre del jugador
    const nick = await page.evaluate(() => {
      const el =
        document.querySelector(".username") ||
        document.querySelector(".player-name") ||
        document.querySelector("[class*='username']") ||
        document.querySelector("[class*='nickname']");
      return el ? el.innerText.trim() : null;
    }).catch(() => null);

    await browser.close();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ nick, discounts: results }),
    };

  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
