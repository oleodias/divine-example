/* Divine — sincronização com a nuvem (Supabase) · Fase 1
 *
 * Dois modos:
 *   "nuvem" → login com e-mail e senha; portfólio da EQUIPE salvo no Supabase.
 *   "local" → só neste navegador, exatamente como antes (garantia offline).
 *
 * O editor continua trabalhando com o mesmo `state` ({ ciclo, sel, projects }).
 * Este módulo só compara o `state` com o que já está na nuvem e envia/recebe
 * as diferenças. Campos auxiliares de cada projeto começam com "_" (_id,
 * _versao, _por, _em) e NUNCA vão para a exportação JSON — o formato do
 * backup continua idêntico ao da v1.2.
 */
(function () {
  "use strict";
  const CFG = {
    url: "https://osqibajvwoxzdugdwygn.supabase.co",
    key: "sb_publishable_5UtARpzra6IMw6AwGPmL3A_zhqN6FzY",   // chave pública: a proteção está nas regras do banco
  };
  const K_MODO = "divine_modo";                 // "nuvem" | "local"
  const K_CACHE = "divine_editor_nuvem_v1";     // cópia local do portfólio da equipe
  const K_META = "divine_nuvem_meta";           // o que já foi sincronizado (sobrevive a recarregar offline)
  const K_LOCAL = "divine_editor_v1";           // dados do modo "só neste computador"
  const INTERVALO = 30000;                      // busca alterações da equipe a cada 30s

  let sb = null, usuario = null, nomeMembro = "";
  let meta = { snap: {}, ciclo: null, ultimo: null, pronto: false, eventos: [] };
  let etapasCache = {};   // projeto_id -> { quando, mapa: { etapa: "Concluída por X em …" } }
  let timer = null, rodando = false, denovo = false, formAtrasado = false;
  let agendado = false;   // há um envio esperando os 0,7s
  let saindo = false;     // aba escondida/fechando: envios pequenos usam keepalive

  /* ---------------- utilidades ---------------- */
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  };
  function modo() { return ls.get(K_MODO); }
  function setModo(m) { if (m) ls.set(K_MODO, m); else ls.del(K_MODO); }
  function ativo() { return modo() === "nuvem" && !!usuario; }
  // projeto sem os campos auxiliares — é isso que vai para a nuvem e para o JSON
  function limpa(p) { const o = {}; for (const k in p) if (k[0] !== "_") o[k] = p[k]; return o; }
  // "atualizado" muda só de abrir o projeto; não conta como edição
  function hash(p) {
    const o = limpa(p); delete o.atualizado;
    const s = JSON.stringify(o);
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36) + ":" + s.length;
  }
  function salvaMeta() { ls.set(K_META, JSON.stringify(meta)); }
  function carregaMeta() {
    try { const m = JSON.parse(ls.get(K_META)); if (m && m.snap) meta = Object.assign(meta, m); } catch (e) {}
  }
  function erroDeRede(e) {
    const m = String((e && (e.message || e)) || "");
    return !navigator.onLine || /fetch|network|Failed|timeout|abort/i.test(m);
  }
  function fmtQuando(iso) {
    if (!iso) return "";
    const d = new Date(iso), z = n => String(n).padStart(2, "0");
    return z(d.getDate()) + "/" + z(d.getMonth() + 1) + " às " + z(d.getHours()) + ":" + z(d.getMinutes());
  }
  function editando() {
    const a = document.activeElement;
    return a && a.closest && a.closest(".main") && /INPUT|TEXTAREA|SELECT/.test(a.tagName);
  }

  /* ---------------- indicador de status ---------------- */
  function status(tipo, texto) {
    const el = document.getElementById("nuvemStatus");
    if (!el) return;
    el.className = "nstatus " + tipo;
    el.querySelector("span").textContent = texto;
    el.title = tipo === "off" ? texto + ": sem conexão com a nuvem. Tudo continua salvo neste computador e será enviado automaticamente." : texto;
  }
  function pintaTopo() {
    const area = document.getElementById("nuvemArea");
    if (!area) return;
    if (ativo()) {
      area.innerHTML = `<div class="nstatus ok" id="nuvemStatus"><i></i><span>Salvo na nuvem</span></div>
        <button class="btn ghost sm nuser" onclick="Nuvem.menu(event)" aria-haspopup="true">
          <span class="av">${(nomeMembro || usuario.email || "?").trim().charAt(0).toUpperCase()}</span>${esc(nomeMembro || usuario.email)}</button>`;
    } else if (sb) {
      area.innerHTML = `<div class="nstatus local"><i></i><span>Só neste computador</span></div>
        <button class="btn ghost sm" onclick="Nuvem.entrar()">Entrar na nuvem</button>`;
    } else area.innerHTML = "";
    const bh = document.getElementById("btnHist"); if (bh) bh.hidden = !ativo();
  }

  /* ---------------- janelas (modal) ---------------- */
  function modal(html, opts) {
    fechaModal();
    const ov = document.createElement("div");
    ov.className = "nmodal-ov" + (opts && opts.login ? " login" : "");
    ov.id = "nmodal";
    ov.innerHTML = `<div class="nmodal" role="dialog" aria-modal="true">${html}</div>`;
    if (!(opts && opts.fixo)) {
      ov.addEventListener("mousedown", e => { if (e.target === ov) fechaModal(); });
      ov.addEventListener("keydown", e => { if (e.key === "Escape") fechaModal(); });
    }
    document.body.appendChild(ov);
    const f = ov.querySelector("input,button"); if (f) setTimeout(() => f.focus(), 30);
    return ov;
  }
  function fechaModal() { const m = document.getElementById("nmodal"); if (m) m.remove(); }

  /* ---------------- login ---------------- */
  function telaLogin(msg) {
    const logo = (window.DivineIntroAssets && DivineIntroAssets.WORD) || (window.DivineLogo && DivineLogo.WORDMARK) || "";
    const ov = modal(`
      <form class="nlogin" onsubmit="return false">
        ${logo ? `<img src="${logo}" alt="Divine" class="nlogo">` : `<div class="nlogo-txt">Divine</div>`}
        <h2>Acompanhamento de Projetos</h2>
        <p class="nsub">Entre com o seu e-mail e senha da equipe de P&amp;D.</p>
        <label class="fl" for="nl_email">E-mail</label>
        <input type="text" id="nl_email" autocomplete="username" inputmode="email" spellcheck="false">
        <label class="fl" for="nl_senha" style="margin-top:12px">Senha</label>
        <input type="password" id="nl_senha" autocomplete="current-password">
        <div class="nerro" id="nl_erro" role="alert">${msg ? esc(msg) : ""}</div>
        <button class="btn primary nfull" id="nl_btn" type="submit">Entrar</button>
        <p class="ndica">Esqueceu a senha? Fale com o administrador do editor.</p>
        <button class="btn link nlocal" type="button" id="nl_local">Usar sem login — só neste computador</button>
      </form>`, { fixo: true, login: true });
    const btn = ov.querySelector("#nl_btn"), erro = ov.querySelector("#nl_erro");
    ov.querySelector("form").addEventListener("submit", async () => {
      const email = ov.querySelector("#nl_email").value.trim(), senha = ov.querySelector("#nl_senha").value;
      if (!email || !senha) { erro.textContent = "Preencha e-mail e senha."; return; }
      btn.disabled = true; btn.textContent = "Entrando…"; erro.textContent = "";
      try {
        const { data, error } = await sb.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
        usuario = data.user;
        fechaModal();
        await aposLogin();
      } catch (e) {
        erro.textContent = erroDeRede(e) ? "Sem conexão com a nuvem. Tente de novo ou use sem login."
          : /invalid/i.test(e.message || "") ? "E-mail ou senha incorretos." : "Não foi possível entrar: " + (e.message || e);
        btn.disabled = false; btn.textContent = "Entrar";
      }
    });
    ov.querySelector("#nl_local").addEventListener("click", usarLocal);
  }
  function usarLocal() {
    fechaModal();
    setModo("local"); usuario = null;
    state = load(); render(true);
    pintaTopo();
    toast("Usando só neste computador. Você pode entrar na nuvem quando quiser.");
  }

  async function carregaNome() {
    try {
      const { data } = await sb.from("membros").select("nome").eq("user_id", usuario.id).maybeSingle();
      nomeMembro = (data && data.nome) || "";
    } catch (e) {}
  }

  async function aposLogin() {
    const vinhaDoLocal = modo() !== "nuvem";
    setModo("nuvem");
    carregaMeta();
    if (vinhaDoLocal) {             // começa do zero: a cópia local da nuvem será montada pelo servidor
      meta = { snap: {}, ciclo: null, ultimo: null, pronto: false, eventos: [] };
      state = { ciclo: "", sel: 0, projects: [novoProjeto("Carregando…")] };
      render(true);
    }
    await carregaNome();
    pintaTopo();
    status("sync", "Sincronizando…");
    try {
      if (!meta.pronto) await primeiraCarga(vinhaDoLocal);
      await sincronizar();
    } catch (e) { status("off", "Offline"); }
    iniciaCiclo();
  }

  /* primeira vez neste navegador: traz tudo da nuvem (ou oferece enviar os dados locais) */
  async function primeiraCarga() {
    const { data, error } = await sb.from("projetos")
      .select("id,dados,ordem,versao,atualizado_em,atualizado_por_nome").is("excluido_em", null).order("ordem");
    if (error) throw error;
    const cfg = await sb.from("config").select("ciclo").eq("id", 1).maybeSingle();
    if (cfg.error) throw cfg.error;
    meta = { snap: {}, ciclo: null, ultimo: null, pronto: true, eventos: (meta.eventos || []) };
    if (!data.length) {
      let local = null;
      try { local = JSON.parse(ls.get(K_LOCAL)); } catch (e) {}
      const n = local && local.projects ? local.projects.length : 0;
      const enviar = n && await pergunta("Enviar o portfólio para a nuvem?",
        `O portfólio da equipe na nuvem ainda está vazio. Este navegador tem <b>${n} projeto${n > 1 ? "s" : ""}</b>
         salvos. Deseja enviá-los para a nuvem e compartilhar com a equipe?<br><br>
         <span class="nsub">Dica: antes, faça um <b>Exportar dados</b> como backup.</span>`,
        "Enviar para a nuvem", "Começar vazio");
      if (enviar) {
        state = migrate(JSON.parse(JSON.stringify(local)));
        state.projects.forEach(p => { for (const k in p) if (k[0] === "_") delete p[k]; });
        state.sel = 0;
      } else state = { ciclo: (cfg.data && cfg.data.ciclo) || "", sel: 0, projects: [novoProjeto()] };
      meta.ciclo = (cfg.data && cfg.data.ciclo) || "";
    } else {
      state = { ciclo: (cfg.data && cfg.data.ciclo) || "", sel: 0, projects: data.map(linhaParaProjeto) };
      migrate(state);
      data.forEach(r => { meta.snap[r.id] = { h: hash(r.dados), o: r.ordem, v: r.versao }; });
      meta.ciclo = state.ciclo;
      meta.ultimo = maxData(data);
    }
    salvaLocal(); salvaMeta(); render(true);
  }

  function linhaParaProjeto(r) {
    const p = JSON.parse(JSON.stringify(r.dados));
    p._id = r.id; p._versao = r.versao; p._por = r.atualizado_por_nome; p._em = r.atualizado_em;
    return p;
  }
  function maxData(rows) { return rows.reduce((m, r) => (!m || r.atualizado_em > m ? r.atualizado_em : m), meta.ultimo); }
  function salvaLocal() { ls.set(K_CACHE, JSON.stringify(state)); }

  /* ---------------- sincronização ---------------- */
  function agendar(ms) {
    if (!ativo() || !meta.pronto) return;
    clearTimeout(timer); agendado = true;
    timer = setTimeout(sincronizar, ms == null ? 700 : ms);
    status("sync", "Salvando…");
  }
  /* envia já, sem esperar os 0,7s (ao trocar de aba, minimizar ou fechar) */
  function enviarAgora() {
    if (!ativo() || !meta.pronto || !(agendado || rodando || temPendencia())) return;
    clearTimeout(timer); sincronizar();
  }
  /* há algo no computador que a nuvem ainda não recebeu? */
  function temPendencia() {
    if (!ativo() || !meta.pronto) return false;
    if (agendado || rodando) return true;
    if ((state.ciclo || "") !== (meta.ciclo || "")) return true;
    const ids = new Set();
    for (const p of state.projects) {
      if (!p._id) return true;
      ids.add(p._id);
      const s = meta.snap[p._id];
      if (!s || s.h !== hash(p)) return true;
    }
    return Object.keys(meta.snap).some(id => !ids.has(id));
  }
  async function sincronizar() {
    if (!ativo() || !meta.pronto) return;
    if (rodando) { denovo = true; return; }
    rodando = true; agendado = false;
    try {
      await enviar();
      await enviarEventos();
      await receber();
      status("ok", "Salvo na nuvem");
    } catch (e) {
      status("off", erroDeRede(e) ? "Offline" : "Erro ao sincronizar");
      if (!erroDeRede(e)) console.warn("[Nuvem]", e);
      clearTimeout(timer); timer = setTimeout(sincronizar, 15000);   // tenta de novo sozinho
    } finally {
      rodando = false;
      if (denovo) { denovo = false; agendar(300); }
    }
  }

  async function enviar() {
    const lista = state.projects;
    const ids = new Set();
    for (let i = 0; i < lista.length; i++) {
      const p = lista[i];
      if (!p._id) {                                            // projeto novo
        const { data, error } = await sb.from("projetos").insert({ dados: limpa(p), ordem: i })
          .select("id,versao,atualizado_em,atualizado_por_nome").single();
        if (error) throw error;
        Object.assign(p, { _id: data.id, _versao: data.versao, _por: data.atualizado_por_nome, _em: data.atualizado_em });
        meta.snap[data.id] = { h: hash(p), o: i, v: data.versao };
        ids.add(data.id); salvaMeta(); salvaLocal();
        continue;
      }
      ids.add(p._id);
      const s = meta.snap[p._id], h = hash(p);
      if (!s) {                                                // voltou da lixeira (ex.: Desfazer)
        const { data, error } = await sb.from("projetos").update({ dados: limpa(p), ordem: i, excluido_em: null })
          .eq("id", p._id).select("versao,atualizado_em,atualizado_por_nome");
        if (error) throw error;
        if (data && data.length) {
          meta.snap[p._id] = { h, o: i, v: data[0].versao };
          Object.assign(p, { _versao: data[0].versao, _por: data[0].atualizado_por_nome, _em: data[0].atualizado_em });
        } else { delete p._id; delete p._versao; }             // apagado de vez por alguém: vira projeto novo
      } else if (s.h !== h) {                                  // conteúdo alterado
        const { data, error } = await sb.from("projetos").update({ dados: limpa(p), ordem: i })
          .eq("id", p._id).eq("versao", s.v).select("versao,atualizado_em,atualizado_por_nome");
        if (error) throw error;
        if (!data || !data.length) { await conflito(p); continue; }
        meta.snap[p._id] = { h, o: i, v: data[0].versao };
        Object.assign(p, { _versao: data[0].versao, _por: data[0].atualizado_por_nome, _em: data[0].atualizado_em });
      } else if (s.o !== i) {                                  // só a ordem
        const { error } = await sb.from("projetos").update({ ordem: i }).eq("id", p._id);
        if (error) throw error;
        s.o = i;
      }
      salvaMeta();
    }
    for (const id of Object.keys(meta.snap)) {                 // removidos → lixeira
      if (ids.has(id)) continue;
      const { error } = await sb.from("projetos").update({ excluido_em: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      delete meta.snap[id]; salvaMeta();
    }
    if ((state.ciclo || "") !== (meta.ciclo || "")) {
      const { error } = await sb.from("config").update({ ciclo: state.ciclo || "" }).eq("id", 1);
      if (error) throw error;
      meta.ciclo = state.ciclo || ""; salvaMeta();
    }
    salvaLocal();
    renderQuem();
    if (P() && P()._id && etapasCache[P()._id]) etapasCache[P()._id].quando = 0;
  }

  /* mesma edição em dois lugares: a versão da nuvem fica, a sua vira uma cópia (nada se perde) */
  async function conflito(p) {
    const { data, error } = await sb.from("projetos")
      .select("id,dados,ordem,versao,excluido_em,atualizado_em,atualizado_por_nome").eq("id", p._id).maybeSingle();
    if (error) throw error;
    // a nuvem já tem exatamente este conteúdo (ex.: o envio chegou, mas a página fechou antes
    // da confirmação): não é conflito, só atualiza a versão — sem criar cópia repetida
    if (data && !data.excluido_em && hash(linhaParaProjeto(data)) === hash(p)) {
      Object.assign(p, { _versao: data.versao, _por: data.atualizado_por_nome, _em: data.atualizado_em });
      meta.snap[data.id] = { h: hash(p), o: data.ordem, v: data.versao };
      salvaMeta(); salvaLocal();
      return;
    }
    const minha = limpa(p);
    minha.nome = (minha.nome || "Projeto") + " (sua versão)";
    const idx = state.projects.indexOf(p);
    if (data && !data.excluido_em) {
      const srv = linhaParaProjeto(data);
      state.projects.splice(idx, 1, srv, minha);
      meta.snap[data.id] = { h: hash(srv), o: data.ordem, v: data.versao };
      toast(`${data.atualizado_por_nome || "Alguém"} alterou “${srv.nome}” ao mesmo tempo. Sua versão foi salva como cópia logo abaixo.`);
    } else {
      state.projects.splice(idx, 1, minha);
      delete meta.snap[p._id];
    }
    salvaMeta(); salvaLocal(); render(false); agendar(200);
  }

  async function receber() {
    let q = sb.from("projetos").select("id,dados,ordem,versao,excluido_em,atualizado_em,atualizado_por_nome");
    if (meta.ultimo) q = q.gte("atualizado_em", new Date(new Date(meta.ultimo).getTime() - 5000).toISOString());
    const { data, error } = await q.order("atualizado_em");
    if (error) throw error;
    const cfg = await sb.from("config").select("ciclo").eq("id", 1).maybeSingle();
    if (cfg.error) throw cfg.error;

    const selId = state.projects[state.sel] && state.projects[state.sel]._id;
    let mudouLista = false, mudouSel = false, mudouOrdem = false;
    for (const r of data) {
      const s = meta.snap[r.id];
      const i = state.projects.findIndex(p => p._id === r.id);
      const local = i >= 0 ? state.projects[i] : null;
      const sujo = local && s && hash(local) !== s.h;
      if (r.excluido_em) {                                     // foi para a lixeira
        if (local && !sujo) { state.projects.splice(i, 1); mudouLista = true; if (r.id === selId) mudouSel = true; }
        delete meta.snap[r.id];
        continue;
      }
      if (s && s.v === r.versao) {                             // já tenho esta versão; talvez só a ordem mudou
        if (s.o !== r.ordem) { s.o = r.ordem; mudouOrdem = true; }
        continue;
      }
      if (sujo) continue;                                      // edição local pendente: o envio resolve o conflito
      const novo = linhaParaProjeto(r);
      if (local) state.projects[i] = novo; else state.projects.push(novo);
      meta.snap[r.id] = { h: hash(novo), o: r.ordem, v: r.versao };
      mudouLista = true; mudouOrdem = mudouOrdem || !local;
      if (r.id === selId) mudouSel = true;
    }
    if (mudouOrdem) {
      const o = id => (meta.snap[id] ? meta.snap[id].o : 1e9);
      state.projects.sort((a, b) => o(a._id) - o(b._id));
      mudouLista = true;
    }
    const ciclo = (cfg.data && cfg.data.ciclo) || "";
    if (ciclo !== (meta.ciclo || "") && (state.ciclo || "") === (meta.ciclo || "")) {
      state.ciclo = ciclo; meta.ciclo = ciclo; mudouSel = true;
    }
    if (data.length) meta.ultimo = maxData(data);
    if (!state.projects.length) state.projects.push(novoProjeto());
    if (mudouLista || mudouSel) {
      const j = state.projects.findIndex(p => p._id === selId);
      state.sel = j >= 0 ? j : Math.min(state.sel, state.projects.length - 1);
      salvaLocal();
      render(mudouSel || j < 0);
    }
    salvaMeta();
  }

  /* re-desenha sem atrapalhar quem está digitando */
  function render(form) {
    renderList();
    if (!form) return renderQuem();
    if (editando()) {
      if (!formAtrasado) {
        formAtrasado = true;
        toast("A equipe atualizou este projeto — a tela será atualizada quando você sair do campo.");
        document.querySelector(".main").addEventListener("focusout", function f() {
          setTimeout(() => {
            if (editando()) return;
            document.querySelector(".main").removeEventListener("focusout", f);
            formAtrasado = false; renderForm();
          }, 250);
        });
      }
    } else renderForm();
  }

  /* ---------------- auditoria ---------------- */
  // eventos do editor (PowerPoint, importação, motivo) entram numa fila que sobrevive
  // a recarregar e a ficar offline; são enviados junto com a sincronização
  function registrar(acao, projetoId, detalhe, mudancas) {
    if (!ativo()) return;
    (meta.eventos = meta.eventos || []).push({ acao, p: projetoId || null, d: detalhe || "", m: mudancas || [] });
    salvaMeta(); agendar(300);
  }
  async function enviarEventos() {
    while (meta.eventos && meta.eventos.length) {
      const e = meta.eventos[0];
      const { error } = await sb.rpc("registrar_evento", { p_acao: e.acao, p_projeto: e.p, p_detalhe: e.d, p_mudancas: e.m });
      if (error) {
        if (erroDeRede(error)) throw error;                                        // offline: tenta depois
        if (/registrar_evento|schema cache|function/i.test(error.message || "")) return;  // banco sem auditoria ainda: aguarda na fila
        console.warn("[Nuvem] evento descartado:", error);                        // erro permanente: não trava a fila
      }
      meta.eventos.shift(); salvaMeta();
    }
  }

  /* motivo OBRIGATÓRIO ao pausar/cancelar: devolve o texto, ou "" se a pessoa desistir */
  async function pedirMotivo(p, status) {
    if (!ativo()) return "";
    const verbo = status === "CANCELADO" ? "Cancelar" : "Pausar";
    const ov = modal(`<h3>${verbo} “${esc(p.nome || "projeto")}”</h3>
      <p class="nsub">Para ${verbo.toLowerCase()} um projeto, informe o motivo. Ele fica registrado no histórico.</p>
      <label class="fl" for="nm_txt" style="margin-top:12px">Motivo <span class="nopc">(obrigatório)</span></label>
      <textarea id="nm_txt" maxlength="1000" placeholder="Ex.: aguardando aprovação da diretoria; fornecedor indisponível…"></textarea>
      <div class="nerro" id="nm_erro" role="alert"></div>
      <div class="nbotoes"><button class="btn soft" id="nm_nao">Cancelar alteração</button>
        <button class="btn primary" id="nm_ok" disabled>Confirmar</button></div>`, { fixo: true });
    const txt = ov.querySelector("#nm_txt"), ok = ov.querySelector("#nm_ok");
    setTimeout(() => txt.focus(), 40);
    txt.addEventListener("input", () => { ok.disabled = txt.value.trim().length < 5; });
    const motivo = await new Promise(res => {
      ok.addEventListener("click", () => res(txt.value.trim()));
      ov.querySelector("#nm_nao").addEventListener("click", () => res(""));
      ov.addEventListener("keydown", e => { if (e.key === "Escape") res(""); });
    });
    fechaModal();
    return motivo;
  }
  async function registrarMotivo(p, status, motivo) {
    if (!ativo() || !motivo) return;
    if (!p._id) { try { await sincronizar(); } catch (e) {} }   // projeto novo: precisa existir na nuvem antes
    registrar("motivo", p._id || null, motivo, [{ campo: "Status geral", de: "", para: status }]);
  }

  const ACOES = {
    criou: ["Criou o projeto", "a"], editou: ["Editou", "e"], excluiu: ["Enviou para a lixeira", "x"],
    restaurou: ["Restaurou da lixeira", "a"], apagou: ["Apagou de vez", "x"], ciclo: ["Alterou o ciclo da reunião", "e"],
    pptx: ["Gerou o PowerPoint", "p"], importou: ["Importou dados", "x"], motivo: ["Registrou um motivo", "m"],
  };
  function linhaHist(r) {
    const [rot, cor] = ACOES[r.acao] || [r.acao, "e"];
    const mud = (r.mudancas || []).map(m => `<li><b>${esc(m.campo)}:</b> ${m.de ? `<s>${esc(m.de)}</s> → ` : ""}${esc(m.para || "(vazio)")}</li>`).join("");
    return `<div class="nh-it ${cor}"><div class="nh-dot"></div><div class="nh-txt">
      <div class="nh-cab"><b>${esc(r.usuario_nome || "—")}</b> · ${rot}<span>${fmtQuando(r.em)}</span></div>
      ${r.detalhe ? `<div class="nh-det">${r.acao === "motivo" ? "Motivo: " : ""}${esc(r.detalhe)}</div>` : ""}
      ${mud ? `<ul>${mud}</ul>` : ""}</div></div>`;
  }
  async function historico() {
    const p = P(); if (!ativo() || !p) return;
    if (!p._id) { toast("Este projeto ainda está sendo enviado para a nuvem. Tente de novo em instantes."); return; }
    const ov = modal(`<h3>Histórico</h3><p class="nsub">${esc(p.nome || "")} · registrado automaticamente pelo servidor; ninguém da equipe consegue alterar.</p>
      <div class="nhist" id="nhist"><div class="nsub">Carregando…</div></div>
      <div class="nbotoes"><button class="btn soft sm" id="nh_mais" hidden>Carregar mais</button><span style="flex:1"></span>
        <button class="btn soft" onclick="Nuvem.fechar()">Fechar</button></div>`);
    ov.querySelector(".nmodal").classList.add("larga");
    const box = ov.querySelector("#nhist"), mais = ov.querySelector("#nh_mais");
    let ate = null;
    async function carrega() {
      let q = sb.from("auditoria").select("em,usuario_nome,acao,mudancas,detalhe").eq("projeto_id", p._id).order("em", { ascending: false }).limit(50);
      if (ate) q = q.lt("em", ate);
      const { data, error } = await q;
      if (error) {
        box.innerHTML = `<div class="nerro">${erroDeRede(error) ? "Sem conexão com a nuvem." :
          /auditoria|relation|schema cache/i.test(error.message) ? "O histórico ainda não foi ativado no banco: rode o script atualizado (supabase/schema.sql)." : esc(error.message)}</div>`;
        return;
      }
      if (!ate) box.innerHTML = data.length ? "" : `<div class="nvazio">Nenhum registro ainda.</div>`;
      box.insertAdjacentHTML("beforeend", data.map(linhaHist).join(""));
      if (data.length) ate = data[data.length - 1].em;
      mais.hidden = data.length < 50;
    }
    mais.addEventListener("click", carrega);
    carrega();
  }

  /* "Concluída por Fulana em 03/11" ao passar o mouse na bolinha da etapa */
  async function marcaEtapas(forcar) {
    const p = typeof P === "function" && P();
    if (!ativo() || !p || !p._id) return;
    const c = etapasCache[p._id];
    if (c && c.mapa) aplicaEtapas(c.mapa);
    if (!forcar && c && Date.now() - c.quando < 30000) return;
    etapasCache[p._id] = { quando: Date.now(), mapa: c ? c.mapa : {} };
    try {
      const { data, error } = await sb.from("auditoria").select("em,usuario_nome,mudancas")
        .eq("projeto_id", p._id).eq("acao", "editou").order("em", { ascending: false }).limit(300);
      if (error) return;
      const mapa = {};
      for (const r of data) for (const m of (r.mudancas || []))
        if (m.tipo === "status" && m.etapa && !mapa[m.etapa])
          mapa[m.etapa] = `${m.para.charAt(0).toUpperCase() + m.para.slice(1)} por ${r.usuario_nome || "—"} em ${fmtQuando(r.em)}`;
      etapasCache[p._id] = { quando: Date.now(), mapa };
      if (P() === p) aplicaEtapas(mapa);
    } catch (e) {}
  }
  function aplicaEtapas(mapa) {
    const p = P(); if (!p) return;
    document.querySelectorAll("#etapas tr").forEach((tr, i) => {
      const e = p.etapas[i], b = tr.querySelector(".stbtn");
      if (!e || !b) return;
      const info = mapa[e.n];
      b.title = "Clique para mudar o status" + (info ? "\n" + info : "");
    });
  }

  function renderQuem() { const el = document.getElementById("f_quem"); if (el && typeof P === "function" && P()) el.textContent = quem(P()); }
  function quem(p) { return ativo() && p && p._por ? `Editado por ${p._por} em ${fmtQuando(p._em)}` : ""; }

  function iniciaCiclo() {
    clearInterval(iniciaCiclo.t);
    iniciaCiclo.t = setInterval(() => { if (!document.hidden) sincronizar(); }, INTERVALO);
  }

  /* ---------------- menu do usuário, conta e lixeira ---------------- */
  function menu(ev) {
    ev.stopPropagation();
    const ja = document.getElementById("numenu"); if (ja) { ja.remove(); return; }
    const r = ev.currentTarget.getBoundingClientRect();
    const m = document.createElement("div");
    m.id = "numenu"; m.className = "numenu"; m.setAttribute("role", "menu");
    m.style.top = (r.bottom + 8) + "px"; m.style.right = (window.innerWidth - r.right) + "px";
    m.innerHTML = `<div class="numail">${esc(usuario.email)}</div>
      <button role="menuitem" onclick="Nuvem.conta()">Minha conta</button>
      <button role="menuitem" onclick="Nuvem.lixeira()">Lixeira</button>
      <button role="menuitem" onclick="Nuvem.sincronizarAgora()">Sincronizar agora</button>
      <button role="menuitem" class="sair" onclick="Nuvem.sair()">Sair</button>`;
    document.body.appendChild(m);
    const fecha = e => { if (!m.contains(e.target)) { m.remove(); document.removeEventListener("mousedown", fecha); } };
    setTimeout(() => document.addEventListener("mousedown", fecha), 0);
    m.querySelector("button").focus();
  }
  function fechaMenu() { const m = document.getElementById("numenu"); if (m) m.remove(); }

  function conta() {
    fechaMenu();
    const ov = modal(`<h3>Minha conta</h3>
      <p class="nsub">${esc(usuario.email)}</p>
      <label class="fl" for="nc_nome">Seu nome (aparece em “Editado por”)</label>
      <input type="text" id="nc_nome" value="${esc(nomeMembro)}">
      <label class="fl" for="nc_s1" style="margin-top:14px">Nova senha <span class="nopc">(opcional)</span></label>
      <input type="password" id="nc_s1" autocomplete="new-password" placeholder="mínimo de 8 caracteres">
      <label class="fl" for="nc_s2" style="margin-top:10px">Repita a nova senha</label>
      <input type="password" id="nc_s2" autocomplete="new-password">
      <div class="nerro" id="nc_erro" role="alert"></div>
      <div class="nbotoes"><button class="btn soft" onclick="Nuvem.fechar()">Cancelar</button>
        <button class="btn primary" id="nc_ok">Salvar</button></div>`);
    ov.querySelector("#nc_ok").addEventListener("click", async () => {
      const nome = ov.querySelector("#nc_nome").value.trim(), s1 = ov.querySelector("#nc_s1").value, s2 = ov.querySelector("#nc_s2").value;
      const erro = ov.querySelector("#nc_erro");
      if (s1 || s2) {
        if (s1.length < 8) { erro.textContent = "A senha precisa ter pelo menos 8 caracteres."; return; }
        if (s1 !== s2) { erro.textContent = "As senhas não conferem."; return; }
      }
      try {
        if (nome && nome !== nomeMembro) {
          const { error } = await sb.from("membros").update({ nome }).eq("user_id", usuario.id);
          if (error) throw error;
          nomeMembro = nome;
        }
        if (s1) { const { error } = await sb.auth.updateUser({ password: s1 }); if (error) throw error; }
        fechaModal(); pintaTopo(); status("ok", "Salvo na nuvem");
        toast(s1 ? "Conta atualizada — use a nova senha no próximo login." : "Conta atualizada.");
      } catch (e) { erro.textContent = erroDeRede(e) ? "Sem conexão. Tente de novo em instantes." : "Não foi possível salvar: " + (e.message || e); }
    });
  }

  async function lixeira() {
    fechaMenu();
    const ov = modal(`<h3>Lixeira</h3><p class="nsub">Projetos excluídos pela equipe. Restaure ou esvazie quando quiser.</p>
      <div class="nlixo" id="nlixo"><div class="nsub">Carregando…</div></div>
      <div class="nbotoes"><button class="btn link" id="nl_esvaziar" disabled>Esvaziar lixeira</button>
        <span style="flex:1"></span><button class="btn soft" onclick="Nuvem.fechar()">Fechar</button></div>`);
    const lista = ov.querySelector("#nlixo"), bEsv = ov.querySelector("#nl_esvaziar");
    async function carrega() {
      const { data, error } = await sb.from("projetos").select("id,dados,excluido_em,atualizado_por_nome")
        .not("excluido_em", "is", null).order("excluido_em", { ascending: false });
      if (error) { lista.innerHTML = `<div class="nerro">${erroDeRede(error) ? "Sem conexão com a nuvem." : esc(error.message)}</div>`; return; }
      bEsv.disabled = !data.length;
      lista.innerHTML = data.length ? data.map(r => `<div class="nlixo-it">
          <div><b>${esc((r.dados && r.dados.nome) || "(sem nome)")}</b>
          <span class="nsub">excluído por ${esc(r.atualizado_por_nome || "—")} em ${fmtQuando(r.excluido_em)}</span></div>
          <button class="btn soft sm" data-id="${r.id}">Restaurar</button></div>`).join("")
        : `<div class="nvazio">A lixeira está vazia.</div>`;
      lista.querySelectorAll("button[data-id]").forEach(b => b.addEventListener("click", async () => {
        b.disabled = true;
        const { error } = await sb.from("projetos").update({ excluido_em: null, ordem: state.projects.length }).eq("id", b.dataset.id);
        if (error) { b.disabled = false; toast("Não foi possível restaurar agora."); return; }
        toast("Projeto restaurado."); await sincronizar(); carrega();
      }));
    }
    bEsv.addEventListener("click", async () => {
      if (!await pergunta("Esvaziar a lixeira?", "Os projetos da lixeira serão <b>apagados de vez</b> para toda a equipe. Não dá para desfazer.", "Esvaziar", "Cancelar", true)) return lixeira();
      const { error } = await sb.from("projetos").delete().not("excluido_em", "is", null);
      toast(error ? "Não foi possível esvaziar agora." : "Lixeira esvaziada.");
      lixeira();
    });
    carrega();
  }

  function pergunta(titulo, html, sim, nao, perigo) {
    return new Promise(res => {
      const ov = modal(`<h3>${titulo}</h3><div class="ntexto">${html}</div>
        <div class="nbotoes"><button class="btn soft" id="np_nao">${nao}</button>
        <button class="btn ${perigo ? "perigo" : "primary"}" id="np_sim">${sim}</button></div>`, { fixo: true });
      ov.querySelector("#np_sim").addEventListener("click", () => { fechaModal(); res(true); });
      ov.querySelector("#np_nao").addEventListener("click", () => { fechaModal(); res(false); });
    });
  }

  async function sair() {
    fechaMenu();
    if (!await pergunta("Sair da nuvem?", "Você sai da sua conta neste computador. A cópia local da equipe é apagada daqui; os dados continuam salvos na nuvem.", "Sair", "Cancelar")) return;
    try { await sincronizar(); } catch (e) {}
    clearInterval(iniciaCiclo.t);
    try { await sb.auth.signOut(); } catch (e) {}
    usuario = null; nomeMembro = ""; setModo(null);
    ls.del(K_CACHE); ls.del(K_META);
    meta = { snap: {}, ciclo: null, ultimo: null, pronto: false, eventos: [] };
    state = load(); render(true); pintaTopo();
    telaLogin();
  }

  /* ---------------- inicialização ---------------- */
  async function iniciar() {
    if (!window.supabase || !window.supabase.createClient) return;     // sem biblioteca: só modo local
    sb = window.supabase.createClient(CFG.url, CFG.key, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: "divine_auth" },
      // ao fechar a aba, o navegador cancela envios normais; "keepalive" deixa terminar
      // (limite de ~64 KB por envio — projetos com fotos ficam cobertos pelo aviso abaixo)
      global: { fetch: (url, o) => {
        o = o || {};
        if (saindo && o.body && String(o.body).length < 60000) o = Object.assign({}, o, { keepalive: true });
        return fetch(url, o);
      } },
    });
    window.addEventListener("online", () => sincronizar());
    window.addEventListener("focus", () => sincronizar());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) { saindo = true; enviarAgora(); }       // trocou de aba / minimizou / vai fechar
      else { saindo = false; sincronizar(); }
    });
    window.addEventListener("pagehide", () => { saindo = true; enviarAgora(); });
    // aviso padrão do navegador SÓ se há algo não enviado e há internet
    // (offline, esperar não adianta: os dados já estão salvos neste computador)
    window.addEventListener("beforeunload", e => {
      if (!navigator.onLine || !temPendencia()) return;
      saindo = true; enviarAgora();
      e.preventDefault(); e.returnValue = "";
    });
    let sessao = null;
    try { sessao = (await sb.auth.getSession()).data.session; } catch (e) {}
    if (sessao && sessao.user) {
      usuario = sessao.user;
      carregaMeta();
      if (modo() !== "nuvem") setModo("nuvem");
      pintaTopo();
      return aposLogin();
    }
    pintaTopo();
    if (modo() === "local") return;
    telaLogin();
  }

  window.Nuvem = {
    iniciar, ativo, agendar, quem, limpa, menu, conta, lixeira, sair,
    registrar, pedirMotivo, registrarMotivo, historico, marcaEtapas,
    entrar: () => telaLogin(), fechar: fechaModal,
    sincronizarAgora: () => { fechaMenu(); status("sync", "Sincronizando…"); return sincronizar(); },
    chaveDados: () => (modo() === "nuvem" ? K_CACHE : K_LOCAL),
  };
})();
