-- =====================================================================
-- Divine P&D — banco do editor (Supabase / Postgres)
--
-- Como usar: Supabase → SQL Editor → New query → cole TODO este arquivo
-- → Run. Pode rodar de novo sem problema (o script é idempotente).
--
-- Modelo: um portfólio da EQUIPE. Todo usuário criado no painel
-- (Authentication → Users → Add user) vira membro e pode editar.
-- Quem não é membro não lê nem grava nada (Row Level Security).
-- =====================================================================

-- 1) MEMBROS DA EQUIPE --------------------------------------------------
create table if not exists public.membros (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  email     text not null default '',
  nome      text not null default '',
  criado_em timestamptz not null default now()
);

-- todo usuário criado no painel vira membro (o cadastro público fica desligado)
create or replace function public.novo_membro() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.membros (user_id, email, nome)
  values (new.id, coalesce(new.email, ''), initcap(split_part(coalesce(new.email, ''), '@', 1)))
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario after insert on auth.users
  for each row execute function public.novo_membro();

-- usuários que já existiam antes deste script
insert into public.membros (user_id, email, nome)
select id, coalesce(email, ''), initcap(split_part(coalesce(email, ''), '@', 1))
from auth.users
on conflict (user_id) do nothing;

create or replace function public.eh_membro() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.membros where user_id = auth.uid());
$$;

-- 2) PROJETOS -----------------------------------------------------------
-- "dados" guarda o projeto no MESMO formato do JSON de exportação.
-- "versao" sobe a cada alteração de conteúdo: é o que impede uma pessoa
-- de sobrescrever, sem saber, o que outra acabou de salvar.
-- "excluido_em" preenchido = projeto na lixeira.
create table if not exists public.projetos (
  id                  uuid primary key default gen_random_uuid(),
  dados               jsonb not null,
  ordem               double precision not null default 0,
  versao              integer not null default 1,
  excluido_em         timestamptz,
  atualizado_em       timestamptz not null default now(),
  atualizado_por      uuid references auth.users (id) on delete set null,
  atualizado_por_nome text not null default ''
);
create index if not exists projetos_atualizado_em on public.projetos (atualizado_em);

-- carimbo automático: quem alterou, quando, e a nova versão
create or replace function public.carimba_projeto() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.atualizado_em := now();
  if tg_op = 'INSERT' then
    new.versao := 1;
    new.atualizado_por := auth.uid();
    new.atualizado_por_nome := coalesce((select nome from public.membros where user_id = auth.uid()), '');
  elsif new.dados is distinct from old.dados or new.excluido_em is distinct from old.excluido_em then
    new.versao := old.versao + 1;
    new.atualizado_por := auth.uid();
    new.atualizado_por_nome := coalesce((select nome from public.membros where user_id = auth.uid()), '');
  else
    -- só mudou a ordem na lista: não conta como edição nem gera conflito
    new.versao := old.versao;
    new.atualizado_por := old.atualizado_por;
    new.atualizado_por_nome := old.atualizado_por_nome;
  end if;
  return new;
end $$;

drop trigger if exists carimbo on public.projetos;
create trigger carimbo before insert or update on public.projetos
  for each row execute function public.carimba_projeto();

-- 3) CONFIGURAÇÃO (ciclo da reunião, que vai na capa) -------------------
create table if not exists public.config (
  id            int primary key default 1 check (id = 1),
  ciclo         text not null default '',
  atualizado_em timestamptz not null default now()
);
insert into public.config (id) values (1) on conflict (id) do nothing;

-- 4) "PING" para o plano gratuito não pausar por inatividade ------------
create or replace function public.ping() returns timestamptz
language sql stable as $$ select now() $$;

-- 5) SEGURANÇA: só membros leem e gravam --------------------------------
alter table public.membros  enable row level security;
alter table public.projetos enable row level security;
alter table public.config   enable row level security;

