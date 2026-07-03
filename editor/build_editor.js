// Monta o Editor_Divine.html (arquivo único) a partir de editor_src.html,
// embutindo a biblioteca pptxgenjs e o módulo divine_export.js.
// Uso: npm install pptxgenjs && node build_editor.js
const fs = require("fs");
let html = fs.readFileSync("editor_src.html", "utf8");
const bundle = fs.readFileSync("node_modules/pptxgenjs/dist/pptxgen.bundle.js", "utf8");
let exp = fs.readFileSync("divine_export.js", "utf8");
if (fs.existsSync("divine_logo.js")) {                      // logo oficial, se já processada
  exp = fs.readFileSync("divine_logo.js", "utf8") + "\n" + exp;
  console.log("logo oficial embutida");
}
if (fs.existsSync("divine_capa.js")) {                      // foto de capa, se já processada
  exp = fs.readFileSync("divine_capa.js", "utf8") + "\n" + exp;
  console.log("foto de capa embutida");
}
html = html.replace("<!--PPTXGEN-->", () => "<script>" + bundle + "</" + "script>");
html = html.replace("<!--EXPORT-->", () => "<script>" + exp + "</" + "script>");
fs.writeFileSync("Editor_Divine.html", html);
console.log("Editor_Divine.html gerado:", (fs.statSync("Editor_Divine.html").size / 1024).toFixed(0), "KB");
