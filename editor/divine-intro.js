/* NOTA DE INTEGRACAO (Divine P&D)
 * Unica alteracao em relacao ao arquivo original do produtor:
 *   TAG_TOP passou a aceitar CFG.tagTop (padrao 0.821 = comportamento original).
 * Motivo: afastar a tagline da caligrafia sem mexer na arte nem na linha do tempo.
 * Nenhuma outra linha foi tocada.
 */
/* ============================================================================
 * DIVINE — ANIMAÇÃO DE ENTRADA  ·  v1.0
 * ----------------------------------------------------------------------------
 * Arquivo único, autossuficiente. Cria o próprio overlay, os próprios estilos
 * e se remove sozinho no fim. Não depende de biblioteca nenhuma.
 *
 * USO MÍNIMO — uma linha no final do <body> do index.html:
 *     <script src="divine-intro.js"></script>
 *
 * O script precisa de dois arquivos de imagem na MESMA pasta do index.html:
 *     divine-word.png       (a caligrafia "Divine")
 *     divine-tagline.png    ("Chocolate de Verdade")
 *
 * COMO TERMINA: a caligrafia voa até o logo do topbar e para EXATAMENTE em
 * cima dele. No último quadro o overlay some e o logo real do topbar assume o
 * lugar, já com a página inteira carregada e utilizável atrás. Não existe
 * "corte" — o usuário não percebe a troca.
 *
 * Configuração opcional: defina window.DIVINE_INTRO ANTES desta tag <script>.
 * Veja o bloco CFG abaixo para todas as opções.
 * ========================================================================== */
