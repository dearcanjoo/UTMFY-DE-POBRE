// =====================================================================
// Catálogo de métricas do dashboard — fonte única.
// Cada métrica: id (chave em calcularMetricas), rótulo, categoria,
// formato de exibição e semântica de cor.
//
// semantica:
//   'lucro'     → verde se > 0, vermelho se < 0
//   'custo'     → vermelho se > 0
//   'bom-alto'  → verde se >= limiar (padrão 0), vermelho abaixo
//   'ruim-alto' → vermelho se > limiar (taxas de reembolso etc.)
//   'neutro'    → sem cor
// =====================================================================
import { moeda, pct, num } from './formato.js'

export const CATEGORIAS = [
  { id: 'resultado', rotulo: 'Resultado' },
  { id: 'receita', rotulo: 'Receita' },
  { id: 'anuncios', rotulo: 'Anúncios' },
  { id: 'custos', rotulo: 'Custos' },
  { id: 'risco', rotulo: 'Risco e aprovação' },
  { id: 'pagamento', rotulo: 'Formas de pagamento' },
]

export const CATALOGO = [
  // ===== Resultado =====
  { id: 'lucro', rotulo: 'Lucro líquido', categoria: 'resultado', formato: 'moeda', semantica: 'lucro',
    descricao: 'Faturamento menos estornos, anúncios, imposto e custos da operação.' },
  { id: 'margem', rotulo: 'Margem de lucro', categoria: 'resultado', formato: 'pct', semantica: 'lucro',
    descricao: 'Lucro dividido pelo faturamento.' },
  { id: 'roi', rotulo: 'ROI real', categoria: 'resultado', formato: 'pct', semantica: 'lucro',
    descricao: 'Lucro dividido pelo custo total. Retorno sobre tudo que saiu do bolso.' },
  { id: 'lucroPorVenda', rotulo: 'Lucro por venda', categoria: 'resultado', formato: 'moeda', semantica: 'lucro',
    descricao: 'Quanto sobra, em média, de cada venda aprovada.' },
  { id: 'lucroSobreGasto', rotulo: 'Lucro por real investido', categoria: 'resultado', formato: 'num', semantica: 'lucro',
    descricao: 'Quantos reais de lucro cada R$ 1,00 de anúncio gerou.' },

  // ===== Receita =====
  { id: 'faturamento', rotulo: 'Faturamento líquido', categoria: 'receita', formato: 'moeda', semantica: 'neutro',
    descricao: 'Soma das comissões líquidas (o que realmente cai na sua conta).' },
  { id: 'faturamentoBruto', rotulo: 'Faturamento bruto', categoria: 'receita', formato: 'moeda', semantica: 'neutro',
    descricao: 'Valor cheio das vendas, antes da taxa da plataforma.' },
  { id: 'ticketMedio', rotulo: 'Ticket médio (líquido)', categoria: 'receita', formato: 'moeda', semantica: 'neutro',
    descricao: 'Faturamento líquido dividido pelo número de vendas.' },
  { id: 'ticketMedioBruto', rotulo: 'Ticket médio (bruto)', categoria: 'receita', formato: 'moeda', semantica: 'neutro',
    descricao: 'Valor cheio médio por venda.' },
  { id: 'numVendas', rotulo: 'Vendas aprovadas', categoria: 'receita', formato: 'int', semantica: 'neutro',
    descricao: 'Quantidade de vendas aprovadas no período.' },
  { id: 'vendasPorDia', rotulo: 'Vendas por dia', categoria: 'receita', formato: 'num', semantica: 'neutro',
    descricao: 'Média de vendas aprovadas por dia do período.' },

  // ===== Anúncios =====
  { id: 'gastoAds', rotulo: 'Gasto em anúncios', categoria: 'anuncios', formato: 'moeda', semantica: 'custo',
    descricao: 'Investimento total no Meta Ads no período.' },
  { id: 'roas', rotulo: 'ROAS', categoria: 'anuncios', formato: 'num', semantica: 'bom-alto', limiar: 1,
    descricao: 'Faturamento líquido dividido pelo gasto em anúncios.' },
  { id: 'cpa', rotulo: 'CPA real', categoria: 'anuncios', formato: 'moeda', semantica: 'neutro',
    descricao: 'Custo total (ads + imposto + operação + estornos) por venda aprovada.' },
  { id: 'cpaAds', rotulo: 'CPA de mídia', categoria: 'anuncios', formato: 'moeda', semantica: 'neutro',
    descricao: 'Só o gasto de anúncio + imposto, dividido pelas vendas.' },
  { id: 'impostoAds', rotulo: 'Imposto sobre mídia', categoria: 'anuncios', formato: 'moeda', semantica: 'custo',
    descricao: 'Imposto pago sobre o gasto de anúncios.' },
  { id: 'gastoDiarioMedio', rotulo: 'Gasto diário médio', categoria: 'anuncios', formato: 'moeda', semantica: 'neutro',
    descricao: 'Gasto em anúncios dividido pelos dias do período.' },

  // ===== Custos =====
  { id: 'custoTotal', rotulo: 'Custo total', categoria: 'custos', formato: 'moeda', semantica: 'custo',
    descricao: 'Ads + imposto + custos da operação + estornos.' },
  { id: 'custosOperacao', rotulo: 'Custos da operação', categoria: 'custos', formato: 'moeda', semantica: 'custo',
    descricao: 'Ferramentas e custos manuais (fixos rateados + pontuais).' },
  { id: 'taxasPagas', rotulo: 'Taxas da Cakto', categoria: 'custos', formato: 'moeda', semantica: 'neutro', selo: 'info',
    descricao: 'Informativo: quanto você pagou de taxa. Já descontado do faturamento — não conta duas vezes.' },

  // ===== Risco e aprovação =====
  { id: 'reembolsos', rotulo: 'Estornos (total)', categoria: 'risco', formato: 'moeda', semantica: 'custo',
    descricao: 'Comissões devolvidas: reembolsos + chargebacks.' },
  { id: 'valorReembolsado', rotulo: 'Reembolsos (R$)', categoria: 'risco', formato: 'moeda', semantica: 'custo',
    descricao: 'Só os reembolsos, sem chargebacks.' },
  { id: 'valorChargeback', rotulo: 'Chargebacks (R$)', categoria: 'risco', formato: 'moeda', semantica: 'custo',
    descricao: 'Valor devolvido em chargebacks/disputas.' },
  { id: 'numReembolsos', rotulo: 'Reembolsos (nº)', categoria: 'risco', formato: 'int', semantica: 'neutro',
    descricao: 'Quantidade de vendas reembolsadas no período.' },
  { id: 'numChargebacks', rotulo: 'Chargebacks (nº)', categoria: 'risco', formato: 'int', semantica: 'neutro',
    descricao: 'Quantidade de chargebacks no período.' },
  { id: 'taxaReembolso', rotulo: 'Taxa de reembolso', categoria: 'risco', formato: 'pct', semantica: 'ruim-alto', limiar: 0.02,
    descricao: 'Reembolsos sobre o total de vendas. Acima de 2% acende alerta.' },
  { id: 'taxaChargeback', rotulo: 'Taxa de chargeback', categoria: 'risco', formato: 'pct', semantica: 'ruim-alto', limiar: 0.01,
    descricao: 'Chargebacks sobre o total de vendas. Acima de 1% é zona de risco.' },
  { id: 'taxaAprovacao', rotulo: 'Taxa de aprovação', categoria: 'risco', formato: 'pct', semantica: 'bom-alto', limiar: 0.7,
    descricao: 'Vendas aprovadas sobre tentativas (aprovadas + recusadas).' },
  { id: 'numRecusadas', rotulo: 'Vendas recusadas', categoria: 'risco', formato: 'int', semantica: 'neutro',
    descricao: 'Pagamentos recusados no período.' },
  { id: 'numPendentes', rotulo: 'Vendas pendentes', categoria: 'risco', formato: 'int', semantica: 'neutro',
    descricao: 'Aguardando pagamento (Pix gerado, boleto emitido…).' },

  // ===== Formas de pagamento =====
  { id: 'pctPix', rotulo: 'Vendas no Pix', categoria: 'pagamento', formato: 'pct', semantica: 'neutro',
    descricao: 'Participação do Pix nas vendas aprovadas.' },
  { id: 'pctCartao', rotulo: 'Vendas no cartão', categoria: 'pagamento', formato: 'pct', semantica: 'neutro',
    descricao: 'Participação do cartão nas vendas aprovadas.' },
  { id: 'pctBoleto', rotulo: 'Vendas no boleto', categoria: 'pagamento', formato: 'pct', semantica: 'neutro',
    descricao: 'Participação do boleto nas vendas aprovadas.' },
]

