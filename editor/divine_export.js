/* Divine Chocolates — exportação do PPTX de acompanhamento de projetos.
   Funciona no navegador (PptxGenJS global) e no Node (require). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    let logo = null, capa = null;
    try { logo = require("./divine_logo.js"); } catch (e) {}
    try { capa = require("./divine_capa.js"); } catch (e) {}
    module.exports = factory(logo, capa);
  } else root.DivineExport = factory(root.DivineLogo || null, root.DivineCapa || null);
})(typeof self !== "undefined" ? self : this, function (LOGO, CAPA) {

  const C = {
    CHOC: "3E2419", CHOC2: "5A3A2A", CHOC3: "7A5238", RED: "A83224",
    GOLD: "C9932E", GOLDLT: "E0A53A", CREAM: "FBF6EA", CREAM2: "F4EAD7",
    CREAM3: "F9F3E4", LINE: "E3D6BF", INK: "2A1B12", MUTE: "9C8C72",
    WHITE: "FFFFFF", CREAMTXT: "E7D8C2",
    G: "43A047", GD: "2E7D32", GB: "E6F1E3",
    A: "E0A53A", AD: "9A6A12", AB: "FBEFD3",
    R: "C0392F", RD: "B23A2A",
    N: "CDBDA4", ND: "8A7A66",
    OBS_BG: "FDF3DC", OBS_LN: "E8CF93",
  };
  const FONT = "Segoe UI", SCRIPT = "Segoe Script";
  const NOLINE = { color: C.WHITE, width: 0, transparency: 100 };

  const STATUS_GERAL = {
    "EM ANDAMENTO":  { fill: C.GOLDLT, tc: C.INK },
    "CONCLUÍDO":     { fill: C.G,      tc: C.WHITE },
    "PAUSADO":       { fill: C.N,      tc: C.INK },
    "EM TESTE":      { fill: C.AB,     tc: C.AD },
    "PLANEJAMENTO":  { fill: C.CREAM2, tc: C.CHOC },
    "CANCELADO":     { fill: C.R,      tc: C.WHITE },
  };

  function pillOpts(x, y, w, h, fill, tc, size, extra) {
    return Object.assign({
      shape: "roundRect", rectRadius: h / 2.6, x, y, w, h,
      fill: fill ? { color: fill } : { color: C.WHITE, transparency: 100 },
      line: NOLINE, align: "center", valign: "middle",
      fontSize: size, bold: true, color: tc, fontFace: FONT, margin: 0,
    }, extra || {});
  }

  function dot(slide, cx, cy, st, d) {
    d = d || 0.235;
    const base = { shape: "ellipse", x: cx - d / 2, y: cy - d / 2, w: d, h: d, margin: 0, align: "center", valign: "middle", fontFace: FONT, fontSize: 11, bold: true };
    if (st === "g") slide.addText("✓", Object.assign(base, { fill: { color: C.G }, line: NOLINE, color: C.WHITE }));
    else if (st === "a") slide.addText("", Object.assign(base, { fill: { color: C.A }, line: NOLINE }));
    else if (st === "r") slide.addText("!", Object.assign(base, { fill: { color: C.R }, line: NOLINE, color: C.WHITE }));
    else slide.addText("", Object.assign(base, { fill: { color: C.WHITE }, line: { color: C.N, width: 1.5 } }));
  }

  function iconCircle(slide, x, y, fill, sym, name) {
    slide.addText(sym, { shape: "ellipse", x, y, w: 0.26, h: 0.26, fill: { color: fill }, line: NOLINE, color: C.WHITE, fontSize: 12, bold: true, align: "center", valign: "middle", margin: 0, fontFace: FONT, ...(name ? { objectName: name } : {}) });
  }

  function logo(slide) {
    // logo oficial embutida quando disponível; senão, marcador provisório
    if (LOGO && LOGO.WORDMARK) {
      const lh = 0.54, lw = lh * LOGO.WM_AR;
      slide.addImage({ data: LOGO.WORDMARK, x: 0.32, y: (0.98 - lh) / 2, w: lw, h: lh });
      return 0.32 + lw + 0.18;
    }
    slide.addText("Divine", { shape: "roundRect", rectRadius: 0.13, x: 0.30, y: 0.17, w: 0.62, h: 0.62, fill: { color: C.RED }, line: NOLINE, color: C.GOLDLT, fontSize: 10, bold: true, italic: true, fontFace: SCRIPT, align: "center", valign: "middle", margin: 0 });
    return 1.08;
  }

  function header(slide, eyebrow, title, prioridade, statusGeral) {
    if (CAPA && CAPA.HEADER) {
      slide.addImage({ data: CAPA.HEADER, x: 0, y: 0, w: 13.333, h: 0.98 });
    } else {
      slide.addShape("rect", { x: 0, y: 0, w: 13.333, h: 0.98, fill: { color: C.CHOC }, line: NOLINE });
    }
    slide.addShape("rect", { x: 0, y: 0.98, w: 13.333, h: 0.028, fill: { color: C.GOLD }, line: NOLINE });
    const txX = logo(slide);
    slide.addText(eyebrow, { x: txX + 0.02, y: 0.155, w: 8.0, h: 0.25, fontSize: 10, bold: true, color: C.GOLDLT, fontFace: FONT, margin: 0 });
    slide.addText(title, { x: txX, y: 0.375, w: 8.0, h: 0.55, fontSize: 25, bold: true, color: C.WHITE, fontFace: FONT, margin: 0 });
    if (prioridade) {
      slide.addText("PRIORIDADE", { x: 9.35, y: 0.14, w: 1.55, h: 0.2, fontSize: 8, bold: true, color: C.CREAMTXT, align: "center", fontFace: FONT, margin: 0 });
      slide.addText(prioridade, pillOpts(9.35, 0.40, 1.55, 0.40, C.WHITE, C.CHOC, 11.5));
    }
    if (statusGeral) {
      const sg = STATUS_GERAL[statusGeral] || { fill: C.CREAM2, tc: C.CHOC };
      slide.addText("STATUS GERAL", { x: 11.10, y: 0.14, w: 1.90, h: 0.2, fontSize: 8, bold: true, color: C.CREAMTXT, align: "center", fontFace: FONT, margin: 0 });
      slide.addText(statusGeral, pillOpts(11.10, 0.40, 1.90, 0.40, sg.fill, sg.tc, 11.5));
    }
  }

  function subband(slide, resp, abertura, atualizado) {
    slide.addShape("rect", { x: 0, y: 1.008, w: 13.333, h: 0.40, fill: { color: C.CREAM2 }, line: NOLINE });
    slide.addText([
      { text: "Responsável: ", options: { bold: true, color: C.CHOC } },
      { text: (resp || "—") + "      ", options: { color: C.CHOC2 } },
      { text: "Data de abertura: ", options: { bold: true, color: C.CHOC } },
      { text: abertura || "—", options: { color: C.CHOC2 } },
    ], { x: 0.38, y: 1.075, w: 9.5, h: 0.28, fontSize: 10, fontFace: FONT, margin: 0 });
    slide.addText("Atualizado: " + (atualizado || "—"), { x: 9.9, y: 1.075, w: 3.05, h: 0.28, fontSize: 9.5, italic: true, color: C.MUTE, align: "right", fontFace: FONT, margin: 0 });
  }

  function footer(slide, legend) {
    slide.addShape("rect", { x: 0, y: 7.18, w: 13.333, h: 0.32, fill: { color: C.CHOC }, line: NOLINE });
    if (LOGO && LOGO.WORDMARK) {
      const lh = 0.22, lw = lh * LOGO.WM_AR;
      slide.addImage({ data: LOGO.WORDMARK, x: 12.95 - lw, y: 7.23, w: lw, h: lh });
    } else {
      slide.addText("Divine", { x: 12.15, y: 7.215, w: 0.95, h: 0.26, fontSize: 11, bold: true, italic: true, color: C.GOLDLT, fontFace: SCRIPT, align: "right", margin: 0 });
    }
    if (legend) {
      const items = [[C.G, "Concluído"], [C.A, "Em andamento"], [null, "Não iniciado"], [C.R, "Bloqueado"]];
      let x = 0.38;
      for (const [col, lab] of items) {
        if (col) slide.addShape("ellipse", { x, y: 7.28, w: 0.12, h: 0.12, fill: { color: col }, line: NOLINE });
        else slide.addShape("ellipse", { x, y: 7.28, w: 0.12, h: 0.12, fill: { color: C.WHITE }, line: { color: C.N, width: 1 } });
        slide.addText(lab, { x: x + 0.18, y: 7.235, w: 1.5, h: 0.22, fontSize: 8.5, bold: true, color: C.CREAMTXT, fontFace: FONT, margin: 0 });
        x += 0.18 + lab.length * 0.093 + 0.38;
      }
    }
  }

  function card(slide, x, y, w, h, name) {
    slide.addShape("roundRect", { rectRadius: 0.09, x, y, w, h, fill: { color: C.WHITE }, line: { color: C.LINE, width: 1 }, ...(name ? { objectName: name } : {}) });
  }

  function bulletText(items, x, y, w, h, name) {
    const paras = [];
    (items && items.length ? items : ["—"]).forEach((t, i) => {
      paras.push({ text: "•  ", options: { bold: true, color: C.GOLD, breakLine: false, ...(i ? { softBreakBefore: false } : {}) } });
      paras.push({ text: t, options: { color: C.CHOC2, breakLine: true } });
    });
    return [paras, { x, y, w, h, fontSize: 10.5, fontFace: FONT, margin: 0, paraSpaceAfter: 5, valign: "top", ...(name ? { objectName: name } : {}) }];
  }

  function slideAcompanhamento(pptx, p) {
    const s = pptx.addSlide();
    s.background = { color: C.CREAM };
    header(s, "ACOMPANHAMENTO DO PROJETO", p.nome || "[ Nome do Projeto ]", p.prioridade || "—", p.statusGeral || "PLANEJAMENTO");
    subband(s, p.resp, p.abertura, p.atualizado);

    // card esquerdo — status detalhado
    card(s, 0.35, 1.62, 6.55, 5.42);
    s.addText("STATUS DETALHADO", { x: 0.62, y: 1.82, w: 4, h: 0.26, fontSize: 11.5, bold: true, color: C.CHOC, fontFace: FONT, margin: 0 });

    const etapas = p.etapas || [];
    const tx = 0.62, ty = 2.18, colW = [2.85, 0.72, 1.45, 1.00];
    const hdrH = 0.32;
    const rowH = Math.min(0.442, Math.max(0.30, 4.42 / Math.max(etapas.length, 1)));
    const rows = [];
    rows.push(["ETAPA", "STATUS", "RESPONSÁVEL", "PREVISTO"].map((t, i) => ({
      text: t, options: { fill: { color: C.CREAM2 }, color: C.CHOC3, fontSize: 8, bold: true, align: i === 1 || i === 3 ? "center" : "left", valign: "middle" },
    })));
    etapas.forEach((e, i) => {
      const f = i % 2 ? C.CREAM3 : C.WHITE;
      const fs = etapas.length > 11 ? 8.5 : 9.5;
      rows.push([
        { text: e.n || "", options: { fill: { color: f }, color: C.CHOC, fontSize: fs, bold: true, align: "left", valign: "middle" } },
        { text: "", options: { fill: { color: f } } },
        { text: e.resp || "—", options: { fill: { color: f }, color: C.CHOC2, fontSize: fs, align: "left", valign: "middle" } },
        { text: e.prev || "—", options: { fill: { color: f }, color: C.CHOC2, fontSize: fs, align: "center", valign: "middle" } },
      ]);
    });
    s.addTable(rows, {
      x: tx, y: ty, w: 6.02, colW, rowH: [hdrH].concat(etapas.map(() => rowH)),
      border: { type: "none" }, margin: [0.01, 0.03, 0.01, 0.07], fontFace: FONT,
    });
    etapas.forEach((e, i) => {
      dot(s, tx + colW[0] + colW[1] / 2, ty + hdrH + rowH * i + rowH / 2, e.st, Math.min(0.235, rowH * 0.62));
    });

    // coluna direita — entram em cascata (grupos 1, 2, 3)
    card(s, 7.10, 1.62, 5.85, 1.66, "av|1");
    iconCircle(s, 7.36, 1.83, C.A, "!", "av|1");
    s.addText("PENDÊNCIAS", { x: 7.73, y: 1.845, w: 4.5, h: 0.26, fontSize: 11.5, bold: true, color: C.AD, fontFace: FONT, margin: 0, objectName: "av|1" });
    let [tp, op] = bulletText(p.pend, 7.46, 2.24, 5.28, 0.95, "av|1"); s.addText(tp, op);

    card(s, 7.10, 3.42, 5.85, 1.66, "av|2");
    iconCircle(s, 7.36, 3.63, C.G, "→", "av|2");
    s.addText("PRÓXIMAS AÇÕES", { x: 7.73, y: 3.645, w: 4.5, h: 0.26, fontSize: 11.5, bold: true, color: C.GD, fontFace: FONT, margin: 0, objectName: "av|2" });
    [tp, op] = bulletText(p.acoes, 7.46, 4.04, 5.28, 0.95, "av|2"); s.addText(tp, op);

    card(s, 7.10, 5.22, 5.85, 1.82, "av|3");
    iconCircle(s, 7.36, 5.43, C.GOLDLT, "✎", "av|3");
    s.addText("OBSERVAÇÕES E COMENTÁRIOS", { x: 7.73, y: 5.445, w: 4.7, h: 0.26, fontSize: 11.5, bold: true, color: C.CHOC, fontFace: FONT, margin: 0, objectName: "av|3" });
    s.addText(p.obs || "—", { x: 7.46, y: 5.85, w: 5.28, h: 1.05, fontSize: 10.5, italic: true, color: C.CHOC2, fontFace: FONT, margin: 0, valign: "top", objectName: "av|3" });

    footer(s, true);
  }

  // frações [x, y, w, h] da área útil, conforme a quantidade de fotos
  function gridFor(n) {
    if (n <= 1) return [[0, 0, 1, 1]];
    if (n === 2) return [[0, 0, .5, 1], [.5, 0, .5, 1]];
    if (n === 3) return [[0, 0, .58, 1], [.58, 0, .42, .5], [.58, .5, .42, .5]];
    if (n === 4) return [[0, 0, .5, .5], [.5, 0, .5, .5], [0, .5, .5, .5], [.5, .5, .5, .5]];
    if (n === 5) return [[0, 0, 1 / 3, .5], [1 / 3, 0, 1 / 3, .5], [2 / 3, 0, 1 / 3, .5], [0, .5, .5, .5], [.5, .5, .5, .5]];
    return [[0, 0, 1 / 3, .5], [1 / 3, 0, 1 / 3, .5], [2 / 3, 0, 1 / 3, .5], [0, .5, 1 / 3, .5], [1 / 3, .5, 1 / 3, .5], [2 / 3, .5, 1 / 3, .5]];
  }

  function slideOrcamento(pptx, p) {
    const s = pptx.addSlide();
    s.background = { color: C.CREAM };
    header(s, "IMAGENS DO PRODUTO & ORÇAMENTO", p.nome || "[ Nome do Projeto ]");

    // ---- card de imagens (esquerda) — grupo 1 ----
    card(s, 0.35, 1.30, 7.55, 5.60, "av|1");
    iconCircle(s, 0.61, 1.52, C.GOLDLT, "◨", "av|1");
    s.addText("IMAGENS DO PRODUTO", { x: 0.98, y: 1.535, w: 4.5, h: 0.26, fontSize: 11.5, bold: true, color: C.CHOC, fontFace: FONT, margin: 0, objectName: "av|1" });

    const imgs = (p.imgs && p.imgs.length ? p.imgs : (p.img ? [p.img] : [])).slice(0, 6);
    const ax = 0.61, ay = 1.98, aw = 7.03, ah = 4.66, gap = 0.14;
    if (imgs.length) {
      const cells = gridFor(imgs.length);
      imgs.forEach((im, i) => {
        const [fxr, fyr, fwr, fhr] = cells[i];
        const cx = ax + fxr * aw + (fxr ? gap / 2 : 0);
        const cy = ay + fyr * ah + (fyr ? gap / 2 : 0);
        const cw = fwr * aw - (fxr + fwr < 1 ? gap / 2 : 0) - (fxr ? gap / 2 : 0);
        const ch = fhr * ah - (fyr + fhr < 1 ? gap / 2 : 0) - (fyr ? gap / 2 : 0);
        s.addShape("roundRect", { rectRadius: 0.06, x: cx, y: cy, w: cw, h: ch, fill: { color: "FDFBF5" }, line: { color: C.LINE, width: 0.75 }, objectName: "av|1" });
        s.addImage({ data: im, x: cx + 0.07, y: cy + 0.07, w: cw - 0.14, h: ch - 0.14, sizing: { type: "contain", w: cw - 0.14, h: ch - 0.14 }, objectName: "av|1" });
      });
    } else {
      s.addShape("roundRect", { rectRadius: 0.10, x: ax, y: ay, w: aw, h: ah, fill: { color: "FDFBF5" }, line: { color: C.GOLDLT, width: 1.25, dashType: "dash" }, objectName: "av|1" });
      const cx = ax + aw / 2;
      s.addShape("roundRect", { rectRadius: 0.18, x: cx - 0.38, y: 3.35, w: 0.76, h: 0.76, fill: { color: C.GOLDLT }, line: NOLINE, objectName: "av|1" });
      s.addShape("ellipse", { x: cx - 0.21, y: 3.49, w: 0.15, h: 0.15, fill: { color: C.WHITE }, line: NOLINE, objectName: "av|1" });
      s.addShape("triangle", { x: cx - 0.23, y: 3.68, w: 0.46, h: 0.32, fill: { color: C.WHITE }, line: NOLINE, objectName: "av|1" });
      s.addText("Espaço para imagens do produto", { x: ax, y: 4.30, w: aw, h: 0.3, fontSize: 13, bold: true, color: C.CHOC, align: "center", fontFace: FONT, margin: 0, objectName: "av|1" });
      s.addText("fotos, mockups, protótipos ou capturas de tela — até 6 por projeto", { x: ax, y: 4.62, w: aw, h: 0.28, fontSize: 9.5, italic: true, color: C.MUTE, align: "center", fontFace: FONT, margin: 0, objectName: "av|1" });
    }

    // ---- card orçamento (direita) — grupo 2 ----
    card(s, 8.10, 1.30, 4.90, 5.60, "av|2");
    iconCircle(s, 8.36, 1.52, C.GOLD, "$", "av|2");
    s.addText("ORÇAMENTO", { x: 8.73, y: 1.535, w: 3.5, h: 0.26, fontSize: 11.5, bold: true, color: C.CHOC, fontFace: FONT, margin: 0, objectName: "av|2" });

    const o = p.orc || {};
    const fx = 8.38, fw = 4.34;
    // KPIs lado a lado
    const kw = (fw - 0.18) / 2;
    [["CUSTO ESTIMADO", o.estimado || "R$ —", C.CHOC, C.CREAM2, C.LINE],
     ["CUSTO REAL", o.real || "R$ —", C.GD, "EDF5EB", "CFE3CB"]].forEach(([lab, val, vc, bg, ln], i) => {
      const kx = fx + i * (kw + 0.18);
      s.addShape("roundRect", { rectRadius: 0.07, x: kx, y: 1.96, w: kw, h: 0.92, fill: { color: bg }, line: { color: ln, width: 0.75 }, objectName: "av|2" });
      s.addText(lab, { x: kx + 0.13, y: 2.08, w: kw - 0.2, h: 0.18, fontSize: 7.5, bold: true, color: C.MUTE, fontFace: FONT, margin: 0, charSpacing: 1, objectName: "av|2" });
      s.addText(val, { x: kx + 0.13, y: 2.30, w: kw - 0.2, h: 0.42, fontSize: val.length > 14 ? 13 : 16, bold: true, color: vc, fontFace: FONT, margin: 0, valign: "middle", objectName: "av|2" });
    });
    // campos
    let fy = 3.08;
    for (const [lab, val] of [["FORNECEDOR(ES)", o.fornecedor || "—"], ["APROVAÇÃO", o.aprovacao || "—"]]) {
      s.addText(lab, { x: fx, y: fy, w: fw, h: 0.18, fontSize: 8, bold: true, color: C.MUTE, fontFace: FONT, margin: 0, charSpacing: 1, objectName: "av|2" });
      s.addText(val, { shape: "roundRect", rectRadius: 0.055, x: fx, y: fy + 0.21, w: fw, h: 0.36, fill: { color: "FDFBF5" }, line: { color: C.LINE, width: 0.75 }, fontSize: 10.5, bold: true, color: C.CHOC2, align: "left", valign: "middle", margin: [2, 4, 2, 10], fontFace: FONT, objectName: "av|2" });
      fy += 0.74;
    }
    // observações
    s.addText("OBSERVAÇÕES SOBRE O ORÇAMENTO", { x: fx, y: fy + 0.02, w: fw, h: 0.18, fontSize: 8, bold: true, color: C.MUTE, fontFace: FONT, margin: 0, charSpacing: 1, objectName: "av|2" });
    const oh = 6.72 - (fy + 0.25);
    s.addText(o.obs || "—", { shape: "roundRect", rectRadius: 0.07, x: fx, y: fy + 0.25, w: fw, h: oh, fill: { color: C.OBS_BG }, line: { color: C.OBS_LN, width: 0.75 }, fontSize: 10, color: C.CHOC2, align: "left", valign: "top", margin: [6, 6, 6, 13], fontFace: FONT, objectName: "av|2" });
    s.addShape("rect", { x: fx, y: fy + 0.25, w: 0.055, h: oh, fill: { color: C.GOLDLT }, line: NOLINE, objectName: "av|2" });

    footer(s, false);
  }

  function slideCapa(pptx, ciclo) {
    const s = pptx.addSlide();
    s.background = { color: C.CHOC };
    if (CAPA && CAPA.BG) {
      s.addImage({ data: CAPA.BG, x: 0, y: 0, w: 13.333, h: 7.5 });
    } else {
      s.addShape("ellipse", { x: 10.4, y: -1.6, w: 4.6, h: 4.6, fill: { color: "4A2E1E" }, line: NOLINE });
      s.addShape("ellipse", { x: 11.5, y: 5.3, w: 3.4, h: 3.4, fill: { color: "472B1C" }, line: NOLINE });
    }
    s.addShape("rect", { x: 0, y: 7.34, w: 13.333, h: 0.16, fill: { color: C.GOLD }, line: NOLINE });
    s.addText("P & D   ·   P E S Q U I S A   &   D E S E N V O L V I M E N T O", { x: 0.95, y: 1.55, w: 10, h: 0.35, fontSize: 12, bold: true, color: C.GOLDLT, fontFace: FONT, margin: 0, objectName: "av|1" });
    s.addText("Acompanhamento\nde Projetos", { x: 0.92, y: 2.0, w: 11, h: 1.9, fontSize: 45, bold: true, color: C.WHITE, fontFace: FONT, margin: 0, valign: "top", objectName: "av|2" });
    s.addText("Status do portfólio de novos produtos — andamento, pendências e próximos passos, projeto a projeto.", { x: 0.95, y: 4.05, w: 8.6, h: 0.75, fontSize: 15, color: C.CREAMTXT, fontFace: FONT, margin: 0, objectName: "av|3" });
    s.addText("Reunião  ·  " + (ciclo || ""), { shape: "roundRect", rectRadius: 0.26, x: 0.95, y: 5.0, w: 3.3, h: 0.52, fill: { color: C.CHOC }, line: { color: C.GOLD, width: 1.25 }, fontSize: 13, bold: true, color: "F4E6CC", align: "center", valign: "middle", margin: 0, fontFace: FONT, objectName: "av|4" });
    if (LOGO && LOGO.WORDMARK) {
      const lh = 1.0, lw = lh * LOGO.WM_AR;
      s.addImage({ data: LOGO.WORDMARK, x: 0.92, y: 5.85, w: lw, h: lh, objectName: "av|5" });
      s.addText("CHOCOLATE DE VERDADE", { x: 0.92, y: 6.95, w: lw, h: 0.3, fontSize: 9.5, bold: true, color: C.CREAMTXT, fontFace: FONT, margin: 0, align: "center", charSpacing: 3, objectName: "av|5" });
    } else {
      s.addText("Divine", { x: 0.92, y: 6.05, w: 4, h: 0.85, fontSize: 38, bold: true, italic: true, color: C.GOLDLT, fontFace: SCRIPT, margin: 0, objectName: "av|5" });
      s.addText("C H O C O L A T E   D E   V E R D A D E", { x: 0.98, y: 6.92, w: 5, h: 0.3, fontSize: 9.5, bold: true, color: C.CREAMTXT, fontFace: FONT, margin: 0, objectName: "av|5" });
    }
  }

  function build(PptxGenJS, state) {
    const pptx = new PptxGenJS();
    pptx.defineLayout({ name: "W16x9", width: 13.333, height: 7.5 });
    pptx.layout = "W16x9";
    pptx.author = "Divine Chocolates — P&D";
    pptx.title = "Acompanhamento de Projetos";
    slideCapa(pptx, state.ciclo);
    for (const p of state.projects) {
      slideAcompanhamento(pptx, p);
      slideOrcamento(pptx, p);
    }
    return pptx;
  }

  return { build, STATUS_GERAL };
});
