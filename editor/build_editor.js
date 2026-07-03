// Monta o Editor_Divine.html (arquivo único) a partir de editor_src.html,
// embutindo a biblioteca pptxgenjs e o módulo divine_export.js.
// Uso: npm install pptxgenjs && node build_editor.js
const fs = require("fs");
let html = fs.readFileSync("editor_src.html", "utf8");
const bundle = fs.readFileSync("node_modules/pptxgenjs/dist/pptxgen.bundle.js", "utf8");
const exp = fs.readFileSync("divine_export.js", "utf8");
html = html.replace("<!--PPTXGEN-->", () => "<script>" + bundle + "</" + "script>");
html = html.replace("<!--EXPORT-->", () => "<script>" + exp + "</" + "script>");
fs.writeFileSync("Editor_Divine.html", html);
console.log("Editor_Divine.html gerado:", (fs.statSync("Editor_Divine.html").size / 1024).toFixed(0), "KB");
