// Webhook da Cakto — recebe eventos de venda em tempo real.
// Auth própria: ?u=<usuario_id>&s=<webhook_secret> (validado contra a tabela conexoes).
import { createClient } from "npm:@supabase/supabase-js@2";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: true });

  const url = new URL(req.url);
  const usuarioId = url.searchParams.get("u");
  const segredo = url.searchParams.get("s");
  if (!usuarioId || !segredo) return json({ error: "parâmetros ausentes" }, 401);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: con } = await admin
    .from("conexoes").select("contas_selecionadas")
    .eq("usuario_id", usuarioId).eq("provedor", "cakto").maybeSingle();
  const esperado = con?.contas_selecionadas?.[0]?.webhook_secret;
  if (!esperado || esperado !== segredo) return json({ error: "não autorizado" }, 401);

  let payload: any;
  try { payload = await req.json(); } catch { return json({ error: "json inválido" }, 400); }

  const venda = parseCakto(payload, usuarioId);
  if (!venda) return json({ ok: true, ignorado: true });

  const { error } = await admin.from("vendas").upsert(venda, { onConflict: "usuario_id,transacao_id" });
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
});

function parseCakto(p: any, usuarioId: string) {
  const d = p?.data ?? p ?? {};
  const evento = String(p?.event ?? p?.type ?? d?.status ?? "").toLowerCase();

  let status: string | null = null;
  if (/refund|reembols/.test(evento)) status = "reembolsada";
  else if (/chargeback/.test(evento)) status = "chargeback";
  else if (/refused|declined|recusad/.test(evento)) status = "recusada";
  else if (/approved|paid|aprovad|pago/.test(evento)) status = "aprovada";
  if (!status) return null; // evento não relevante (ex: pix gerado)

  const transacaoId = String(d.id ?? d.refId ?? d.transaction_id ?? d.transactionId ?? "");
  if (!transacaoId) return null;

  const cheio = numero(d.amount ?? d.totalAmount ?? d.total ?? d.baseAmount);
  const taxaPlataforma = numero(d.fees);
  // comissão líquida = o que cai para o usuário (FATURAMENTO)
  const comissao = extrairComissao(d, cheio, taxaPlataforma);
  const taxa = taxaPlataforma ?? (cheio != null && comissao != null ? Math.max(0, cheio - comissao) : null);

  return {
    usuario_id: usuarioId,
    transacao_id: transacaoId,
    produto_nome: d.product?.name ?? d.productName ?? d.offer?.name ?? null,
    produto_id_cakto: String(d.product?.id ?? d.productId ?? d.product?.short_id ?? "") || null,
    valor_comissao: comissao ?? 0,
    valor_cheio: cheio,
    valor_taxa: taxa,
    status,
    metodo_pagamento: d.paymentMethod ?? d.payment_method ?? null,
    data_venda: d.paidAt ?? d.approvedDate ?? d.createdAt ?? d.created_at ?? new Date().toISOString(),
    payload: p,
  };
}

// Prioridade: commissions[] (schema oficial da Cakto) -> campos alternativos -> amount - fees
function extrairComissao(d: any, cheio: number | null, taxa: number | null): number | null {
  const comissoes: any[] = Array.isArray(d.commissions) ? d.commissions : [];
  if (comissoes.length === 1) return numero(comissoes[0].commissionValue);
  if (comissoes.length > 1) {
    const produtor = comissoes.find((c) => c.type === "producer");
    if (produtor) return numero(produtor.commissionValue);
  }
  const alt = numero(
    d.commission ?? d.netAmount ?? d.commissionValue ?? d.producerAmount ?? d.sellerAmount ?? d.liquidAmount,
  );
  if (alt != null) return alt;
  if (cheio != null) return taxa != null ? Math.max(0, cheio - taxa) : cheio;
  return null;
}

function numero(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}
