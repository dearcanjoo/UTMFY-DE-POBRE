# Dashboard de Lucro Real — "UTMFY de Pobre"

App web/PWA que conecta as vendas da **Cakto** com os gastos do **Meta Ads** e mostra o **lucro líquido real** da operação, em tempo real.

**Conceito-chave:** o faturamento é a **comissão líquida** (o que cai para você após a taxa da Cakto). A taxa NÃO é descontada de novo — aparece só como informação.

## Infraestrutura já criada

- **Supabase:** projeto `utmfy-de-pobre` (org Utmify) — https://fadthsevmqdwgvoztqlt.supabase.co
- **Banco:** tabelas `conexoes`, `vendas`, `gastos_ads`, `produtos`, `custos_operacao`, `config_custos` com RLS ativo (cada usuário só vê os próprios dados)
- **Edge Functions deployadas:** `webhook-cakto`, `sync-cakto`, `oauth-meta`, `sync-meta-spend`, `refresh-token-meta`

## Rodar localmente

```bash
cd frontend
npm install
npm run dev
```

Abre em http://localhost:5173. O arquivo `frontend/.env` já tem a URL e a chave pública do Supabase; falta só o `VITE_META_APP_ID`.

## Configuração obrigatória (uma vez)

1. **Secrets das Edge Functions** — no painel do Supabase (Edge Functions → Secrets), adicione:
   - `META_APP_ID` = App ID do seu app no Meta for Developers
   - `META_APP_SECRET` = App Secret
2. **`frontend/.env`** — preencha `VITE_META_APP_ID` com o mesmo App ID.
3. **No app do Meta for Developers:** adicione o produto "Login do Facebook", e em *Valid OAuth Redirect URIs* cadastre `http://localhost:5173/integracoes` e a URL de produção (`https://SEU_DOMINIO/integracoes`).

Veja o passo a passo completo em [INTEGRACOES.md](./INTEGRACOES.md).

## Deploy no EasyPanel

1. Suba o projeto para um repositório Git (GitHub etc.)
2. No EasyPanel: **Create Service → App → Source: Git**
3. Build: **Dockerfile** (está na raiz do projeto)
4. Build Args:
   - `VITE_SUPABASE_URL` = https://fadthsevmqdwgvoztqlt.supabase.co
   - `VITE_SUPABASE_ANON_KEY` = (chave publishable do Supabase)
   - `VITE_META_APP_ID` = (App ID do Meta)
5. Porta: **80**. Ative HTTPS (necessário para PWA e OAuth do Meta).
6. Depois do deploy, atualize a Redirect URI no app do Meta com o domínio final.

## Instalar no celular

Abra o site no Chrome do celular → menu ⋮ → **Adicionar à tela inicial**.

## Estrutura

```
frontend/          # React + Vite (PWA)
backend/functions/ # Fontes das Edge Functions (deployadas no Supabase)
database/          # schema.sql e policies.sql (referência do que está aplicado)
docs/              # esta documentação
Dockerfile         # build de produção (EasyPanel)
```
