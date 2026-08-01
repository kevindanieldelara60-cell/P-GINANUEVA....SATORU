exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  const puppeteerCode = `
    export default async ({ page, context }) => {
      const { uid } = context;
      await page.goto("https://pagostore.garena.com/?item=49521", {
        waitUntil: "networkidle2",
        timeout: 25000,
      });
      await new Promise(r => setTimeout(r, 2000));

      // Buscamos todos los inputs y retornamos info
      const inputs = await page.evaluate(() => {
        return Array.from(document.querySelectorAll("input")).map(el => ({
          type: el.type,
          placeholder: el.placeholder,
          className: el.className,
          name: el.name,
          id: el.id
        }));
      });

      const buttons = await page.evaluate(() => {
        return Array.from(document.querySelectorAll("button")).map(el => ({
          text: el.innerText.trim(),
          className: el.className
        }));
      });

      return {
        data: { inputs, buttons },
        type: "application/json"
      };
    };
  `;

  const res = await fetch(
    `https://production-sfo.browserless.io/function?token=${process.env.BROWSERLESS_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: puppeteerCode, context: { uid: "11831774841" } }),
    }
  );
  const data = await res.json();
  return { statusCode: 200, headers, body: JSON.stringify(data) };
};
