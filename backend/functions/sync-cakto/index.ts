// Sincronização/reconciliação de vendas via API pública da Cakto (OAuth2).
// Fluxo: client_id + client_secret -> access_token -> GET /public_api/orders/
// Rede de segurança para webhooks perdidos. Chamada autenticada pelo usuário logado.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

const API_BASE = Deno.env.get("CAKTO_API_BASE") ?? "https://api.cakto.com.br";
const DIAS_JANELA = 90; // busca pedidos criados nos últimos 90 dias

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  // identifica o usuário pelo JWT
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
  );
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "não autenticado" }, 401);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: con } = await admin
    .from("conexoes").select("client_id, token_acesso")
    .eq("usuario_id", user.id).eq("provedor", "cakto").maybeSingle();
  if (!con?.client_id || !con?.token_acesso) {
    return json({ error: "Cakto não conectada. Salve o Client ID e o Client Secret primeiro." }, 400);
  }

  // 1) troca credenciais por access_token (OAuth2)
  const tokenRes = await fetch(`${API_BASE}/public_api/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: con.client_id, client_secret: con.token_acesso }),
  });
  if (!tokenRes.ok) {
    return json({ error: "Credenciais da Cakto inválidas. Verifique Client ID e Client Secret." }, 401);
  }
  const { access_token } = await tokenRes.json();

  // 2) lista pedidos paginados (janela de DIAS_JANELA dias)
  const desde = new Date(Date.now() - DIAS_JANELA * 86400000).toISOString().slice(0, 10);
  const headers = { Authorization: `Bearer ${access_token}` };
  const itens: any[] = [];

  for (let pagina = 1; pagina <= 50; pagina++) {
    const url = `${API_BASE}/public_api/orders/?createdAt__gte=${desde}&limit=100&page=${pagina}&ordering=-createdAt`;
    const r = await fetch(url, { headers });
    if (!r.ok) {
      if (pagina === 1) {
        const detalhe = await r.text().catch(() => "");
        return json({ error: `Erro ao listar pedidos na Cakto (${r.status}). ${detalhe.slice(0, 200)}` }, 502);
      }
      break;
    }
    const body = await r.json();
    const mais = body?.results ?? [];
    itens.push(...mais);
    if (!body?.next || mais.length === 0) break;
  }

  let importadas = 0;
  for (const item of itens) {
    const venda = parseOrder(item, user.id);
    if (!venda) continue;
    const { error } = await admin.from("vendas").upsert(venda, { onConflict: "usuario_id,transacao_id" });
    if (!error) importadas++;
  }

  return json({ ok: true, importadas, total_encontradas: itens.length });
});

// Mapeia um pedido da Cakto (schema /public_api/orders/) para a tabela vendas
function parseOrder(d: any, usuarioId: string) {
  const transacaoId = String(d.id ?? d.refId ?? "");
  if (!transacaoId) return null;

  const status = mapearStatus(String(d.status ?? ""));
  if (!status) return null; // ignora status intermediários (processing, waiting_payment...)

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
    case "paid":
    case "authorized":
    case "partially_paid":
      return "aprovada";
    case "refunded":
    case "refund_requested":
      return "reembolsada";
    case "chargedback":
    case "prechargeback":
    case "in_protest":
    case "MED":
      return "chargeback";
    case "refused":
    case "blocked":
    case "canceled":
      return "recusada";
    default:
      return null; // processing, waiting_payment, scheduled, retrying...
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
  // fallback: valor cheio menos taxas da plataforma
  if (cheio != null) return taxa != null ? Math.max(0, cheio - taxa) : cheio;
  return null;
}

function numero(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}
