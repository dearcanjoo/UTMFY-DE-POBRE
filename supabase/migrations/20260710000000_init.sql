-- =====================================================================
-- MacacoFy · Migration inicial consolidada (fonte única de verdade)
-- Reproduz todo o schema public + RLS + triggers do projeto no Supabase.
-- Gerado a partir do banco em produção (projeto fadthsevmqdwgvoztqlt).
-- =====================================================================

-- ---------- TABELAS ----------

create table if not exists public.conexoes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  provedor text not null check (provedor in ('cakto','meta')),
  client_id text,
  token_acesso text,
  token_expira_em timestamptz,
  contas_ads jsonb default '[]'::jsonb,
  contas_selecionadas jsonb default '[]'::jsonb,
  status text not null default 'desconectado' check (status in ('conectado','desconectado','expirando','erro')),
  atualizado_em timestamptz not null default now(),
  criado_em timestamptz not null default now(),
  unique (usuario_id, provedor)
);

create table if not exists public.vendas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  transacao_id text not null,
  produto_nome text,
  produto_id_cakto text,
  valor_comissao numeric(12,2) not null default 0,  -- comissão líquida = FATURAMENTO
  valor_cheio numeric(12,2),
  valor_taxa numeric(12,2),
  status text not null default 'aprovada' check (status in ('aprovada','recusada','reembolsada','chargeback','pendente')),
  metodo_pagamento text,
  data_venda timestamptz not null,
  payload jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (usuario_id, transacao_id)
);
create index if not exists idx_vendas_usuario_data on public.vendas (usuario_id, data_venda);
create index if not exists idx_vendas_usuario_status on public.vendas (usuario_id, status);

create table if not exists public.gastos_ads (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  conta_ads_id text not null,
  data date not null,
  gasto numeric(12,2) not null default 0,
  imposto numeric(12,2) not null default 0,
  imposto_origem text not null default 'api' check (imposto_origem in ('api','manual')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (usuario_id, conta_ads_id, data)
);
create index if not exists idx_gastos_usuario_data on public.gastos_ads (usuario_id, data);

create table if not exists public.produtos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  produto_id_cakto text,
  conta_ads_id text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (usuario_id, produto_id_cakto)
);

