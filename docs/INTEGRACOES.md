# Passo a passo das integrações

## Cakto

### 1. Chave de API (OAuth2)
1. No painel da Cakto, crie uma **Chave de API** com escopos **Leitura** e **Pedidos** (menor privilégio possível). A Cakto gera um **Client ID** e um **Client Secret**.
2. No app, vá em **Integrações → Cakto**, cole o Client ID e o Client Secret e salve.
3. A cada sincronização, o app troca as credenciais por um token temporário em `POST /public_api/token/` — você não precisa renovar nada.

### 2. Webhook (tempo real)
1. Depois de salvar as credenciais, o app mostra a **URL do webhook** (única por usuário, com segredo embutido).
2. No painel da Cakto, cadastre essa URL como webhook para os eventos: **compra aprovada, compra recusada, reembolso, chargeback**.
3. Pronto — cada venda aparece no dashboard em segundos.

### 3. Sincronização (rede de segurança)
O botão **"Sincronizar vendas"** puxa o histórico pela API e reconcilia qualquer venda que o webhook tenha perdido. Use após configurar, e de vez em quando.

> **Nota:** a função `sync-cakto` usa o endpoint oficial `GET /public_api/orders/` (janela de 90 dias, paginado). A base da API pode ser alterada pelo secret `CAKTO_API_BASE` (padrão `https://api.cakto.com.br`).

## Sincronização automática (sem clicar em nada)

Tudo roda sozinho no servidor — os botões da tela de Integrações viraram apenas um "forçar agora":

- **`sync-agendado`** (Edge Function): executada pelo `pg_cron` **a cada 5 minutos**. Para todos os usuários conectados, ela puxa os pedidos da Cakto (90 dias), o gasto do Meta (últimos 3 dias) e **renova o token do Meta automaticamente** quando faltar menos de 7 dias para expirar.
- **Autenticação do cron:** header `x-cron-secret`, validado contra a tabela `config_interna` (RLS ligado, só o service role lê).
- **Tempo real na tela:** o dashboard usa Supabase Realtime (tabelas `vendas` e `gastos_ads`) + refresh a cada 60s — venda que chega pelo webhook aparece na hora, sem recarregar a página.
- **Sync ao abrir o app:** o hook `useSyncAutomatico` dispara `sync-cakto` e `sync-meta-spend` em segundo plano quando você abre o app ou volta pra aba (com intervalo mínimo de 3 min entre disparos).
- Agendamento registrado no banco: `select * from cron.job;` (job `sync-automatico`).

## Meta Ads

### 1. Criar/configurar o app no Meta for Developers
1. Em https://developers.facebook.com, use seu app existente (tipo **Business**).
2. Adicione o produto **Login do Facebook**.
3. Em **Login do Facebook → Configurações → Valid OAuth Redirect URIs**, adicione:
   - `http://localhost:5173/integracoes` (desenvolvimento)
   - `https://SEU_DOMINIO/integracoes` (produção)
4. Permissões usadas: `ads_read` e `read_insights` (somente leitura). Para uso nas **suas próprias contas**, o Standard Access basta — sem App Review.

### 2. Chaves
- **Supabase → Edge Functions → Secrets:** `META_APP_ID` e `META_APP_SECRET`
- **frontend/.env:** `VITE_META_APP_ID`

### 3. Conectar no app
1. **Integrações → Conectar com Facebook** → faça login e autorize.
2. O app troca o código por um **token de 60 dias** e lista suas contas de anúncios.
3. Marque as contas que quer acompanhar.
4. Clique em **"Sincronizar gastos"** — o gasto diário dos últimos 35 dias entra no dashboard.

### 4. Renovação do token (~60 dias)
- O app avisa com 7 dias de antecedência (indicador amarelo em Integrações).
- Botão **"Renovar agora"** estende por mais 60 dias sem novo login (enquanto o token atual for válido).
- Se expirar de vez, basta clicar em **"Conectar com Facebook"** novamente.

### 5. Imposto sobre mídia
- O campo de imposto por dia fica em `gastos_ads.imposto`. Quando a API não fornece o imposto discriminado, use o **fallback manual**: em **Custos → Imposto do Meta Ads**, ative a alíquota manual (ex: o percentual de imposto que aparece na sua fatura do Meta). O cálculo aplica a alíquota sobre o gasto automaticamente.
