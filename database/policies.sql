-- Cópia de referência das políticas RLS aplicadas (migration: rls_policies)
-- Padrão em todas as tabelas: o usuário só lê/escreve linhas onde usuario_id = auth.uid()

alter table public.conexoes enable row level security;
alter table public.vendas enable row level security;
alter table public.gastos_ads enable row level security;
alter table public.produtos enable row level security;
alter table public.custos_operacao enable row level security;
alter table public.config_custos enable row level security;

-- Exemplo (repetido para select/insert/update/delete em cada tabela):
-- create policy "vendas_select" on public.vendas for select to authenticated
--   using (usuario_id = (select auth.uid()));
-- create policy "vendas_insert" on public.vendas for insert to authenticated
--   with check (usuario_id = (select auth.uid()));
-- ... (ver migrations no Supabase para a lista completa aplicada)
