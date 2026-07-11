-- Cópia de referência do schema aplicado no Supabase (migration: schema_inicial)
-- Projeto: utmfy-de-pobre (fadthsevmqdwgvoztqlt)

create table public.conexoes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  provedor text not null check (provedor in ('cakto','meta')),
  client_id text,       -- Cakto: Client ID da chave de API (OAuth2) [migration: cakto_client_id]
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
