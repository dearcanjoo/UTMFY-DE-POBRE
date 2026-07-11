// OAuth do Meta: troca o code por token de longa duração (60 dias),
// lista as contas de anúncios e salva na tabela conexoes.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

const GRAPH = "https://graph.facebook.com/v19.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const APP_ID = Deno.env.get("META_APP_ID");
  const APP_SECRET = Deno.env.get("META_APP_SECRET");
  if (!APP_ID || !APP_SECRET) return json({ error: "META_APP_ID/META_APP_SECRET não configurados nos secrets" }, 500);

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
  );
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "não autenticado" }, 401);

  const { code, redirect_uri } = await req.json();
  if (!code || !redirect_uri) return json({ error: "code e redirect_uri são obrigatórios" }, 400);

  // 1) code -> token curto
  const r1 = await fetch(
    `${GRAPH}/oauth/access_token?client_id=${APP_ID}&redirect_uri=${encodeURIComponent(redirect_uri)}&client_secret=${APP_SECRET}&code=${code}`,
  );
  const t1 = await r1.json();
  if (!r1.ok || !t1.access_token) return json({ error: t1?.error?.message ?? "falha na troca do code" }, 400);

  // 2) token curto -> token de longa duração (~60 dias)
  const r2 = await fetch(
    `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${t1.access_token}`,
  );
  const t2 = await r2.json();
  const token = t2.access_token ?? t1.access_token;
  const expiraSeg = t2.expires_in ?? 60 * 24 * 3600;
  const expiraEm = new Date(Date.now() + expiraSeg * 1000).toISOString();

  // 3) lista contas de anúncios
  const r3 = await fetch(`${GRAPH}/me/adaccounts?fields=name,account_id,account_status&limit=100&access_token=${token}`);
  const contas = await r3.json();
  if (!r3.ok) return json({ error: contas?.error?.message ?? "falha ao listar contas" }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { error } = await admin.from("conexoes").upsert({
    usuario_id: user.id,
    provedor: "meta",
    token_acesso: token,
    token_expira_em: expiraEm,
    contas_ads: contas.data ?? [],
    status: "conectado",
  }, { onConflict: "usuario_id,provedor" });
  if (error) return json({ error: error.message }, 500);

  return json({ ok: true, contas: (contas.data ?? []).length, expira_em: expiraEm });
});
