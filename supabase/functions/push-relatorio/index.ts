// Envia o relatório de lucro por Web Push.
//   ?job=parcial   -> "hoje até o momento" (agendado 12h e 22h BRT)
//   ?job=diario    -> fechamento do dia anterior (agendado 06h BRT)
// Autorização: header x-cron-secret validado contra config_interna.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

const TZ = "America/Sao_Paulo";
const brtDia = (offsetDias = 0) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(Date.now() - offsetDias * 86400000));
const inicioUTC = (dia: string) => `${dia}T03:00:00.000Z`; // meia-noite BRT (UTC-3) = 03:00Z
const diasNoMes = (dia: string) => { const [y, m] = dia.split("-").map(Number); return new Date(y, m, 0).getDate(); };
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

Deno.serve(async (req) => {
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const segredo = req.headers.get("x-cron-secret");
  const { data: cfgSecret } = await admin.from("config_interna").select("valor").eq("chave", "cron_secret").maybeSingle();
  if (!segredo || !cfgSecret?.valor || segredo !== cfgSecret.valor) return json({ error: "não autorizado" }, 401);

  const url = new URL(req.url);
  const job = url.searchParams.get("job") === "diario" ? "diario" : "parcial";

  // Chaves VAPID
  const { data: vap } = await admin.from("config_interna").select("chave, valor")
    .in("chave", ["vapid_public", "vapid_private", "vapid_subject"]);
  const V = Object.fromEntries((vap ?? []).map((r: any) => [r.chave, r.valor]));
  if (!V.vapid_public || !V.vapid_private) return json({ error: "VAPID não configurado" }, 500);
  webpush.setVapidDetails(V.vapid_subject || "mailto:admin@example.com", V.vapid_public, V.vapid_private);

  // Usuários que têm ao menos uma assinatura de push
  const { data: subsAll } = await admin.from("push_subscriptions").select("usuario_id, endpoint, p256dh, auth");
  const porUsuario = new Map<string, any[]>();
  for (const s of subsAll ?? []) {
    if (!porUsuario.has(s.usuario_id)) porUsuario.set(s.usuario_id, []);
    porUsuario.get(s.usuario_id)!.push(s);
  }

  const dia = job === "diario" ? brtDia(1) : brtDia(0);
  const startUTC = inicioUTC(dia);
  const endUTC = job === "diario" ? inicioUTC(brtDia(0)) : new Date().toISOString();

  const resultados: Record<string, unknown> = {};

  for (const [usuarioId, subs] of porUsuario) {
    try {
      const [{ data: vendas }, { data: gastos }, { data: custos }, { data: cfgCustos }, { data: perfil }] = await Promise.all([
        admin.from("vendas").select("status, valor_comissao, data_venda").eq("usuario_id", usuarioId).gte("data_venda", startUTC).lt("data_venda", endUTC),
        admin.from("gastos_ads").select("gasto, imposto").eq("usuario_id", usuarioId).eq("data", dia),
        admin.from("custos_operacao").select("valor, tipo, data_referencia, ativo").eq("usuario_id", usuarioId),
        admin.from("config_custos").select("imposto_meta_usar_manual, imposto_meta_manual_pct").eq("usuario_id", usuarioId).maybeSingle(),
        admin.from("perfis").select("nome").eq("usuario_id", usuarioId).maybeSingle(),
      ]);

      const m = metricasDia(vendas ?? [], gastos ?? [], custos ?? [], cfgCustos ?? {}, dia);

      // Sem nenhuma atividade no dia? Não notifica (evita spam de "R$0").
      if (m.faturamento === 0 && m.gastoAds === 0 && m.reembolsos === 0) { resultados[usuarioId.slice(0, 8)] = "sem atividade"; continue; }

      const primeiroNome = (perfil?.nome || "").trim().split(/\s+/)[0] || "";
      const payload = montarMensagem(job, m, primeiroNome);

      let ok = 0;
      for (const s of subs) if (await enviar(admin, s, payload)) ok++;
      await admin.from("notificacoes_log").insert({ usuario_id: usuarioId, tipo: job, chave: dia });
      resultados[usuarioId.slice(0, 8)] = { enviados: ok, lucro: m.lucro };
    } catch (e) {
      resultados[usuarioId.slice(0, 8)] = { erro: (e as Error).message };
    }
  }

  return json({ ok: true, job, dia, resultados });
});

function metricasDia(vendas: any[], gastos: any[], custos: any[], cfg: any, dia: string) {
  const soma = (a: number[]) => a.reduce((x, y) => x + (Number(y) || 0), 0);
  const aprovadas = vendas.filter((v) => v.status === "aprovada");
  const estornadas = vendas.filter((v) => v.status === "reembolsada" || v.status === "chargeback");
  const faturamento = soma(aprovadas.map((v) => v.valor_comissao));
  const reembolsos = soma(estornadas.map((v) => v.valor_comissao));
  const gastoAds = soma(gastos.map((g) => g.gasto));
  let impostoAds = soma(gastos.map((g) => g.imposto));
  if (cfg?.imposto_meta_usar_manual && cfg?.imposto_meta_manual_pct != null) impostoAds = gastoAds * (Number(cfg.imposto_meta_manual_pct) / 100);
  let custosOp = 0;
  for (const c of custos) {
    if (c.ativo === false) continue;
    const valor = Number(c.valor) || 0;
    if (c.tipo === "fixo_mensal") custosOp += valor / diasNoMes(dia);
    else if (c.data_referencia === dia) custosOp += valor;
  }
  // O faturamento já é só das vendas aprovadas (estornadas nem somam), então
  // NÃO se subtrai reembolsos de novo. Espelha exatamente o lucro do dashboard.
  const lucro = faturamento - gastoAds - impostoAds - custosOp;
  return { faturamento, reembolsos, gastoAds, impostoAds, custosOp, lucro };
}

function montarMensagem(job: string, m: any, nome: string) {
  const oi = nome ? `, ${nome}` : "";
  const gasto = brl(m.gastoAds), fat = brl(m.faturamento), lucro = brl(Math.abs(m.lucro));
  if (job === "diario") {
    if (m.lucro >= 0) {
      return { title: "MacacoFy · Fechamento de ontem", tag: "relatorio-diario",
        body: `Fechamento de ontem${oi}. Faturamento de ${fat}, investimento em anúncios de ${gasto} e lucro líquido de ${lucro}.` };
    }
    return { title: "MacacoFy · Fechamento de ontem", tag: "relatorio-diario",
      body: `Fechamento de ontem${oi}. Faturamento de ${fat}, investimento em anúncios de ${gasto} e prejuízo de ${lucro}.` };
  }
  if (m.lucro >= 0) {
    return { title: "Resultado de hoje", tag: "relatorio-parcial",
      body: `Faturamento: ${fat}. Investimento: ${gasto}. Lucro: ${lucro}.` };
  }
  return { title: "Resultado de hoje", tag: "relatorio-parcial",
    body: `Faturamento: ${fat}. Investimento: ${gasto}. Prejuízo: ${lucro}.` };
}

async function enviar(admin: any, sub: any, payload: unknown) {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
    );
    return true;
  } catch (e: any) {
    if (e?.statusCode === 404 || e?.statusCode === 410) {
      await admin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint); // assinatura morta
    }
    return false;
  }
}