export const METRICAS_PADRAO = [
  'faturamento', 'gastoAds', 'roas', 'roi',
  'lucro', 'impostoAds', 'cpa', 'numPendentes',
  'margem', 'valorReembolsado', 'numReembolsos', 'taxaReembolso',
  'ticketMedio',
]

// ===== Catálogo de gráficos =====
export const GRAFICOS = [
  { id: 'evolucaoLucro', rotulo: 'Evolução do lucro', descricao: 'Lucro dia a dia no período.' },
  { id: 'pagamentos', rotulo: 'Vendas por pagamento', descricao: 'Participação de Pix, cartão e boleto (%).' },
  { id: 'vendasHorario', rotulo: 'Vendas por horário', descricao: 'Vendas aprovadas por hora do dia.' },
  { id: 'lucroHorario', rotulo: 'Lucro por horário', descricao: 'Lucro estimado por hora (custo distribuído nas 24h).' },
  { id: 'funil', rotulo: 'Funil de conversão', descricao: 'Cliques > página > checkout > vendas.' },
]
export const GRAFICOS_PADRAO = ['evolucaoLucro', 'pagamentos', 'vendasHorario', 'lucroHorario', 'funil']

const graficoPorIdMap = new Map(GRAFICOS.map((g) => [g.id, g]))
export function graficoPorId(id) { return graficoPorIdMap.get(id) }

const porId = new Map(CATALOGO.map((m) => [m.id, m]))
export function metricaPorId(id) { return porId.get(id) }

export function formatarValor(def, v) {
  if (def.formato === 'moeda') return moeda(v ?? 0)
  if (def.formato === 'pct') return pct(v)
  if (def.formato === 'int') return v != null ? String(v) : '0'
  return num(v)
}

export function corDaMetrica(def, v) {
  if (v == null || def.semantica === 'neutro') return ''
  if (def.semantica === 'lucro') return v > 0 ? 'verde' : v < 0 ? 'vermelho' : ''
  if (def.semantica === 'custo') return v > 0 ? 'vermelho' : ''
  if (def.semantica === 'bom-alto') return v >= (def.limiar ?? 0) ? 'verde' : 'vermelho'
  if (def.semantica === 'ruim-alto') return v > (def.limiar ?? 0) ? 'vermelho' : 'verde'
  return ''
}
