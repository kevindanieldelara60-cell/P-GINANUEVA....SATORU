exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  const uid = event.queryStringParameters?.uid || "11831774841";

  const puppeteerCode = `
    export default async ({ page, context }) => {
      const { uid } = context;

      await page.setUserAgent(
        "Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36"
      );

      await page.goto("https://pagostore.garena.com/?item=49521", {
        waitUntil: "networkidle2",
        timeout: 25000,
      });
      await new Promise(r => setTimeout(r, 2000));

      // Screenshot ANTES de ingresar el UID
      const screenshotBefore = await page.screenshot({ encoding: "base64" });

      // Todos los inputs disponibles
      const inputsInfo = await page.evaluate(() => {
        return Array.from(document.querySelectorAll("input")).map(el => ({
          type: el.type,
          placeholder: el.placeholder,
          id: el.id,
          name: el.name,
          className: el.className,
          value: el.value,
        }));
      });

      // Todos los botones disponibles
      const buttonsInfo = await page.evaluate(() => {
        return Array.from(document.querySelectorAll("button")).map(el => ({
          text: el.innerText,
          type: el.type,
          className: el.className,
        }));
      });

      // HTML completo de la sección de login
      const loginHTML = await page.evaluate(() => {
        const el = document.querySelector("form") ||
                   document.querySelector(".login") ||
                   document.querySelector("[class*='login']") ||
                   document.querySelector("[class*='account']") ||
                   document.body;
        return el ? el.innerHTML.substring(0, 3000) : "no encontrado";
      });

      return {
        data: {
          screenshotBefore,
          inputsInfo,
          buttonsInfo,
          loginHTML,
          pageTitle: await page.title(),
          pageURL: page.url(),
        },
        type: "application/json",
      };
    };
  `;

  try {
    const res = await fetch(
      `https://production-sfo.browserless.io/function?token=${process.env.BROWSERLESS_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: puppeteerCode,
          context: { uid },
        }),
      }
    );
    const data = await res.json();
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