revoke all on public.membros, public.projetos, public.config from anon;
grant select on public.membros to authenticated;
grant update (nome) on public.membros to authenticated;          -- cada um só muda o próprio nome
grant select, insert, update, delete on public.projetos to authenticated;
grant select, update on public.config to authenticated;
grant execute on function public.ping() to anon, authenticated;
grant execute on function public.eh_membro() to authenticated;

drop policy if exists "membros: ver a equipe" on public.membros;
create policy "membros: ver a equipe" on public.membros
  for select to authenticated using (public.eh_membro());

drop policy if exists "membros: editar o proprio nome" on public.membros;
create policy "membros: editar o proprio nome" on public.membros
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "projetos: equipe" on public.projetos;
create policy "projetos: equipe" on public.projetos
  for all to authenticated using (public.eh_membro()) with check (public.eh_membro());

drop policy if exists "config: ler" on public.config;
create policy "config: ler" on public.config
  for select to authenticated using (public.eh_membro());

drop policy if exists "config: atualizar" on public.config;
create policy "config: atualizar" on public.config
  for update to authenticated using (public.eh_membro()) with check (public.eh_membro());

-- =====================================================================
-- 6) AUDITORIA — histórico à prova de adulteração
--
-- Cada criação, edição (com o "de → para" de cada campo), exclusão,
-- restauração e exclusão definitiva é registrada PELO PRÓPRIO BANCO.
-- A equipe só pode LER o histórico: ninguém consegue editar nem apagar
-- registros pelo editor ou pela chave do site. O horário é o do servidor.
-- Guardado para sempre (texto leve; as fotos não entram no histórico).
-- =====================================================================
create table if not exists public.auditoria (
  id           bigint generated always as identity primary key,
  em           timestamptz not null default now(),
  usuario_id   uuid,
  usuario_nome text not null default '',
  projeto_id   uuid,                         -- sem chave estrangeira: o registro sobrevive à exclusão definitiva
  projeto_nome text not null default '',
  acao         text not null,                -- criou | editou | excluiu | restaurou | apagou | ciclo | pptx | importou | motivo
  mudancas     jsonb not null default '[]'::jsonb,   -- [{campo, de, para, etapa?, tipo?}]
  detalhe      text not null default ''
);
create index if not exists auditoria_projeto_em on public.auditoria (projeto_id, em desc);
create index if not exists auditoria_em on public.auditoria (em desc);

-- valor de um campo do projeto como texto legível
create or replace function public.aud_txt(v jsonb) returns text
language sql immutable as $$
  select case
    when v is null or v = 'null'::jsonb then ''
    when jsonb_typeof(v) = 'array' then (select coalesce(string_agg(x, '; '), '') from jsonb_array_elements_text(v) x)
    when jsonb_typeof(v) = 'string' then v #>> '{}'
    else v::text end
$$;

-- compara duas versões do projeto e devolve a lista do que mudou
create or replace function public.aud_diff(a jsonb, b jsonb) returns jsonb
language plpgsql immutable as $$
declare
  r jsonb := '[]'::jsonb;
  c record; ea jsonb; eb jsonb; nm text; na int; nb int;
  st jsonb := '{"n":"não iniciada","a":"em andamento","g":"concluída","r":"bloqueada"}';
