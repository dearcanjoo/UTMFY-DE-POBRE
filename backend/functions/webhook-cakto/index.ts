// Webhook da Cakto — recebe eventos de venda em tempo real.
// Auth própria: ?u=<usuario_id>&s=<webhook_secret> (validado contra a tabela conexoes).
// Extras em venda aprovada:
//   1. Purchase server-side para o Pixel do Meta via API de Conversões (CAPI)
//   2. Notificação push "Venda aprovada no Pix/Cartão! Sua comissão: R$ X"
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const GRAPH = "https://graph.facebook.com/v19.0";

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

  // Estado anterior: evita reenviar CAPI e push quando a Cakto repete o evento.
  const { data: existente } = await admin
    .from("vendas").select("capi_enviado_em, status")
    .eq("usuario_id", usuarioId).eq("transacao_id", venda.transacao_id).maybeSingle();

  // "Pix gerado" atrasado nunca rebaixa uma venda que já tem status final.
  if (venda.status === "pendente" && existente &&
      ["aprovada", "reembolsada", "chargeback", "recusada"].includes(existente.status)) {
    return json({ ok: true, ignorado: "status final preservado" });
  }

  const { error } = await admin.from("vendas").upsert(venda, { onConflict: "usuario_id,transacao_id" });
  if (error) return json({ error: error.message }, 500);

  const aprovouAgora = venda.status === "aprovada" && existente?.status !== "aprovada";
  const gerouPagamentoAgora = venda.status === "pendente" && !existente;

  // ===== CAPI: Purchase (venda aprovada) e InitiateCheckout (Pix/boleto gerado) =====
  let capi: string | undefined;
  if (venda.status === "aprovada" && !existente?.capi_enviado_em) {
    capi = await enviarEventoCapi(admin, usuarioId, venda, payload?.data ?? payload ?? {}, "Purchase");
  } else if (gerouPagamentoAgora) {
    capi = await enviarEventoCapi(admin, usuarioId, venda, payload?.data ?? payload ?? {}, "InitiateCheckout");
  }

  // ===== Push: "Venda aprovada no Pix! Sua comissão: R$ X" =====
  if (aprovouAgora) {
    try { await notificarVenda(admin, usuarioId, venda); } catch { /* push nunca derruba o webhook */ }
  }

  return json({ ok: true, capi });
});

// Notificação push imediata de venda aprovada
async function notificarVenda(admin: any, usuarioId: string, venda: any) {
  const { data: subs } = await admin.from("push_subscriptions")
    .select("endpoint, p256dh, auth").eq("usuario_id", usuarioId);
  if (!subs?.length) return;

  const { data: vap } = await admin.from("config_interna").select("chave, valor")
    .in("chave", ["vapid_public", "vapid_private", "vapid_subject"]);
  const V = Object.fromEntries((vap ?? []).map((r: any) => [r.chave, r.valor]));
  if (!V.vapid_public || !V.vapid_private) return;
  webpush.setVapidDetails(V.vapid_subject || "mailto:admin@macacofy.com", V.vapid_public, V.vapid_private);

  const valor = (Number(venda.valor_comissao) || 0)
    .toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const mensagem = {
    title: `Venda aprovada no ${nomePagamento(venda.metodo_pagamento)}!`,
    body: `Sua comissão: ${valor}`,
    tag: `venda-${venda.transacao_id}`, // mesma venda não notifica duas vezes
  };

  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(mensagem),
      );
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) {
        await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
      }
    }
  }
}

function nomePagamento(metodo: unknown): string {
  const m = String(metodo ?? "").toLowerCase();
  if (m.includes("pix")) return "Pix";
  if (m.includes("boleto")) return "Boleto";
  if (m.includes("card") || m.includes("cartao") || m.includes("credit")) return "Cartão";
  return m ? m.charAt(0).toUpperCase() + m.slice(1) : "checkout";
}

