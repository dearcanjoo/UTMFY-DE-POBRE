// Verifica a saúde das contas de anúncio selecionadas e envia alertas por Web Push:
//   3) saldo pré-pago abaixo de R$10  |  cobrança recusada/pendente (cartão)
//   4) conta parada/bloqueada (com o nome da conta e o motivo)
// Roda periodicamente pelo pg_cron. Dedupe de 12h por (tipo, conta) via notificacoes_log.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

const GRAPH = "https://graph.facebook.com/v19.0";
const LIMITE_SALDO = 10;         // reais
const DEDUPE_HORAS = 12;
const CAMPOS = "name,account_status,disable_reason,balance,currency,funding_source_details";

Deno.serve(async (req) => {
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const segredo = req.headers.get("x-cron-secret");
  const { data: cfgSecret } = await admin.from("config_interna").select("valor").eq("chave", "cron_secret").maybeSingle();
  if (!segredo || !cfgSecret?.valor || segredo !== cfgSecret.valor) return json({ error: "não autorizado" }, 401);

  const { data: vap } = await admin.from("config_interna").select("chave, valor")
    .in("chave", ["vapid_public", "vapid_private", "vapid_subject"]);
  const V = Object.fromEntries((vap ?? []).map((r: any) => [r.chave, r.valor]));
  if (!V.vapid_public || !V.vapid_private) return json({ error: "VAPID não configurado" }, 500);
  webpush.setVapidDetails(V.vapid_subject || "mailto:admin@example.com", V.vapid_public, V.vapid_private);

  const { data: conexoes } = await admin.from("conexoes")
    .select("usuario_id, token_acesso, token_expira_em, contas_selecionadas, contas_ads, status")
    .eq("provedor", "meta");

  const resultados: Record<string, unknown> = {};

  for (const con of conexoes ?? []) {
    const uid = con.usuario_id as string;
    try {
      if (!con.token_acesso || con.status === "desconectado") { resultados[uid.slice(0, 8)] = "sem token"; continue; }
      if (con.token_expira_em && new Date(con.token_expira_em) < new Date()) { resultados[uid.slice(0, 8)] = "token expirado"; continue; }

      const contas: string[] = (con.contas_selecionadas ?? []).filter((c: unknown) => typeof c === "string");
      if (!contas.length) { resultados[uid.slice(0, 8)] = "nenhuma conta selecionada"; continue; }

      // assinaturas do usuário (se não tem, nem consulta a API)
      const { data: subs } = await admin.from("push_subscriptions").select("endpoint, p256dh, auth").eq("usuario_id", uid);
      if (!subs?.length) { resultados[uid.slice(0, 8)] = "sem assinatura"; continue; }

      const alertas: { tipo: string; chave: string; payload: any }[] = [];

      for (const contaId of contas) {
        const actId = contaId.startsWith("act_") ? contaId : `act_${contaId}`;
        const r = await fetch(`${GRAPH}/${actId}?fields=${CAMPOS}&access_token=${con.token_acesso}`);
        const c = await r.json();
        if (!r.ok) continue;
        const nome = c.name || actId;
        const status = Number(c.account_status);
        const motivo = Number(c.disable_reason);

        // 4) conta parada/bloqueada
        if ([2, 7, 100, 101].includes(status)) {
          alertas.push({
            tipo: "meta_bloqueio", chave: actId,
            payload: {
              title: "Conta de anúncio parada", tag: `meta-bloqueio-${actId}`, url: "/",
              body: `A conta "${nome}" parou de rodar: ${textoStatus(status)}${motivo ? `. Motivo: ${textoMotivo(motivo)}` : ""}. Verifique no Gerenciador de Anúncios.`,
            },
          });
          continue; // conta parada já é o alerta mais grave; não duplica com saldo
        }

        // 3a) cobrança recusada / pagamento pendente (cartão)
        if ([3, 8, 9].includes(status)) {
          alertas.push({
            tipo: "meta_cartao", chave: actId,
            payload: {
              title: "Cobrança recusada", tag: `meta-cartao-${actId}`, url: "/",
              body: `A conta "${nome}" está com pagamento pendente/recusado (${textoStatus(status)}). Atualize o cartão ou adicione saldo para os anúncios continuarem.`,
            },
          });
          continue;
        }

        // 3b) saldo pré-pago baixo (parse do display_string do funding source)
        const saldo = saldoPrePago(c.funding_source_details);
        if (saldo != null && saldo < LIMITE_SALDO) {
          alertas.push({
            tipo: "meta_saldo", chave: actId,
            payload: {
              title: "Saldo baixo", tag: `meta-saldo-${actId}`, url: "/",
              body: `A conta "${nome}" está com saldo de ${brl(saldo)} (abaixo de ${brl(LIMITE_SALDO)}). Adicione saldo via Pix para os anúncios não pausarem.`,
            },
          });
        }
      }

      // dedupe + envio
      let enviados = 0;
      for (const a of alertas) {
        const desde = new Date(Date.now() - DEDUPE_HORAS * 3600000).toISOString();
        const { data: jaEnviado } = await admin.from("notificacoes_log")
          .select("id").eq("usuario_id", uid).eq("tipo", a.tipo).eq("chave", a.chave).gte("enviado_em", desde).limit(1);
        if (jaEnviado?.length) continue; // já avisou há pouco

        for (const s of subs) if (await enviarPush(admin, s, a.payload)) enviados++;
        await admin.from("notificacoes_log").insert({ usuario_id: uid, tipo: a.tipo, chave: a.chave });
      }
      resultados[uid.slice(0, 8)] = { alertas: alertas.length, enviados };
    } catch (e) {
      resultados[uid.slice(0, 8)] = { erro: (e as Error).message };
    }
  }

  return json({ ok: true, resultados });
});

// "Saldo disponível (R$409,71 BRL)" -> 409.71 ; retorna null se não for pré-pago/sem saldo legível
function saldoPrePago(f: any): number | null {
  if (!f || typeof f.display_string !== "string") return null;
  const s = f.display_string.toLowerCase();
  if (!s.includes("saldo")) return null;
  const m = f.display_string.match(/R\$\s*([\d.]+,\d{2})/);
  if (!m) return null;
  return Number(m[1].replace(/\./g, "").replace(",", "."));
}

function textoStatus(s: number): string {
  switch (s) {
    case 2: return "conta desativada";
    case 3: return "não resolvida (pagamento pendente)";
    case 7: return "em análise de risco";
    case 8: return "aguardando liquidação";
    case 9: return "em período de carência";
    case 100: return "em processo de encerramento";
    case 101: return "encerrada";
    default: return `status ${s}`;
  }
}
function textoMotivo(r: number): string {
  switch (r) {
    case 1: return "violação das políticas de anúncios";
    case 2: return "revisão de propriedade intelectual";
    case 3: return "risco de pagamento";
    case 4: return "encerramento de conta";
    case 5: return "revisão de conformidade";
    case 6: return "risco de integridade do negócio";
    case 7: return "encerramento permanente";
    default: return "motivo não especificado";
  }
}
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

async function enviarPush(admin: any, sub: any, payload: unknown) {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
    );
    return true;
  } catch (e: any) {
    if (e?.statusCode === 404 || e?.statusCode === 410) {
      await admin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    }
    return false;
  }
}
