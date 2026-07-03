# -*- coding: utf-8 -*-
"""
Processa a foto de capa (assets/capa.jpg|png) e gera:
  - editor/divine_capa.js      → data-URI JPEG p/ o PPTX gerado no navegador
  - apresentacao/capa_bg.jpg   → p/ o modelo estático (python-pptx)

O que faz:
  - recorta em 16:9 (cover), redimensiona;
  - espelha na horizontal por padrão (chocolates -> direita, texto legível à esquerda);
  - embute um degradê chocolate no lado esquerdo + base, garantindo contraste do texto.

Uso: python3 processa_capa.py <caminho/capa.jpg> <pasta_repo> [--no-flip] [--right]
  --no-flip : não espelha a imagem
  --right   : degradê do lado direito (para texto à direita)
"""
import sys, os, io, base64
from PIL import Image

CHOC = (0x2A, 0x1B, 0x12)
TW, TH = 2400, 1350                      # 16:9

def cover_crop(im, tw, th):
    im = im.convert("RGB")
    w, h = im.size
    k = max(tw / w, th / h)
    nw, nh = int(round(w * k)), int(round(h * k))
    im = im.resize((nw, nh), Image.LANCZOS)
    x = (nw - tw) // 2; y = (nh - th) // 2
    return im.crop((x, y, x + tw, y + th))

def scrim(im, side="left"):
    """degradê chocolate: forte no lado do texto -> transparente ~62% da largura; leve na base."""
    w, h = im.size
    ov = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = ov.load()
    edge = int(w * 0.62)
    for x in range(w):
        t = x / edge if side == "left" else (w - 1 - x) / edge
        a = 0.80 * (1 - t)
        a = max(0.0, min(0.80, a))
        col = (CHOC[0], CHOC[1], CHOC[2], int(a * 255))
        for y in range(h):
            px[x, y] = col
    # base: leve escurecimento para a logo/rodapé
    base_h = int(h * 0.30)
    for y in range(h - base_h, h):
        t = (y - (h - base_h)) / base_h
        a = int(0.35 * t * 255)
        for x in range(w):
            r, g, b, oa = px[x, y]
            na = min(255, oa + a)
            px[x, y] = (CHOC[0], CHOC[1], CHOC[2], na)
    out = im.convert("RGBA")
    out.alpha_composite(ov)
    return out.convert("RGB")

def datauri_jpeg(im, q=82):
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=q, optimize=True, progressive=True)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode(), len(buf.getvalue())

def header_band(src_im, flip):
    """faixa fina p/ o cabeçalho dos slides: recorte da área lisa, escurecido
       com chocolate para virar textura sutil (texto branco/logo continuam legíveis)."""
    w, h = src_im.size
    # pega a metade mais 'limpa' (direita no original) numa faixa horizontal do meio
    x0 = int(w * 0.42); y0 = int(h * 0.30); y1 = int(h * 0.62)
    band = src_im.convert("RGB").crop((x0, y0, w, y1))
    band = cover_crop(band, 2400, 300)
    if flip:
        band = band.transpose(Image.FLIP_LEFT_RIGHT)
    ov = Image.new("RGBA", band.size, (CHOC[0], CHOC[1], CHOC[2], int(0.62 * 255)))
    out = band.convert("RGBA"); out.alpha_composite(ov)
    return out.convert("RGB")

def main():
    args = sys.argv[1:]
    flip = "--no-flip" not in args
    side = "right" if "--right" in args else "left"
    pos = [a for a in args if not a.startswith("--")]
    src, repo = pos[0], pos[1]

    orig = Image.open(src)
    im = cover_crop(orig, TW, TH)
    if flip:
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
    im = scrim(im, side)

    band = header_band(orig, flip)

    uri, nbytes = datauri_jpeg(im, 82)
    uri_h, hbytes = datauri_jpeg(band, 82)
    js = ("/* gerado por processa_capa.py — foto de capa Divine embutida */\n"
          "(function(root,f){if(typeof module===\"object\"&&module.exports)module.exports=f();"
          "else root.DivineCapa=f();})(typeof self!==\"undefined\"?self:this,function(){return{\n"
          "BG:%s,\nHEADER:%s};});\n" % (_q(uri), _q(uri_h)))
    with open(os.path.join(repo, "editor", "divine_capa.js"), "w") as f:
        f.write(js)
    im.save(os.path.join(repo, "apresentacao", "capa_bg.jpg"), "JPEG", quality=88, optimize=True)
    band.save(os.path.join(repo, "apresentacao", "header_bg.jpg"), "JPEG", quality=88, optimize=True)

    print("capa: %dx%d | flip=%s | scrim=%s | capa=%d KB | header=%d KB"
          % (TW, TH, flip, side, nbytes // 1024, hbytes // 1024))

def _q(s):
    import json
    return json.dumps(s)

if __name__ == "__main__":
    main()