begin
  for c in select * from (values ('nome','Nome'),('prioridade','Prioridade'),('statusGeral','Status geral'),
      ('resp','Responsável'),('abertura','Data de abertura'),('linkPesquisa','Link da pesquisa'),
      ('pend','Pendências'),('acoes','Próximas ações'),('obs','Observações')) v(k, rot) loop
    if public.aud_txt(a -> c.k) is distinct from public.aud_txt(b -> c.k) then
      r := r || jsonb_build_object('campo', c.rot, 'de', left(public.aud_txt(a -> c.k), 400), 'para', left(public.aud_txt(b -> c.k), 400));
    end if;
  end loop;
  for c in select * from (values ('estimado','Custo estimado'),('real','Custo real'),('fornecedor','Fornecedor(es)'),
      ('aprovacao','Aprovação'),('obs','Observações do orçamento')) v(k, rot) loop
    if public.aud_txt(a -> 'orc' -> c.k) is distinct from public.aud_txt(b -> 'orc' -> c.k) then
      r := r || jsonb_build_object('campo', c.rot, 'de', left(public.aud_txt(a -> 'orc' -> c.k), 400), 'para', left(public.aud_txt(b -> 'orc' -> c.k), 400));
    end if;
  end loop;
  -- fotos: só a quantidade (as imagens em si não vão para o histórico)
  na := jsonb_array_length(coalesce(a -> 'imgs', '[]'::jsonb));
  nb := jsonb_array_length(coalesce(b -> 'imgs', '[]'::jsonb));
  if na <> nb then
    r := r || jsonb_build_object('campo', 'Fotos', 'de', na || ' foto(s)', 'para', nb || ' foto(s)');
  elsif (a -> 'imgs') is distinct from (b -> 'imgs') then
    r := r || jsonb_build_object('campo', 'Fotos', 'de', na || ' foto(s)', 'para', nb || ' foto(s), substituídas ou reordenadas');
  end if;
  -- etapas: comparadas pelo nome
  for eb in select * from jsonb_array_elements(coalesce(b -> 'etapas', '[]'::jsonb)) loop
    nm := eb ->> 'n';
    ea := null;
    select e into ea from jsonb_array_elements(coalesce(a -> 'etapas', '[]'::jsonb)) e where e ->> 'n' = nm limit 1;
    if ea is null then
      r := r || jsonb_build_object('campo', 'Etapa adicionada', 'de', '', 'para', nm);
    else
      if ea ->> 'st' is distinct from eb ->> 'st' then
        r := r || jsonb_build_object('campo', 'Etapa “' || nm || '”', 'de', coalesce(st ->> (ea ->> 'st'), ''),
                                     'para', coalesce(st ->> (eb ->> 'st'), ''), 'etapa', nm, 'tipo', 'status');
      end if;
      if coalesce(ea ->> 'resp', '') is distinct from coalesce(eb ->> 'resp', '') then
        r := r || jsonb_build_object('campo', 'Responsável da etapa “' || nm || '”', 'de', coalesce(ea ->> 'resp', ''), 'para', coalesce(eb ->> 'resp', ''));
      end if;
      if coalesce(ea ->> 'prev', '') is distinct from coalesce(eb ->> 'prev', '') then
        r := r || jsonb_build_object('campo', 'Previsto da etapa “' || nm || '”', 'de', coalesce(ea ->> 'prev', ''), 'para', coalesce(eb ->> 'prev', ''));
      end if;
    end if;
  end loop;
  for ea in select * from jsonb_array_elements(coalesce(a -> 'etapas', '[]'::jsonb)) loop
    if not exists (select 1 from jsonb_array_elements(coalesce(b -> 'etapas', '[]'::jsonb)) e where e ->> 'n' = ea ->> 'n') then
      r := r || jsonb_build_object('campo', 'Etapa removida', 'de', ea ->> 'n', 'para', '');
    end if;
  end loop;
  if jsonb_array_length(r) = 0
     and (select jsonb_agg(e ->> 'n') from jsonb_array_elements(coalesce(a -> 'etapas', '[]'::jsonb)) e)
         is distinct from (select jsonb_agg(e ->> 'n') from jsonb_array_elements(coalesce(b -> 'etapas', '[]'::jsonb)) e) then
    r := r || jsonb_build_object('campo', 'Ordem das etapas', 'de', '', 'para', 'alterada');
  end if;
  return r;
end $$;

create or replace function public.aud_nome() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select nome from public.membros where user_id = auth.uid()), '')
$$;