create table if not exists public.custos_operacao (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  valor numeric(12,2) not null,
  tipo text not null check (tipo in ('fixo_mensal','pontual')),
  data_referencia date not null default current_date,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table if not exists public.config_custos (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  taxa_referencia_pct numeric(5,2),
  imposto_meta_manual_pct numeric(5,2),
  imposto_meta_usar_manual boolean not null default false,
  atualizado_em timestamptz not null default now()
);

-- Perfil do usuário: preenchido pelo trigger a partir do metadata do signup.
create table if not exists public.perfis (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  data_nascimento date,
  faturamento_faixa text check (faturamento_faixa in (
    'sem_faturamento','ate_5k','5k_20k','20k_50k','50k_100k','acima_100k'
  )),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Preferências de UI (ex.: métricas visíveis no dashboard).
create table if not exists public.preferencias (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  dashboard_metricas jsonb,
  atualizado_em timestamptz not null default now()
);

-- Config interna (NÃO acessível por usuários): guarda segredos como o cron_secret,
-- lidos apenas pelas Edge Functions via service_role. RLS ligado e SEM policy = deny-all proposital.
create table if not exists public.config_interna (
  chave text primary key,
  valor text not null
);

-- ---------- RLS ----------

alter table public.conexoes        enable row level security;
alter table public.vendas          enable row level security;
alter table public.gastos_ads      enable row level security;
alter table public.produtos        enable row level security;
alter table public.custos_operacao enable row level security;
alter table public.config_custos   enable row level security;
alter table public.perfis          enable row level security;
alter table public.preferencias    enable row level security;
alter table public.config_interna  enable row level security;  -- sem policy = ninguém acessa (correto)

-- Padrão em todas as tabelas de usuário: só a própria linha (usuario_id = auth.uid()).
-- conexoes
create policy conexoes_select on public.conexoes for select to authenticated using (usuario_id = (select auth.uid()));
create policy conexoes_insert on public.conexoes for insert to authenticated with check (usuario_id = (select auth.uid()));
create policy conexoes_update on public.conexoes for update to authenticated using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));
create policy conexoes_delete on public.conexoes for delete to authenticated using (usuario_id = (select auth.uid()));
-- vendas
create policy vendas_select on public.vendas for select to authenticated using (usuario_id = (select auth.uid()));
create policy vendas_insert on public.vendas for insert to authenticated with check (usuario_id = (select auth.uid()));
create policy vendas_update on public.vendas for update to authenticated using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));
create policy vendas_delete on public.vendas for delete to authenticated using (usuario_id = (select auth.uid()));
-- gastos_ads
create policy gastos_select on public.gastos_ads for select to authenticated using (usuario_id = (select auth.uid()));
create policy gastos_insert on public.gastos_ads for insert to authenticated with check (usuario_id = (select auth.uid()));
create policy gastos_update on public.gastos_ads for update to authenticated using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));
create policy gastos_delete on public.gastos_ads for delete to authenticated using (usuario_id = (select auth.uid()));
-- produtos
create policy produtos_select on public.produtos for select to authenticated using (usuario_id = (select auth.uid()));
create policy produtos_insert on public.produtos for insert to authenticated with check (usuario_id = (select auth.uid()));
create policy produtos_update on public.produtos for update to authenticated using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));
create policy produtos_delete on public.produtos for delete to authenticated using (usuario_id = (select auth.uid()));
-- custos_operacao
create policy custos_select on public.custos_operacao for select to authenticated using (usuario_id = (select auth.uid()));
create policy custos_insert on public.custos_operacao for insert to authenticated with check (usuario_id = (select auth.uid()));
create policy custos_update on public.custos_operacao for update to authenticated using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));
create policy custos_delete on public.custos_operacao for delete to authenticated using (usuario_id = (select auth.uid()));
-- config_custos
create policy config_select on public.config_custos for select to authenticated using (usuario_id = (select auth.uid()));
create policy config_insert on public.config_custos for insert to authenticated with check (usuario_id = (select auth.uid()));
create policy config_update on public.config_custos for update to authenticated using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));
create policy config_delete on public.config_custos for delete to authenticated using (usuario_id = (select auth.uid()));
-- perfis (sem delete: a linha some junto com o usuário via cascade)
create policy perfis_select on public.perfis for select to authenticated using (usuario_id = (select auth.uid()));
create policy perfis_insert on public.perfis for insert to authenticated with check (usuario_id = (select auth.uid()));
create policy perfis_update on public.perfis for update to authenticated using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));
-- preferencias
create policy preferencias_select on public.preferencias for select to authenticated using (usuario_id = (select auth.uid()));
create policy preferencias_insert on public.preferencias for insert to authenticated with check (usuario_id = (select auth.uid()));
create policy preferencias_update on public.preferencias for update to authenticated using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));
create policy preferencias_delete on public.preferencias for delete to authenticated using (usuario_id = (select auth.uid()));

-- ---------- FUNÇÕES E TRIGGERS ----------

-- Cria o perfil automaticamente a partir do metadata do signup.
-- SECURITY DEFINER + search_path vazio; EXECUTE revogado de anon/authenticated (não é chamável via RPC).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  insert into public.perfis (usuario_id, nome, data_nascimento, faturamento_faixa)
  values (
    new.id,
    nullif(new.raw_user_meta_data->>'nome', ''),
    nullif(new.raw_user_meta_data->>'data_nascimento', '')::date,
    nullif(new.raw_user_meta_data->>'faturamento_faixa', '')
  )
  on conflict (usuario_id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from anon, authenticated, public;

create or replace function public.set_atualizado_em()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- SEED ----------
-- config_interna.cron_secret é gerado manualmente e NÃO versionado. Para recriar em um
-- ambiente novo, insira um segredo forte e configure o mesmo valor no agendador de cron:
--   insert into public.config_interna (chave, valor)
--   values ('cron_secret', encode(gen_random_bytes(32), 'hex'))
--   on conflict (chave) do nothing;
