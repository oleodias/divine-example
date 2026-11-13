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
// ---- fontes da interface (Inter + Fraunces, licença OFL) embutidas em base64,
// para o arquivo continuar único e funcionando offline. Sem os pacotes, usa a do sistema.
let fontes = "";
const FONTES = [["Inter", "inter", [400, 500, 600, 700, 800]], ["Fraunces", "fraunces", [600, 700]]];
for (const [fam, pkg, pesos] of FONTES) {
  for (const w of pesos) {
    const arq = `node_modules/@fontsource/${pkg}/files/${pkg}-latin-${w}-normal.woff2`;
    if (!fs.existsSync(arq)) continue;
    fontes += `@font-face{font-family:"${fam}";font-style:normal;font-weight:${w};font-display:swap;` +
      `src:url(data:font/woff2;base64,${fs.readFileSync(arq).toString("base64")}) format("woff2")}\n`;
  }
}
if (fontes) console.log("fontes embutidas (Inter + Fraunces)");
html = html.replace("<!--FONTS-->", () => fontes ? "<style>\n" + fontes + "</style>" : "");
html = html.replace("<!--PPTXGEN-->", () => tag(bundle) + "\n" + tag(jszip));

// ---- nuvem (Supabase): biblioteca embutida (funciona sem CDN) + módulo de sincronização.
// Entram ANTES do script principal, que usa Nuvem.chaveDados() já no load().
let nuvem = "";
const SUPA = "node_modules/@supabase/supabase-js/dist/umd/supabase.js";
if (fs.existsSync(SUPA) && fs.existsSync("divine_nuvem.js")) {
  // O pacote UMD tenta descobrir de qual URL foi carregado e TRAVA quando está embutido
  // no HTML (script sem "src"). Usamos o endereço da própria página como base: ele só
  // seria usado para carregar um "fetch" alternativo, que navegadores atuais não precisam.
  const TRAVA = 'if(!e)throw new Error("Automatic publicPath is not supported in this browser");';
  let supa = fs.readFileSync(SUPA, "utf8");
  if (!supa.includes(TRAVA)) throw new Error("supabase-js mudou: revise o ajuste de publicPath em build_editor.js");
  supa = supa.replace(TRAVA, 'if(!e)e=(typeof location!=="undefined"?location.href:"./");');
  nuvem = tag(supa) + "\n" + tag(fs.readFileSync("divine_nuvem.js", "utf8"));
  console.log("nuvem (Supabase) embutida");
}
html = html.replace("<!--NUVEM-->", () => nuvem);
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
