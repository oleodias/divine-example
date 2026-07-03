# -*- coding: utf-8 -*-
"""
Processa a logo oficial da Divine (assets/logo.png) e gera:
  - editor/divine_logo.js  → data-URIs (logo completa + só o wordmark) p/ página e PPTX
  - apresentacao/logo_wordmark.png e logo_full.png → p/ o modelo estático (python-pptx)
  - imprime os hex dominantes (dourado e marrom) extraídos dos pixels

Uso: python3 processa_logo.py <caminho/logo.png> <pasta_repo>
Aceita PNG com fundo branco (converte p/ transparente) ou já transparente.
"""
import sys, os, base64, io, json
from PIL import Image

def carrega(path):
    im = Image.open(path).convert("RGBA")
    px = im.load()
    w, h = im.size
    # fundo branco -> transparente (preserva antisserrilhado)
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            dist = max(255 - r, 255 - g, 255 - b)          # 0 = branco puro
            na = min(255, int(dist * 2.3))
            if na < a:
                px[x, y] = (r, g, b, na)
    return im

def autocrop(im, pad=8):
    bbox = im.split()[3].getbbox()
    if not bbox:
        return im
    x0, y0, x1, y1 = bbox
    x0 = max(0, x0 - pad); y0 = max(0, y0 - pad)
    x1 = min(im.size[0], x1 + pad); y1 = min(im.size[1], y1 + pad)
    return im.crop((x0, y0, x1, y1))

def divide_wordmark(im):
    """separa o wordmark (parte de cima) do subtítulo pelo maior vão vertical em branco"""
    w, h = im.size
    alpha = im.split()[3]
    proj = [0] * h
    ap = alpha.load()
    for y in range(h):
        s = 0
        for x in range(0, w, 3):
            if ap[x, y] > 30:
                s += 1
        proj[y] = s
    # maior sequência de linhas vazias no miolo (20%..90% da altura)
    best = (0, None, None)
    ini = None
    for y in range(int(h * .2), int(h * .9)):
        if proj[y] <= 1:
            if ini is None:
                ini = y
        else:
            if ini is not None:
                if y - ini > best[0]:
                    best = (y - ini, ini, y)
                ini = None
    if best[1] is None or best[0] < h * 0.02:
        return im  # não achou vão: usa a logo inteira
    corte = (best[1] + best[2]) // 2
    return autocrop(im.crop((0, 0, w, corte)), pad=4)

def hexes(im):
    """hex medianos do dourado e do marrom"""
    im2 = im.copy(); im2.thumbnail((400, 400))
    px = im2.load(); w, h = im2.size
    ouro, marrom = [], []
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 200:
                continue
            if r > 150 and g > 105 and r > b + 50:
                ouro.append((r, g, b))
            elif r < 170 and r > g > b and r > b + 20:
                marrom.append((r, g, b))
    def med(v):
        if not v: return None
        v = sorted(v, key=lambda c: sum(c))
        r, g, b = v[len(v) // 2]
        return "#%02X%02X%02X" % (r, g, b)
    return med(ouro), med(marrom)

def datauri(im, width):
    im = im.copy()
    im.thumbnail((width, 10000))
    sz = im.size
    q = im.quantize(colors=256, method=Image.FASTOCTREE)   # PNG-8 c/ alfa: ~70% menor
    buf = io.BytesIO()
    q.save(buf, "PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode(), sz

def main():
    src, repo = sys.argv[1], sys.argv[2]
    full = autocrop(carrega(src))
    wm = divide_wordmark(full)

    uri_full, (fw, fh) = datauri(full, 1000)
    uri_wm, (ww, wh) = datauri(wm, 1000)

    js = ("/* gerado por processa_logo.py — logo oficial Divine embutida */\n"
          "(function(root,f){if(typeof module===\"object\"&&module.exports)module.exports=f();"
          "else root.DivineLogo=f();})(typeof self!==\"undefined\"?self:this,function(){return{\n"
          "WM_AR:%.4f,FULL_AR:%.4f,\nWORDMARK:%s,\nFULL:%s};});\n"
          % (ww / wh, fw / fh, json.dumps(uri_wm), json.dumps(uri_full)))
    with open(os.path.join(repo, "editor", "divine_logo.js"), "w") as f:
        f.write(js)

    wm_png = wm.copy(); wm_png.thumbnail((1200, 10000))
    full_png = full.copy(); full_png.thumbnail((1200, 10000))
    wm_png.save(os.path.join(repo, "apresentacao", "logo_wordmark.png"), optimize=True)
    full_png.save(os.path.join(repo, "apresentacao", "logo_full.png"), optimize=True)

    ouro, marrom = hexes(full)
    print("wordmark: %dx%d (AR %.2f) | completa: %dx%d (AR %.2f)" % (ww, wh, ww / wh, fw, fh, fw / fh))
    print("hex dourado ~", ouro, "| hex marrom ~", marrom)
    print("divine_logo.js:", os.path.getsize(os.path.join(repo, "editor", "divine_logo.js")) // 1024, "KB")

if __name__ == "__main__":
    main()
