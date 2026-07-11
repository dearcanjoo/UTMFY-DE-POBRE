// Sincronização AUTOMÁTICA (chamada pelo pg_cron a cada 15 min).
// Roda para TODOS os usuários com conexões ativas:
//   1. Cakto: OAuth2 -> /public_api/orders/ (janela de 90 dias)
//   2. Meta: gasto diário dos últimos 3 dias das contas selecionadas
//   3. Meta: renova o token automaticamente quando faltar < 7 dias
// Auth: header x-cron-secret validado contra a tabela config_interna (service role).
import { createClient } from "npm:@supabase/supabase-js@2";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

const API_BASE = Deno.env.get("CAKTO_API_BASE") ?? "https://api.cakto.com.br";
const GRAPH = "https://graph.facebook.com/v19.0";
const DIAS_CAKTO = 90;
const DIAS_META = 3;

Deno.serve(async (req) => {
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // valida o segredo do cron
  const segredo = req.headers.get("x-cron-secret");
  const { data: cfg } = await admin.from("config_interna").select("valor").eq("chave", "cron_secret").maybeSingle();
  if (!segredo || !cfg?.valor || segredo !== cfg.valor) return json({ error: "não autorizado" }, 401);

  const { data: conexoes } = await admin
    .from("conexoes").select("usuario_id, provedor, client_id, token_acesso, token_expira_em, contas_selecionadas, status");

  const resumo: Record<string, unknown> = {};
  for (const con of conexoes ?? []) {
    try {
      if (con.provedor === "cakto" && con.client_id && con.token_acesso) {
        resumo[`cakto:${con.usuario_id.slice(0, 8)}`] = await sincronizarCakto(admin, con);
      } else if (con.provedor === "meta" && con.token_acesso && con.status !== "desconectado") {
        resumo[`meta:${con.usuario_id.slice(0, 8)}`] = await sincronizarMeta(admin, con);
      }
    } catch (e) {
      resumo[`${con.provedor}:${con.usuario_id.slice(0, 8)}`] = { erro: (e as Error).message };
    }
  }

  return json({ ok: true, executado_em: new Date().toISOString(), resumo });
});