// Envia um evento à API de Conversões do Meta (Purchase ou InitiateCheckout).
async function enviarEventoCapi(admin: any, usuarioId: string, venda: any, d: any, nomeEvento: string): Promise<string> {
  const { data: cfg } = await admin
    .from("config_custos").select("pixel_id, capi_token, capi_ativo")
    .eq("usuario_id", usuarioId).maybeSingle();
  if (!cfg?.capi_ativo || !cfg?.pixel_id || !cfg?.capi_token) return "desativado";

  try {
    const cliente = d.customer ?? {};
    const user_data: Record<string, unknown> = {};

    const email = normalizarEmail(cliente.email);
    if (email) user_data.em = [await sha256(email)];

    const fone = normalizarTelefone(cliente.phone ?? cliente.cellphone ?? cliente.phone_number);
    if (fone) user_data.ph = [await sha256(fone)];

    const nome = normalizarNome(cliente.name ?? cliente.fullName);
    if (nome.fn) user_data.fn = [await sha256(nome.fn)];
    if (nome.ln) user_data.ln = [await sha256(nome.ln)];

    const docOuId = String(cliente.id ?? cliente.docNumber ?? cliente.document ?? "").trim();
    if (docOuId) user_data.external_id = [await sha256(docOuId)];
    user_data.country = [await sha256("br")];

    // _fbc a partir do fbclid que o checkout da Cakto anexa ao utm_content
    // ("nome|id::<fbclid>::") — mesmo dado que o script da UTMify captura na página.
    const fbclid = extrairFbclid(d.utm_content);
    if (fbclid) user_data.fbc = `fb.1.${Date.now()}.${fbclid}`;

    if (Object.keys(user_data).length < 2) return "sem dados do comprador";

    // event_time: máx. 7 dias no passado, nunca no futuro
    const agora = Math.floor(Date.now() / 1000);
    let eventTime = Math.floor(new Date(venda.data_venda).getTime() / 1000) || agora;
    if (eventTime > agora || agora - eventTime > 6 * 86400) eventTime = agora;

    const evento = {
      event_name: nomeEvento,
      event_time: eventTime,
      event_id: nomeEvento === "Purchase" ? `cakto_${venda.transacao_id}` : `cakto_ic_${venda.transacao_id}`, // deduplicação
      action_source: "website",
      event_source_url: d.checkoutUrl ?? undefined,
      user_data,
      custom_data: {
        currency: "BRL",
        value: Number(venda.valor_cheio ?? venda.valor_comissao) || 0,
        content_name: venda.produto_nome ?? undefined,
        content_ids: venda.produto_id_cakto ? [venda.produto_id_cakto] : undefined,
        content_type: "product",
      },
    };

    const r = await fetch(`${GRAPH}/${cfg.pixel_id}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: [evento], access_token: cfg.capi_token }),
    });
    const body = await r.json();

    if (r.ok && body.events_received >= 1) {
      if (nomeEvento === "Purchase") {
        await admin.from("vendas")
          .update({ capi_enviado_em: new Date().toISOString(), capi_erro: null })
          .eq("usuario_id", usuarioId).eq("transacao_id", venda.transacao_id);
      }
      return `${nomeEvento} enviado`;
    }
    const msg = body?.error?.message ?? `HTTP ${r.status}`;
    await admin.from("vendas").update({ capi_erro: String(msg).slice(0, 300) })
      .eq("usuario_id", usuarioId).eq("transacao_id", venda.transacao_id);
    return `erro: ${msg}`;
  } catch (e) {
    const msg = (e as Error).message;
    await admin.from("vendas").update({ capi_erro: msg.slice(0, 300) })
      .eq("usuario_id", usuarioId).eq("transacao_id", venda.transacao_id);
    return `erro: ${msg}`;
  }
}

// ===== Normalização no padrão do Meta (antes do hash) =====
function normalizarEmail(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  return s.includes("@") ? s : null;
}

function normalizarTelefone(v: unknown): string | null {
  let s = typeof v === "string" ? v.replace(/\D/g, "") : "";
  if (!s) return null;
  if (s.length === 10 || s.length === 11) s = "55" + s; // DDD sem código do país
  return s.length >= 12 ? s : null;
}

function normalizarNome(v: unknown): { fn: string | null; ln: string | null } {
  const s = typeof v === "string"
    ? v.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    : "";
  if (!s) return { fn: null, ln: null };
  const partes = s.split(/\s+/);
  return { fn: partes[0] || null, ln: partes.length > 1 ? partes[partes.length - 1] : null };
}

// fbclid vem embutido no utm_content entre "::" (padrão observado no checkout da Cakto)
function extrairFbclid(utm: unknown): string | null {
  const s = typeof utm === "string" ? utm : "";
  const m = s.match(/::([A-Za-z0-9_-]{20,})::/);
  return m ? m[1] : null;
}

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function parseCakto(p: any, usuarioId: string) {
  const d = p?.data ?? p ?? {};
  const evento = String(p?.event ?? p?.type ?? d?.status ?? "").toLowerCase();

  let status: string | null = null;
  if (/refund|reembols/.test(evento)) status = "reembolsada";
  else if (/chargeback/.test(evento)) status = "chargeback";
  else if (/refused|declined|recusad/.test(evento)) status = "recusada";
  else if (/approved|paid|aprovad|pago/.test(evento)) status = "aprovada";
  else if (/(pix|boleto).*(gerad|criad|emitid)|waiting_payment|pending|aguardando/.test(evento)) status = "pendente";
  if (!status) return null; // evento sem mapeamento

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
    ...extrairUtms(d),
  };
}

// UTMs capturadas pelo checkout da Cakto (atribuição por criativo)
function extrairUtms(d: any) {
  const limpar = (v: unknown) => {
    const s = typeof v === "string" ? v.trim() : "";
    return s || null;
  };
  return {
    utm_source: limpar(d.utm_source),
    utm_medium: limpar(d.utm_medium),
    utm_campaign: limpar(d.utm_campaign),
    utm_content: limpar(d.utm_content),
    utm_term: limpar(d.utm_term),
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