-- gatilho: registra tudo o que acontece com os projetos
create or replace function public.audita_projeto() returns trigger
language plpgsql security definer set search_path = public as $$
declare m jsonb;
begin
  if tg_op = 'INSERT' then
    insert into public.auditoria (usuario_id, usuario_nome, projeto_id, projeto_nome, acao)
    values (auth.uid(), public.aud_nome(), new.id, coalesce(new.dados ->> 'nome', ''), 'criou');
    return null;
  elsif tg_op = 'DELETE' then
    insert into public.auditoria (usuario_id, usuario_nome, projeto_id, projeto_nome, acao, detalhe)
    values (auth.uid(), public.aud_nome(), old.id, coalesce(old.dados ->> 'nome', ''), 'apagou', 'Apagado de vez (lixeira esvaziada)');
    return null;
  end if;
  if old.excluido_em is null and new.excluido_em is not null then
    insert into public.auditoria (usuario_id, usuario_nome, projeto_id, projeto_nome, acao, detalhe)
    values (auth.uid(), public.aud_nome(), new.id, coalesce(new.dados ->> 'nome', ''), 'excluiu', 'Enviado para a lixeira');
  elsif old.excluido_em is not null and new.excluido_em is null then
    insert into public.auditoria (usuario_id, usuario_nome, projeto_id, projeto_nome, acao, detalhe)
    values (auth.uid(), public.aud_nome(), new.id, coalesce(new.dados ->> 'nome', ''), 'restaurou', 'Restaurado da lixeira');
  end if;
  if new.dados is distinct from old.dados then
    m := public.aud_diff(old.dados, new.dados);
    if jsonb_array_length(m) > 0 then
      insert into public.auditoria (usuario_id, usuario_nome, projeto_id, projeto_nome, acao, mudancas)
      values (auth.uid(), public.aud_nome(), new.id, coalesce(new.dados ->> 'nome', ''), 'editou', m);
    end if;
  end if;
  return null;
end $$;

drop trigger if exists audita on public.projetos;
create trigger audita after insert or update or delete on public.projetos
  for each row execute function public.audita_projeto();

-- gatilho: ciclo da reunião (capa)
create or replace function public.audita_config() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.ciclo is distinct from old.ciclo then
    insert into public.auditoria (usuario_id, usuario_nome, acao, mudancas)
    values (auth.uid(), public.aud_nome(), 'ciclo',
            jsonb_build_array(jsonb_build_object('campo', 'Ciclo da reunião', 'de', old.ciclo, 'para', new.ciclo)));
  end if;
  return null;
end $$;

drop trigger if exists audita_cfg on public.config;
create trigger audita_cfg after update on public.config
  for each row execute function public.audita_config();

-- eventos que acontecem no editor (não no banco): PowerPoint gerado, importação, motivo
create or replace function public.registrar_evento(p_acao text, p_projeto uuid default null,
                                                   p_detalhe text default '', p_mudancas jsonb default '[]'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_membro() then raise exception 'sem permissão'; end if;
  if p_acao not in ('pptx', 'importou', 'motivo') then raise exception 'ação inválida: %', p_acao; end if;
  insert into public.auditoria (usuario_id, usuario_nome, projeto_id, projeto_nome, acao, detalhe, mudancas)
  values (auth.uid(), public.aud_nome(), p_projeto,
          coalesce((select dados ->> 'nome' from public.projetos where id = p_projeto), ''),
          p_acao, left(coalesce(p_detalhe, ''), 2000), coalesce(p_mudancas, '[]'::jsonb));
end $$;

-- segurança: a equipe só LÊ o histórico; gravação apenas pelos gatilhos/função acima
alter table public.auditoria enable row level security;
revoke all on public.auditoria from anon, authenticated;
grant select on public.auditoria to authenticated;
drop policy if exists "auditoria: equipe le" on public.auditoria;
create policy "auditoria: equipe le" on public.auditoria
  for select to authenticated using (public.eh_membro());

revoke all on function public.registrar_evento(text, uuid, text, jsonb) from public, anon;
grant execute on function public.registrar_evento(text, uuid, text, jsonb) to authenticated;
revoke all on function public.audita_projeto(), public.audita_config(), public.aud_nome() from public, anon, authenticated;