// ===================== CAKTO =====================
async function sincronizarCakto(admin: any, con: any) {
  const tokenRes = await fetch(`${API_BASE}/public_api/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: con.client_id, client_secret: con.token_acesso }),
  });
  if (!tokenRes.ok) return { erro: `token ${tokenRes.status}` };
  const { access_token } = await tokenRes.json();

  const desde = new Date(Date.now() - DIAS_CAKTO * 86400000).toISOString().slice(0, 10);
  const headers = { Authorization: `Bearer ${access_token}` };
  const itens: any[] = [];
  for (let pagina = 1; pagina <= 50; pagina++) {
    const r = await fetch(
      `${API_BASE}/public_api/orders/?createdAt__gte=${desde}&limit=100&page=${pagina}&ordering=-createdAt`,
      { headers },
    );
    if (!r.ok) break;
    const body = await r.json();
    const mais = body?.results ?? [];
    itens.push(...mais);
    if (!body?.next || mais.length === 0) break;
  }

  let importadas = 0;
  for (const item of itens) {
    const venda = parseOrder(item, con.usuario_id);
    if (!venda) continue;
    const { error } = await admin.from("vendas").upsert(venda, { onConflict: "usuario_id,transacao_id" });
    if (!error) importadas++;
  }
  return { importadas, total: itens.length };
}

function parseOrder(d: any, usuarioId: string) {
  const transacaoId = String(d.id ?? d.refId ?? "");
  if (!transacaoId) return null;
  const status = mapearStatus(String(d.status ?? ""));
  if (!status) return null;
  const cheio = numero(d.amount) ?? numero(d.baseAmount);
  const taxa = numero(d.fees);
  const comissao = extrairComissao(d, cheio, taxa);
  return {
    usuario_id: usuarioId,
    transacao_id: transacaoId,
    produto_nome: d.product?.name ?? null,
    produto_id_cakto: String(d.product?.id ?? "") || null,
    valor_comissao: comissao ?? 0,
    valor_cheio: cheio,
    valor_taxa: taxa,
    status,
    metodo_pagamento: d.paymentMethod ?? null,
    data_venda: d.paidAt ?? d.createdAt ?? new Date().toISOString(),
    payload: d,
  };
}

function mapearStatus(st: string): string | null {
  switch (st) {
    case "paid": case "authorized": case "partially_paid": return "aprovada";
    case "refunded": case "refund_requested": return "reembolsada";
    case "chargedback": case "prechargeback": case "in_protest": case "MED": return "chargeback";
    case "refused": case "blocked": case "canceled": return "recusada";
    default: return null;
  }
}

// comissão líquida do usuário = FATURAMENTO (nunca deduzir taxa de novo)
function extrairComissao(d: any, cheio: number | null, taxa: number | null): number | null {
  const comissoes: any[] = Array.isArray(d.commissions) ? d.commissions : [];
  if (comissoes.length === 1) return numero(comissoes[0].commissionValue);
  if (comissoes.length > 1) {
    const produtor = comissoes.find((c) => c.type === "producer");
    if (produtor) return numero(produtor.commissionValue);
  }
  if (cheio != null) return taxa != null ? Math.max(0, cheio - taxa) : cheio;
  return null;
}

// ===================== META =====================
async function sincronizarMeta(admin: any, con: any) {
  let token = con.token_acesso as string;

  // token já expirado -> marca e sai
  if (con.token_expira_em && new Date(con.token_expira_em) < new Date()) {
    await admin.from("conexoes").update({ status: "expirando" })
      .eq("usuario_id", con.usuario_id).eq("provedor", "meta");
    return { erro: "token expirado" };
  }

  // renova automaticamente quando faltar < 7 dias
  const renovado = await talvezRenovarToken(admin, con, token);
  if (renovado) token = renovado;

  const contas: string[] = (con.contas_selecionadas ?? []).filter((c: unknown) => typeof c === "string");
  if (!contas.length) return { erro: "nenhuma conta selecionada" };

  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const inicio = new Date(Date.now() - DIAS_META * 86400000).toISOString().slice(0, 10);
  const timeRange = encodeURIComponent(JSON.stringify({ since: inicio, until: hoje }));

  let registros = 0;
  const erros: string[] = [];
  for (const contaId of contas) {
    const actId = contaId.startsWith("act_") ? contaId : `act_${contaId}`;
    try {
      const r = await fetch(
        `${GRAPH}/${actId}/insights?level=account&time_increment=1&fields=spend,inline_link_clicks,actions&time_range=${timeRange}&limit=500&access_token=${token}`,
      );
      const body = await r.json();
      if (!r.ok) { erros.push(`${actId}: ${body?.error?.message ?? "erro"}`); continue; }
      for (const linha of body.data ?? []) {
        const funil = extrairFunil(linha);
        const { error } = await admin.from("gastos_ads").upsert({
          usuario_id: con.usuario_id,
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
  return { dias: registros, erros: erros.length ? erros : undefined };
}

async function talvezRenovarToken(admin: any, con: any, token: string): Promise<string | null> {
  const APP_ID = Deno.env.get("META_APP_ID");
  const APP_SECRET = Deno.env.get("META_APP_SECRET");
  if (!APP_ID || !APP_SECRET || !con.token_expira_em) return null;
  const faltam = new Date(con.token_expira_em).getTime() - Date.now();
  if (faltam > 7 * 86400000) return null; // ainda longe de expirar

  const r = await fetch(
    `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${token}`,
  );
  const body = await r.json();
  if (!r.ok || !body.access_token) return null;

  const expiraEm = new Date(Date.now() + (body.expires_in ?? 60 * 24 * 3600) * 1000).toISOString();
  await admin.from("conexoes").update({
    token_acesso: body.access_token,
    token_expira_em: expiraEm,
    status: "conectado",
  }).eq("usuario_id", con.usuario_id).eq("provedor", "meta");
  return body.access_token;
}

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

function numero(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}
