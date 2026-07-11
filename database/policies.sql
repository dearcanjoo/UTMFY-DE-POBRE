-- Cópia de referência das políticas RLS aplicadas.
-- Fonte única de verdade executável: supabase/migrations/20260710000000_init.sql
-- Padrão em todas as tabelas de usuário: só lê/escreve linhas onde usuario_id = auth.uid().

-- RLS ligado em todas as tabelas do schema public:
alter table public.conexoes        enable row level security;
alter table public.vendas          enable row level security;
alter table public.gastos_ads      enable row level security;
alter table public.produtos        enable row level security;
alter table public.custos_operacao enable row level security;
alter table public.config_custos   enable row level security;
alter table public.perfis          enable row level security;
alter table public.preferencias    enable row level security;
alter table public.config_interna  enable row level security;

-- config_interna: RLS ligado e SEM nenhuma policy = deny-all proposital. Guarda segredos
-- (cron_secret) acessados apenas pelas Edge Functions via service_role, que ignora RLS.

-- Modelo aplicado a conexoes, vendas, gastos_ads, produtos, custos_operacao e config_custos
-- (role authenticated; select/insert/update/delete):
--   create policy "<tabela>_select" on public.<tabela> for select to authenticated
--     using (usuario_id = (select auth.uid()));
--   create policy "<tabela>_insert" on public.<tabela> for insert to authenticated
--     with check (usuario_id = (select auth.uid()));
--   create policy "<tabela>_update" on public.<tabela> for update to authenticated
--     using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));
--   create policy "<tabela>_delete" on public.<tabela> for delete to authenticated
--     using (usuario_id = (select auth.uid()));

-- perfis: select/insert/update (sem delete — a linha some via cascade quando o usuário é apagado).
--   O insert inicial é feito pelo trigger handle_new_user (SECURITY DEFINER, ignora RLS).

-- preferencias: select/insert/update/delete com (auth.uid() = usuario_id).

-- Ver a lista completa e sempre atualizada na migration consolidada em supabase/migrations/.
