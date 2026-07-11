// Renova o token de longa duração do Meta (mais ~60 dias) sem novo login,
// enquanto o token atual ainda for válido.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const APP_ID = Deno.env.get("META_APP_ID");
  const APP_SECRET = Deno.env.get("META_APP_SECRET");
  if (!APP_ID || !APP_SECRET) return json({ error: "META_APP_ID/META_APP_SECRET não configurados" }, 500);

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
  );
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "não autenticado" }, 401);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: con } = await admin
    .from("conexoes").select("token_acesso")
    .eq("usuario_id", user.id).eq("provedor", "meta").maybeSingle();
  if (!con?.token_acesso) return json({ error: "Meta não conectado" }, 400);

  const r = await fetch(
    `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${con.token_acesso}`,
  );
  const body = await r.json();
  if (!r.ok || !body.access_token) {
    return json({ error: body?.error?.message ?? "falha ao renovar — reconecte com o Facebook" }, 400);
  }

  const expiraEm = new Date(Date.now() + (body.expires_in ?? 60 * 24 * 3600) * 1000).toISOString();
  await admin.from("conexoes").update({
    token_acesso: body.access_token,
    token_expira_em: expiraEm,
    status: "conectado",
  }).eq("usuario_id", user.id).eq("provedor", "meta");

  return json({ ok: true, expira_em: expiraEm });
});
