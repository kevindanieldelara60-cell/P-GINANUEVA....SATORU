exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  const uid = event.queryStringParameters?.uid || "11831774841";

  const puppeteerCode = `
    export default async ({ page, context }) => {
      const { uid } = context;

      await page.goto("https://pagostore.garena.com/?item=49521", {
        waitUntil: "networkidle2",
        timeout: 25000,
      });
      await new Promise(r => setTimeout(r, 3000));

      // Clickeamos el input, lo limpiamos y escribimos con page.type
      await page.click("input.form-input");
      await page.keyboard.down("Control");
      await page.keyboard.press("A");
      await page.keyboard.up("Control");
      await page.keyboard.press("Delete");
      await new Promise(r => setTimeout(r, 300));
      await page.type("input.form-input", uid, { delay: 120 });
      await new Promise(r => setTimeout(r, 1000));

      // Clickeamos Iniciar Sesión
      await page.evaluate(() => {
        Array.from(document.querySelectorAll("button"))
          .find(b => b.innerText.trim() === "Iniciar Sesión")?.click();
      });

      await new Promise(r => setTimeout(r, 7000));

      const result = await page.evaluate(() => {
        const text = document.body.innerText;
        const loggedIn = text.includes("Nombre de usuario") || text.includes("ID de jugador\n");
        const hasDiscount = text.includes("PROMO") && document.body.innerHTML.includes("line-through");
        
        // Buscamos elementos DOP
        const dopEls = Array.from(document.querySelectorAll("*"))
          .filter(el => el.children.length === 0 && (el.innerText||"").includes("DOP"))
          .slice(0, 10)
          .map(el => ({
            text: el.innerText.trim(),
            cls: el.className.substring(0, 80),
            dec: window.getComputedStyle(el).textDecoration
          }));

        return { loggedIn, hasDiscount, dopEls, snippet: text.substring(0, 600) };
      });

      return { data: result, type: "application/json" };
    };
  `;

  const res = await fetch(
    `https://production-sfo.browserless.io/function?token=${process.env.BROWSERLESS_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: puppeteerCode, context: { uid } }),
    }
  );
  const data = await res.json();
  return { statusCode: 200, headers, body: JSON.stringify(data?.data || data) };
};
