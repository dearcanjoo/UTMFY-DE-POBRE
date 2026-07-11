# Variáveis de ambiente

## Frontend (`frontend/.env`, e Build Args no EasyPanel)

| Variável | Descrição | Onde obter |
|---|---|---|
| `VITE_SUPABASE_URL` | URL do projeto Supabase | já preenchida: https://fadthsevmqdwgvoztqlt.supabase.co |
| `VITE_SUPABASE_ANON_KEY` | Chave pública (publishable) | já preenchida (Supabase → Settings → API) |
| `VITE_META_APP_ID` | App ID do Meta | developers.facebook.com → seu app → Configurações básicas |

## Edge Functions (Supabase → Edge Functions → Secrets)

| Secret | Descrição | Obrigatório |
|---|---|---|
| `META_APP_ID` | App ID do Meta | Sim (para OAuth) |
| `META_APP_SECRET` | App Secret do Meta | Sim (para OAuth) |
| `CAKTO_API_BASE` | Base da API da Cakto | Não (padrão: https://api.cakto.com.br/api/v1) |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são injetados automaticamente pelo Supabase nas funções — não configure manualmente.

## Segurança

- O token da Cakto e o token do Meta de cada usuário ficam na tabela `conexoes`, protegida por RLS — cada usuário só acessa a própria linha.
- O App Secret do Meta **nunca** vai para o frontend; só existe nos secrets das Edge Functions.
- Nunca commite arquivos `.env` no repositório (adicione ao `.gitignore`).
