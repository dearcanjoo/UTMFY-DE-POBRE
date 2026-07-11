-- Cópia de referência do schema aplicado no Supabase.
-- Fonte única de verdade executável: supabase/migrations/20260710000000_init.sql
-- Projeto: utmfy-de-pobre (fadthsevmqdwgvoztqlt)

create table public.conexoes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  provedor text not null check (provedor in ('cakto','meta')),
  client_id text,       -- Cakto: Client ID da chave de API (OAuth2)
  token_acesso text,    -- Cakto: Client Secret | Meta: access token
  token_expira_em timestamptz,
  contas_ads jsonb default '[]'::jsonb,
  contas_selecionadas jsonb default '[]'::jsonb,
  status text not null default 'desconectado' check (status in ('conectado','desconectado','expirando','erro')),
  atualizado_em timestamptz not null default now(),
  criado_em timestamptz not null default now(),
  unique (usuario_id, provedor)
);

create table public.vendas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  transacao_id text not null,
  produto_nome text,
  produto_id_cakto text,
  valor_comissao numeric(12,2) not null default 0,  -- comissão líquida = FATURAMENTO
  valor_cheio numeric(12,2),
  valor_taxa numeric(12,2),                          -- informativo
  status text not null default 'aprovada' check (status in ('aprovada','recusada','reembolsada','chargeback','pendente')),
  metodo_pagamento text,
  data_venda timestamptz not null,
  payload jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (usuario_id, transacao_id)
);
create index idx_vendas_usuario_data on public.vendas (usuario_id, data_venda);
create index idx_vendas_usuario_status on public.vendas (usuario_id, status);

create table public.gastos_ads (
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
create index idx_gastos_usuario_data on public.gastos_ads (usuario_id, data);

create table public.produtos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  produto_id_cakto text,
  conta_ads_id text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (usuario_id, produto_id_cakto)
);

create table public.custos_operacao (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  valor numeric(12,2) not null,
  tipo text not null check (tipo in ('fixo_mensal','pontual')),
  data_referencia date not null default current_date,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table public.config_custos (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  taxa_referencia_pct numeric(5,2),
  imposto_meta_manual_pct numeric(5,2),
  imposto_meta_usar_manual boolean not null default false,
  atualizado_em timestamptz not null default now()
);

-- Perfil do usuário: dados coletados no cadastro.
create table public.perfis (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  data_nascimento date,
  faturamento_faixa text check (faturamento_faixa in (
    'sem_faturamento','ate_5k','5k_20k','20k_50k','50k_100k','acima_100k'
  )),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Preferências de interface do usuário (ex.: quais métricas aparecem no dashboard).
create table public.preferencias (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  dashboard_metricas jsonb,
  atualizado_em timestamptz not null default now()
);

-- Config interna do sistema: pares chave/valor com segredos (ex.: cron_secret).
-- Acessada SOMENTE pelas Edge Functions via service_role. RLS ligado e SEM policy = deny-all
-- proposital (nenhum usuário final pode ler). Não confundir com config_custos.
create table public.config_interna (
  chave text primary key,
  valor text not null
);

-- Trigger que cria o perfil automaticamente a partir do metadata do signup:
-- public.handle_new_user() (SECURITY DEFINER, search_path vazio, EXECUTE revogado de anon/authenticated)
-- -> insert em public.perfis, disparado AFTER INSERT on auth.users (trigger on_auth_user_created).