(function () {
  'use strict';

  var CFG = Object.assign({
    /* Seletor do elemento onde a caligrafia deve POUSAR (o logo do topbar).
       Precisa ser um elemento que já exista no HTML e tenha tamanho real. */
    target: '#logoTop',

    /* Caminhos das imagens. Ajuste se você guardar em /static/img/ etc. */
    word: 'divine-word.png',
    tagline: 'divine-tagline.png',

    /* Duração total em segundos. 4.4 é o ritmo aprovado. */
    duration: 4.4,

    /* Zoom inicial da "câmera". 1 = sem zoom. */
    zoom: 1.22,

    /* Fundo do overlay. Por padrão o marrom da marca. */
    background: 'radial-gradient(120% 100% at 22% 12%,#7A4426 0%,#4D271A 38%,#2A1509 72%,#1B0D07 100%)',

    /* true  = toca uma vez por sessão do navegador (recomendado em produção)
       false = toca em todo carregamento (útil enquanto você ajusta) */
    oncePerSession: true,

    /* Chave do sessionStorage. Troque para forçar todo mundo a ver de novo. */
    storageKey: 'divine_intro_v1',

    /* Mostra o botão "Pular" depois de ~0,9 s. */
    skipButton: true,

    /* Expõe window.divineIntro.replay() para você testar pelo console. */
    debug: false
  }, window.DIVINE_INTRO || {});

  /* --- proporções reais das duas imagens (não mexer) ---------------------- */
  var WORD_AR = 3.1761;      /* largura / altura da caligrafia               */
  var TAG_AR = 7.3155;       /* largura / altura do "Chocolate de Verdade"   */
  var LOCK_AR = 2.6275;      /* largura / altura do conjunto completo        */
  var TAG_TOP = (CFG.tagTop != null ? CFG.tagTop : 0.821);  /* topo da tagline (ajustavel via CFG) */
  var TAG_W = 0.9983;        /* largura da tagline, em fração da largura     */

  /* --- linha do tempo, em ms sobre uma base de 4400 ms -------------------- */
  var T = {
    glow:    [140, 1180],
    write:   [420, 2680],
    tag:     [2500, 3160],
    zoom:    [0, 3060],
    flight:  [3200, 3900],   /* a caligrafia viaja até o topbar              */
    tagOut:  [3140, 3520],   /* a tagline sai antes: não cabe num logo 40px  */
    veilOut: [3340, 4020],   /* o palco escuro se dissolve na página         */
    skipIn:  [900, 1240],
    swap:    4150,           /* troca overlay -> logo real do topbar         */
    end:     4450
  };

  /* ======================================================================= */
  /* easing                                                                   */
  /* ======================================================================= */
  function bez(x1, y1, x2, y2) {
    var cx = function (t) { return 3 * x1 * t * (1 - t) * (1 - t) + 3 * x2 * t * t * (1 - t) + t * t * t; };
    var cy = function (t) { return 3 * y1 * t * (1 - t) * (1 - t) + 3 * y2 * t * t * (1 - t) + t * t * t; };
    var dx = function (t) { return 3 * x1 * (1 - 4 * t + 3 * t * t) + 3 * x2 * t * (2 - 3 * t) + 3 * t * t; };
    return function (p) {
      if (p <= 0) return 0;
      if (p >= 1) return 1;
      var t = p, i, e, d;
      for (i = 0; i < 6; i++) {
        e = cx(t) - p; d = dx(t);
        if (Math.abs(e) < 1e-5 || Math.abs(d) < 1e-6) break;
        t -= e / d;
      }
      return cy(Math.max(0, Math.min(1, t)));
    };
  }
  var E = {
    write: bez(0.5, 0.03, 0.24, 1),   /* ritmo da caneta: acelera e assenta  */
    zoom:  bez(0.24, 0.66, 0.06, 1),
    glide: bez(0.42, 0.02, 0.16, 1),  /* o voo até o topbar                  */
    soft:  bez(0.4, 0, 0.25, 1),
    fade:  bez(0.4, 0, 0.6, 1)
  };

  /* ======================================================================= */
  /* montagem do overlay                                                      */
  /* ======================================================================= */
  var el = {};

  function build() {
    var veil = document.createElement('div');
    veil.id = 'divine-intro';
    veil.setAttribute('aria-hidden', 'true');
    veil.style.cssText =
      'position:fixed;inset:0;z-index:99999;overflow:hidden;' +
      'contain:strict;pointer-events:auto';

    var bg = document.createElement('div');
    bg.style.cssText = 'position:absolute;inset:0;background:' + CFG.background + ';will-change:opacity';

    var warm = document.createElement('div');
    warm.style.cssText =
      'position:absolute;inset:-20%;pointer-events:none;' +
      'background:radial-gradient(circle at 26% 20%,rgba(217,178,106,.16),rgba(217,178,106,0) 46%)';

    var grain = document.createElement('div');
    grain.style.cssText =
      'position:absolute;inset:0;opacity:.5;pointer-events:none;' +
      'background-image:radial-gradient(rgba(255,232,190,.055) 1px,transparent 1px);background-size:4px 4px';

    var vign = document.createElement('div');
    vign.style.cssText =
      'position:absolute;inset:0;pointer-events:none;' +
      'background:radial-gradient(ellipse 82% 72% at 50% 50%,rgba(0,0,0,0) 42%,rgba(12,6,3,.55) 100%)';

    bg.appendChild(warm); bg.appendChild(grain); bg.appendChild(vign);

    var glow = document.createElement('div');
    glow.style.cssText =
      'position:absolute;left:50%;top:50%;width:min(160vw,1500px);height:min(90vw,820px);' +
      'transform:translate(-50%,-50%) scale(.9);opacity:0;pointer-events:none;' +
      'mix-blend-mode:screen;will-change:opacity,transform;' +
      'background:radial-gradient(ellipse 50% 50% at 50% 50%,rgba(240,224,176,.2),rgba(217,178,106,.09) 40%,rgba(30,15,9,0) 70%)';

    var stage = document.createElement('div');
    stage.style.cssText =
      'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);will-change:transform';

    var wordBox = document.createElement('div');
    wordBox.style.cssText = 'position:absolute;left:0;top:0;width:100%;will-change:transform,opacity';

    var word = document.createElement('img');
    word.src = CFG.word;
    word.alt = 'Divine';
    word.draggable = false;
    word.style.cssText = 'display:block;width:100%;height:100%;object-fit:contain;will-change:mask-image,filter';

    var nib = document.createElement('div');   /* o brilho na ponta da caneta */
    nib.style.cssText =
      'position:absolute;top:-8%;bottom:-8%;width:5.5%;transform:translateX(-50%);opacity:0;' +
      'pointer-events:none;mix-blend-mode:screen;will-change:transform,opacity;' +
      'background:radial-gradient(ellipse 46% 50% at 50% 50%,rgba(255,246,222,.85),rgba(240,214,150,.32) 45%,rgba(240,214,150,0) 72%)';

    wordBox.appendChild(word); wordBox.appendChild(nib);

    var tagBox = document.createElement('div');
    tagBox.style.cssText = 'position:absolute;opacity:0;will-change:opacity,transform';

    var tag = document.createElement('img');
    tag.src = CFG.tagline;
    tag.alt = 'Chocolate de Verdade';
    tag.draggable = false;
    tag.style.cssText = 'display:block;width:100%;height:100%;object-fit:contain;filter:brightness(1.55) saturate(.82)';
    tagBox.appendChild(tag);

    stage.appendChild(wordBox); stage.appendChild(tagBox);
    veil.appendChild(bg); veil.appendChild(glow); veil.appendChild(stage);

    var skip = null;
    if (CFG.skipButton) {
      skip = document.createElement('button');
      skip.type = 'button';
      skip.textContent = 'Pular';
      skip.style.cssText =
        'position:absolute;left:50%;bottom:clamp(22px,4.6vh,52px);transform:translateX(-50%);opacity:0;' +
        'font:500 10px/1 "Segoe UI",system-ui,sans-serif;letter-spacing:.2em;text-transform:uppercase;' +
        'color:rgba(240,224,176,.5);background:transparent;border:1px solid rgba(217,178,106,.24);' +
        'border-radius:999px;padding:9px 20px 8px;cursor:pointer;pointer-events:none;' +
        'transition:color .4s,border-color .4s';
      skip.addEventListener('mouseenter', function () {
        skip.style.color = '#F0E0B0'; skip.style.borderColor = 'rgba(217,178,106,.6)';
      });
      skip.addEventListener('mouseleave', function () {
        skip.style.color = 'rgba(240,224,176,.5)'; skip.style.borderColor = 'rgba(217,178,106,.24)';
      });
      veil.appendChild(skip);
    }

    document.body.appendChild(veil);
    el = { veil: veil, bg: bg, glow: glow, stage: stage, wordBox: wordBox, word: word, nib: nib, tagBox: tagBox, skip: skip };
  }

  /* ======================================================================= */
  /* geometria — recalculada a cada quadro, então é responsivo de verdade     */
  /* ======================================================================= */
  var G = {};

  function layout() {
    var vw = window.innerWidth, vh = window.innerHeight;
    var w = Math.min(Math.max(280, vw * 0.52), 720, vh * 1.5);
    var h = w / LOCK_AR;
    G.w = w; G.h = h;
    G.wordH = w / WORD_AR;
    el.stage.style.width = w + 'px';
    el.stage.style.height = h + 'px';
    el.wordBox.style.height = G.wordH + 'px';
    el.tagBox.style.left = ((1 - TAG_W) / 2 * 100) + '%';
    el.tagBox.style.top = (TAG_TOP * 100) + '%';
    el.tagBox.style.width = (TAG_W * 100) + '%';
    el.tagBox.style.height = (w * TAG_W / TAG_AR) + 'px';
    /* centro da caligrafia quando o palco está sem transformação nenhuma */
    G.cx = vw / 2;
    G.cy = vh / 2 - h / 2 + G.wordH / 2;
  }

  /* destino do voo: o logo real do topbar */
  function flightTarget() {
    var t = document.querySelector(CFG.target);
    if (!t) return null;
    var r = t.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    return {
      dx: (r.left + r.width / 2) - G.cx,
      dy: (r.top + r.height / 2) - G.cy,
      s: r.width / G.w
    };
  }

  /* ======================================================================= */
  /* motor                                                                    */
  /* ======================================================================= */
  var t0 = 0, raf = 0, rate = 1, k = 1, done = false, targetEl = null;

  function frame(t) {
    var S = function (a, b, ease) {
      var p = b <= a ? 1 : Math.max(0, Math.min(1, (t - a * k) / ((b - a) * k)));
      return ease ? ease(p) : p;
    };
    layout();

    /* luz morna subindo atrás da caligrafia */
    var gp = S(T.glow[0], T.glow[1], E.soft);
    var vo = S(T.veilOut[0], T.veilOut[1], E.fade);
    el.glow.style.opacity = (0.92 * gp * (1 - vo)).toFixed(3);
    el.glow.style.transform = 'translate(-50%,-50%) scale(' + (0.9 + 0.16 * gp).toFixed(3) + ')';

    /* a caligrafia se escreve — um traço contínuo da esquerda para a direita */
    var wp = S(T.write[0], T.write[1], E.write);
    if (wp >= 1) {
      el.word.style.maskImage = 'none';
      el.word.style.webkitMaskImage = 'none';
      el.word.style.filter = 'none';
      el.nib.style.opacity = '0';
    } else {
      var e = -0.06 + wp * 1.14, s = 0.045;
      var g = 'linear-gradient(to right,#000 ' + ((e - s) * 100).toFixed(2) + '%,rgba(0,0,0,0) ' + ((e + s) * 100).toFixed(2) + '%)';
      el.word.style.maskImage = g;
      el.word.style.webkitMaskImage = g;
      el.word.style.filter = 'brightness(' + (1 + 0.1 * (1 - wp)).toFixed(3) + ')';
      el.nib.style.left = (e * 100).toFixed(2) + '%';
      el.nib.style.opacity = (0.95 * (wp < 0.04 ? wp / 0.04 : (wp > 0.94 ? (1 - wp) / 0.06 : 1))).toFixed(3);
    }

    /* a tagline assenta depois que a caneta levanta, e sai antes do voo */
    var tp = S(T.tag[0], T.tag[1], E.soft) * (1 - S(T.tagOut[0], T.tagOut[1], E.fade));
    el.tagBox.style.opacity = tp.toFixed(3);
    el.tagBox.style.transform = 'translateY(' + ((1 - S(T.tag[0], T.tag[1], E.soft)) * -6).toFixed(2) + '%)';

    /* câmera: um único afastamento sem pressa */
    var zp = S(T.zoom[0], T.zoom[1], E.zoom);
    el.stage.style.transform = 'translate(-50%,-50%) scale(' + (CFG.zoom - (CFG.zoom - 1) * zp).toFixed(4) + ')';

    /* o voo: a caligrafia vai parar exatamente em cima do logo do topbar */
    var hp = S(T.flight[0], T.flight[1], E.glide);
    if (hp > 0) {
      var f = flightTarget();
      if (f) {
        el.wordBox.style.transform =
          'translate(' + (f.dx * hp).toFixed(2) + 'px,' + (f.dy * hp).toFixed(2) + 'px) ' +
          'scale(' + (1 + (f.s - 1) * hp).toFixed(4) + ')';
      }
    } else {
      el.wordBox.style.transform = 'none';
    }

    /* o palco escuro se dissolve e revela a página, que já está pronta */
    el.bg.style.opacity = (1 - vo).toFixed(3);
    if (vo >= 1) el.veil.style.pointerEvents = 'none';

    if (el.skip) {
      var kp = S(T.skipIn[0], T.skipIn[1], E.soft) * (1 - S(T.flight[0] - 200, T.flight[0], E.soft));
      el.skip.style.opacity = kp.toFixed(3);
      el.skip.style.pointerEvents = kp > 0.5 ? 'auto' : 'none';
    }

    /* troca seca: as duas camadas são idênticas, então cross-fade só lavaria */
    if (t >= T.swap * k) {
      if (targetEl) targetEl.style.visibility = '';
      el.stage.style.opacity = '0';
    }
  }

  function tick(now) {
    if (!t0) t0 = now;
    var t = (now - t0) * rate;
    /* rate>1 (botão Pular) precisa de tempo acumulado, não escalado na origem */
    frame(Math.min(t, T.end * k));
    if (t < T.end * k) raf = requestAnimationFrame(tick);
    else finish();
  }

  function finish() {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    if (targetEl) targetEl.style.visibility = '';
    if (el.veil && el.veil.parentNode) el.veil.parentNode.removeChild(el.veil);
    document.documentElement.style.overflow = '';
    try { sessionStorage.setItem(CFG.storageKey, '1'); } catch (err) {}
  }

  function start() {
    build();
    targetEl = document.querySelector(CFG.target);
    /* esconde o logo real (sem tirar do fluxo — o layout não pode pular) */
    if (targetEl) targetEl.style.visibility = 'hidden';
    layout();
    k = CFG.duration / 4.4;

    if (el.skip) {
      el.skip.addEventListener('click', function () {
        /* acelera o restante em vez de cortar: um corte seco parece um bug */
        rate = 6;
      });
    }
    window.addEventListener('resize', layout, { passive: true });

    /* só começa com as duas imagens já decodificadas: sem primeiro quadro vazio */
    var imgs = [el.word, el.tagBox.firstChild];
    Promise.all(imgs.map(function (im) {
      return im.decode ? im.decode().catch(function () {}) : Promise.resolve();
    })).then(function () {
      raf = requestAnimationFrame(tick);
    });

    if (CFG.debug) {
      window.divineIntro = {
        replay: function () { finishHard(); start(); },
        seek: function (ms) { cancelAnimationFrame(raf); frame(ms); }
      };
    }
  }

  function finishHard() {
    done = false; t0 = 0; rate = 1;
    cancelAnimationFrame(raf);
    if (el.veil && el.veil.parentNode) el.veil.parentNode.removeChild(el.veil);
  }

  /* ======================================================================= */
  /* gatilho                                                                  */
  /* ======================================================================= */
  function boot() {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var seen = false;
    try { seen = sessionStorage.getItem(CFG.storageKey) === '1'; } catch (err) {}
    if (reduce || (CFG.oncePerSession && seen)) {
      try { sessionStorage.setItem(CFG.storageKey, '1'); } catch (err) {}
      return;   /* a página aparece normalmente, sem overlay nenhum */
    }
    start();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
