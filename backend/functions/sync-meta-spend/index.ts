// Puxa o gasto diário (spend) das contas de anúncios selecionadas — últimos 35 dias.
// Imposto sobre mídia: quando a API não fornece por dia, o fallback manual
// (alíquota em config_custos) é aplicado no frontend, em calculos.js.
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

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
  );
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "não autenticado" }, 401);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: con } = await admin
    .from("conexoes").select("token_acesso, contas_selecionadas, token_expira_em")
    .eq("usuario_id", user.id).eq("provedor", "meta").maybeSingle();
  if (!con?.token_acesso) return json({ error: "Meta Ads não conectado" }, 400);
  if (con.token_expira_em && new Date(con.token_expira_em) < new Date()) {
    await admin.from("conexoes").update({ status: "expirando" }).eq("usuario_id", user.id).eq("provedor", "meta");
    return json({ error: "Token do Meta expirado. Reconecte com o Facebook." }, 401);
  }

  const contas: string[] = (con.contas_selecionadas ?? []).filter((c: unknown) => typeof c === "string");
  if (!contas.length) return json({ error: "Nenhuma conta de anúncios selecionada" }, 400);

  // intervalo: últimos 35 dias (fuso de Brasília)
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const inicio = new Date(Date.now() - 35 * 86400000).toISOString().slice(0, 10);

  let registros = 0;
  const erros: string[] = [];

  for (const contaId of contas) {
    const actId = contaId.startsWith("act_") ? contaId : `act_${contaId}`;
    const timeRange = encodeURIComponent(JSON.stringify({ since: inicio, until: hoje }));
    const url = `${GRAPH}/${actId}/insights?level=account&time_increment=1&fields=spend,inline_link_clicks,actions&time_range=${timeRange}&limit=500&access_token=${con.token_acesso}`;
    try {
      const r = await fetch(url);
      const body = await r.json();
      if (!r.ok) { erros.push(`${actId}: ${body?.error?.message ?? "erro"}`); continue; }
      for (const linha of body.data ?? []) {
        const funil = extrairFunil(linha);
        const { error } = await admin.from("gastos_ads").upsert({
          usuario_id: user.id,
          conta_ads_id: contaId,
          data: linha.date_start,
          gasto: Number(linha.spend) || 0,
          imposto: 0,
          imposto_origem: "api",
          ...funil,
        }, { onConflict: "usuario_id,conta_ads_id,data" });
        if (!error) registros++;
      }
    } catch (e) {
      erros.push(`${actId}: ${(e as Error).message}`);
    }
  }

  return json({ ok: true, dias: registros, erros: erros.length ? erros : undefined });
});

// Funil: cliques no link + eventos do pixel reportados pela API de Insights
// (landing_page_view = visualização de página; initiate_checkout = checkout aberto)
function extrairFunil(linha: any) {
  const acoes: any[] = Array.isArray(linha.actions) ? linha.actions : [];
  const valor = (tipos: string[]) => {
    for (const t of tipos) {
      const a = acoes.find((x) => x.action_type === t);
      if (a) return Number(a.value) || 0;
    }
    return 0;
  };
  return {
    cliques: Number(linha.inline_link_clicks) || 0,
    visualizacoes_pagina: valor(["landing_page_view", "omni_landing_page_view"]),
    checkouts_iniciados: valor([
      "initiate_checkout",
      "omni_initiated_checkout",
      "offsite_conversion.fb_pixel_initiate_checkout",
    ]),
  };
}
