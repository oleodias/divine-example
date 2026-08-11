// Monta o Editor_Divine.html (arquivo único) a partir de editor_src.html,
// embutindo a biblioteca pptxgenjs e o módulo divine_export.js.
// Uso: npm install pptxgenjs && node build_editor.js
const fs = require("fs");
let html = fs.readFileSync("editor_src.html", "utf8");
const bundle = fs.readFileSync("node_modules/pptxgenjs/dist/pptxgen.bundle.js", "utf8");
const jszip = fs.readFileSync("node_modules/jszip/dist/jszip.min.js", "utf8");   // p/ pós-processar animações
let exp = fs.readFileSync("divine_export.js", "utf8");
exp = fs.readFileSync("divine_anim.js", "utf8") + "\n" + exp;                     // animações
if (fs.existsSync("divine_logo.js")) {                      // logo oficial, se já processada
  exp = fs.readFileSync("divine_logo.js", "utf8") + "\n" + exp;
  console.log("logo oficial embutida");
}
if (fs.existsSync("divine_capa.js")) {                      // foto de capa, se já processada
  exp = fs.readFileSync("divine_capa.js", "utf8") + "\n" + exp;
  console.log("foto de capa embutida");
}
// imagens da animação: entram ANTES do script principal, porque aplicaLogo()
// usa DivineIntroAssets.WORD no #logoTop (mesma imagem do voo = pouso no pixel)
if (fs.existsSync("divine_intro_assets.js")) {
  exp = fs.readFileSync("divine_intro_assets.js", "utf8") + "\n" + exp;
}
// escapa "</script" para o parser do HTML não fechar a tag no meio do código
// (o divine-intro.js traz "</script>" dentro de um comentário). Em JS, "<\/script"
// é idêntico a "</script", então o comportamento não muda.
const tag = (js) => "<script>" + String(js).replace(/<\/script/gi, "<\\/script") + "</" + "script>";
html = html.replace("<!--PPTXGEN-->", () => tag(bundle) + "\n" + tag(jszip));
html = html.replace("<!--EXPORT-->", () => tag(exp));

// ---- animação de entrada (última coisa do <body>, conforme o guia) ----
let intro = "";
if (fs.existsSync("divine-intro.js")) {
  // a caligrafia do voo é a MESMA imagem do #logoTop -> o pouso fecha no pixel
  const cfg =
    // oncePerSession:false -> a animação toca a cada acesso/recarregamento
    'window.DIVINE_INTRO={tagTop:0.905,oncePerSession:false,' +
    'word:(window.DivineIntroAssets&&DivineIntroAssets.WORD)||"divine-word.png",' +
    'tagline:(window.DivineIntroAssets&&DivineIntroAssets.TAGLINE)||"divine-tagline.png"' +
    '};';
  intro = tag(cfg) + "\n" + tag(fs.readFileSync("divine-intro.js", "utf8"));
  console.log("animação de entrada embutida");
}
html = html.replace("<!--INTRO-->", () => intro);
fs.writeFileSync("Editor_Divine.html", html);
console.log("Editor_Divine.html gerado:", (fs.statSync("Editor_Divine.html").size / 1024).toFixed(0), "KB");
