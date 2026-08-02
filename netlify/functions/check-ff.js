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
      await new Promise(r => setTimeout(r, 2000));

      const input = await page.$("input.form-input");
      if (input) {
        await input.click({ clickCount: 3 });
        await input.press("Backspace");
        for (const char of uid) {
          await input.press(char);
          await new Promise(r => setTimeout(r, 80));
        }
        await new Promise(r => setTimeout(r, 800));
        const loginBtn = await page.evaluateHandle(() => {
          return Array.from(document.querySelectorAll("button"))
            .find(b => b.innerText.trim() === "Iniciar Sesión");
        });
        if (loginBtn) await loginBtn.asElement()?.click();
        await new Promise(r => setTimeout(r, 6000));
      }

      // Extraemos el HTML de la sección de método de pago solamente
      const result = await page.evaluate(() => {
        const text = document.body.innerText;
        
        // Buscamos todos los elementos que contienen "DOP"
        const dopEls = Array.from(document.querySelectorAll("*"))
          .filter(el => 
            el.children.length === 0 && 
            (el.innerText || "").includes("DOP")
          )
          .map(el => ({
            text: el.innerText.trim(),
            className: el.className,
            tagName: el.tagName,
            computedDecoration: window.getComputedStyle(el).textDecoration,
            parentClass: el.parentElement?.className || ""
          }));

        return { dopEls, bodySnippet: text.substring(0, 800) };
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
