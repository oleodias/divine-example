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
