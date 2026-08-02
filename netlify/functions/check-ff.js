exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  const uid = (event.queryStringParameters && event.queryStringParameters.uid) || "11831774841";

  if (!/^\d{5,15}$/.test(uid)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "UID invalido" }),
    };
  }

  const code = [
    "export default async ({ page, context }) => {",
    "  const uid = context.uid;",
    "  await page.goto('https://pagostore.garena.com/?item=49521', {",
    "    waitUntil: 'networkidle2',",
    "    timeout: 25000,",
    "  });",
    "  await new Promise(r => setTimeout(r, 3000));",
    "  await page.click('input.form-input');",
    "  await page.keyboard.down('Control');",
    "  await page.keyboard.press('A');",
    "  await page.keyboard.up('Control');",
    "  await page.keyboard.press('Delete');",
    "  await new Promise(r => setTimeout(r, 300));",
    "  await page.type('input.form-input', uid, { delay: 120 });",
    "  await new Promise(r => setTimeout(r, 1000));",
    "  await page.evaluate(() => {",
    "    var btns = Array.from(document.querySelectorAll('button'));",
    "    var btn = btns.find(function(b) { return b.innerText.trim() === 'Iniciar Sesion' || b.innerText.trim() === 'Iniciar Sesi\\u00f3n'; });",
    "    if (btn) btn.click();",
    "  });",
    "  await new Promise(r => setTimeout(r, 7000));",
    "  var result = await page.evaluate(() => {",
    "    var text = document.body.innerText;",
    "    var html = document.body.innerHTML;",
    "    var loggedIn = text.indexOf('Nombre de usuario') !== -1;",
    "    var hasPromo = text.indexOf('PROMO') !== -1;",
    "    var hasLineThrough = html.indexOf('line-through') !== -1;",
    "    var hasDiscount = hasPromo && hasLineThrough;",
    "    var nick = null;",
    "    var nickMatch = text.match(/Nombre de usuario[^\\n]*\\n([^\\n]+)/);",
    "    if (nickMatch) nick = nickMatch[1].trim();",
    "    var dopEls = Array.from(document.querySelectorAll('*'))",
    "      .filter(function(el) { return el.children.length === 0 && (el.innerText || '').indexOf('DOP') !== -1; })",
    "      .slice(0, 5)",
    "      .map(function(el) {",
    "        return {",
    "          text: el.innerText.trim(),",
    "          cls: el.className.substring(0, 60),",
    "          dec: window.getComputedStyle(el).textDecoration",
    "        };",
    "      });",
    "    return { loggedIn: loggedIn, hasDiscount: hasDiscount, nick: nick, dopEls: dopEls, snippet: text.substring(0, 500) };",
    "  });",
    "  return { data: result, type: 'application/json' };",
    "};"
  ].join("\n");

  try {
    var res = await fetch(
      "https://production-sfo.browserless.io/function?token=" + process.env.BROWSERLESS_KEY,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code, context: { uid: uid } }),
      }
    );
    var data = await res.json();
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data && data.data ? data.data : data),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
