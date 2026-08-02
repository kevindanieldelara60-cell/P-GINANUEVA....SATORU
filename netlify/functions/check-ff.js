exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  const uid = (event.queryStringParameters && event.queryStringParameters.uid) || "11831774841";

  const code = [
    "export default async ({ page, context }) => {",
    "  const uid = context.uid;",
    "  await page.goto('https://pagostore.garena.com/?item=49521', {",
    "    waitUntil: 'networkidle2',",
    "    timeout: 25000,",
    "  });",
    "  await new Promise(r => setTimeout(r, 3000));",
    "  await page.evaluate((uid) => {",
    "    var input = document.querySelector('input.form-input');",
    "    if (!input) return;",
    "    input.focus();",
    "    var proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');",
    "    proto.set.call(input, uid);",
    "    input.dispatchEvent(new Event('input', { bubbles: true }));",
    "    input.dispatchEvent(new Event('change', { bubbles: true }));",
    "    input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));",
    "    input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));",
    "  }, uid);",
    "  await new Promise(r => setTimeout(r, 1500));",
    "  await page.evaluate(() => {",
    "    var btns = Array.from(document.querySelectorAll('button'));",
    "    var btn = btns.find(function(b) {",
    "      var t = b.innerText.trim();",
    "      return t === 'Iniciar Sesi\\u00f3n' || t === 'Iniciar Sesion';",
    "    });",
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
    "    var m = text.match(/Nombre de usuario[^\\n]*\\n([^\\n]+)/);",
    "    if (m) nick = m[1].trim();",
    "    var dopEls = Array.from(document.querySelectorAll('*'))",
    "      .filter(function(el) { return el.children.length === 0 && (el.innerText||'').indexOf('DOP') !== -1; })",
    "      .slice(0,5)",
    "      .map(function(el) { return { text: el.innerText.trim(), dec: window.getComputedStyle(el).textDecoration }; });",
    "    return { loggedIn: loggedIn, hasDiscount: hasDiscount, nick: nick, dopEls: dopEls, snippet: text.substring(0,500) };",
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
