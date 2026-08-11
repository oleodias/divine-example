# -*- coding: utf-8 -*-
"""
Prepara as imagens da animação de entrada (editor/divine-intro.js).

Lê  : assets/divine-word.png  e  assets/divine-tagline.png   (arte do produtor)
Gera: editor/divine_intro_assets.js  — data-URIs embutidos, para a página
      continuar sendo um arquivo único que funciona offline.

Faz duas coisas na arte, e o porquê de cada uma:

1) CALIGRAFIA — padding transparente lateral até a proporção exata WORD_AR=3.1761.
   O divine-intro.js assume essa proporção; a arte veio em 3.0905. Sem o padding,
   o object-fit:contain deixa margem e a caligrafia pousa ~5px menor que o logo do
   topbar. Como o #logoTop usa ESTA MESMA imagem, o pouso fecha no pixel.

2) TAGLINE — recolorida para dourado. A arte original é marrom (#703020) e some
   no fundo escuro do overlay. O script aplica filter: brightness(1.55) saturate(.82),
   então a cor de origem é calculada INVERTENDO esse filtro para cair no tom desejado.

Uso: python3 processa_intro.py <pasta_repo>
"""
import sys, os, io, json, base64
from PIL import Image

WORD_AR = 3.1761          # constante do divine-intro.js (não alterar lá)
# A animação exibe a caligrafia em no máximo 720px de largura (o palco é limitado
# a 720px no divine-intro.js). 1400px é a largura que o guia do produtor especifica
# e dá ~1.9x numa tela de 720px — qualidade retina sem inchar o arquivo único.
MAX_LARGURA = 1400
TAGLINE_ALVO = (0xDA, 0xB2, 0x6A)   # como a tagline deve APARECER na tela
BRILHO, SATURACAO = 1.55, 0.82      # filtro que o divine-intro.js aplica nela


def filtro_css(cor):
    """simula filter: brightness(BRILHO) saturate(SATURACAO)"""
    r, g, b = [min(255, v * BRILHO) for v in cor]
    s = SATURACAO
    return (
        (0.213 + 0.787 * s) * r + (0.715 - 0.715 * s) * g + (0.072 - 0.072 * s) * b,
        (0.213 - 0.213 * s) * r + (0.715 + 0.285 * s) * g + (0.072 - 0.072 * s) * b,
        (0.213 - 0.213 * s) * r + (0.715 - 0.715 * s) * g + (0.072 + 0.928 * s) * b,
    )


def origem_para(alvo, passos=60):
    """cor de origem que, depois do filtro do script, resulta em `alvo`"""
    src = [v / BRILHO for v in alvo]
    for _ in range(passos):
        out = filtro_css(src)
        src = [max(0, min(255, s + (a - o) * 0.5)) for s, a, o in zip(src, alvo, out)]
    return tuple(int(round(v)) for v in src)


def uri(dados):
    return "data:image/png;base64," + base64.b64encode(dados).decode()


def png(im):
    b = io.BytesIO()
    im.save(b, "PNG", optimize=True)
    return b.getvalue()


def main():
    repo = sys.argv[1] if len(sys.argv) > 1 else "."
    ass = os.path.join(repo, "assets")

    # 1) caligrafia com a proporção que o script espera
    w_im = Image.open(os.path.join(ass, "divine-word.png")).convert("RGBA")
    if w_im.size[0] > MAX_LARGURA:
        w_im.thumbnail((MAX_LARGURA, 99999), Image.LANCZOS)
    w, h = w_im.size
    alvo_w = int(round(h * WORD_AR))
    word = Image.new("RGBA", (alvo_w, h), (0, 0, 0, 0))
    word.paste(w_im, ((alvo_w - w) // 2, 0), w_im)
    word_png = png(word)

    # 2) tagline recolorida (preserva o recorte/alfa da arte original)
    t_im = Image.open(os.path.join(ass, "divine-tagline.png")).convert("RGBA")
    src = origem_para(TAGLINE_ALVO)
    tag = Image.new("RGBA", t_im.size, src + (255,))
    tag.putalpha(t_im.split()[3])
    tag_png = png(tag)

    js = (
        "/* gerado por editor/processa_intro.py — imagens da animacao de entrada.\n"
        "   WORD: arte do produtor + padding ate WORD_AR=3.1761 (mesma imagem do #logoTop).\n"
        "   TAGLINE: recolorida para aparecer como #%02X%02X%02X depois do filtro do script. */\n"
        '(function(root,f){if(typeof module==="object"&&module.exports)module.exports=f();'
        'else root.DivineIntroAssets=f();})(typeof self!=="undefined"?self:this,function(){return{\n'
        "WORD:%s,\nTAGLINE:%s};});\n"
        % (TAGLINE_ALVO[0], TAGLINE_ALVO[1], TAGLINE_ALVO[2],
           json.dumps(uri(word_png)), json.dumps(uri(tag_png)))
    )
    saida = os.path.join(repo, "editor", "divine_intro_assets.js")
    open(saida, "w").write(js)

    conf = tuple(int(round(v)) for v in filtro_css(src))
    print("caligrafia: %dx%d AR=%.4f (alvo %.4f) — %d KB"
          % (alvo_w, h, alvo_w / h, WORD_AR, len(word_png) // 1024))
    print("tagline   : tinta #%02X%02X%02X -> na tela #%02X%02X%02X — %d KB"
          % (src + conf + (len(tag_png) // 1024,)))
    print("-> %s (%d KB)" % (saida, os.path.getsize(saida) // 1024))


if __name__ == "__main__":
    main()
