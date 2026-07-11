// =====================================================================
// TODAS as fórmulas de lucro ficam aqui — fonte única da matemática.
//
// CONCEITO-CHAVE: o faturamento é a COMISSÃO LÍQUIDA (o que cai para o
// usuário após a taxa da Cakto). A taxa da plataforma NÃO é deduzida de
// novo — ela é apenas informativa. Deduzir de novo = contar duas vezes.
// =====================================================================
import { diasNoIntervalo, diasNoMes } from './formato.js'

/**
 * Calcula todas as métricas de um período.
 * @param {Object} p
 * @param {Array} p.vendas   - linhas de `vendas` no período
 * @param {Array} p.gastos   - linhas de `gastos_ads` no período
 * @param {Array} p.custos   - linhas de `custos_operacao` ativas
 * @param {string} p.inicio  - YYYY-MM-DD
 * @param {string} p.fim     - YYYY-MM-DD
 * @param {Object} p.config  - config_custos do usuário (fallback de imposto)
 */
export function calcularMetricas({ vendas = [], gastos = [], custos = [], inicio, fim, config = {} }) {
  const aprovadas = vendas.filter((v) => v.status === 'aprovada')
  const recusadas = vendas.filter((v) => v.status === 'recusada')
  const pendentes = vendas.filter((v) => v.status === 'pendente')
  const reembolsadas = vendas.filter((v) => v.status === 'reembolsada')
  const chargebacks = vendas.filter((v) => v.status === 'chargeback')
  const estornadas = [...reembolsadas, ...chargebacks]

  // Faturamento = soma das comissões líquidas das vendas aprovadas
  const faturamento = soma(aprovadas.map((v) => v.valor_comissao))
  const faturamentoBruto = soma(aprovadas.map((v) => v.valor_cheio))

  // Reembolsos/chargebacks = comissões estornadas
  const reembolsos = soma(estornadas.map((v) => v.valor_comissao))
  const valorReembolsado = soma(reembolsadas.map((v) => v.valor_comissao))
  const valorChargeback = soma(chargebacks.map((v) => v.valor_comissao))

  // Informativo: total de taxas pagas à plataforma (NÃO é dedução)
  const taxasPagas = soma(aprovadas.map((v) => v.valor_taxa))

  // Gasto em anúncios
  const gastoAds = soma(gastos.map((g) => Number(g.gasto)))

  // Imposto sobre mídia: da API; fallback manual por alíquota
  let impostoAds = soma(gastos.map((g) => Number(g.imposto)))
  if (config.imposto_meta_usar_manual && config.imposto_meta_manual_pct != null) {
    impostoAds = gastoAds * (Number(config.imposto_meta_manual_pct) / 100)
  }

  // Custos da operação: fixo mensal é rateado pró-rata; pontual entra se a data cai no período
  const custosOperacao = calcularCustosOperacao(custos, inicio, fim)

  const custoTotal = gastoAds + impostoAds + custosOperacao + reembolsos

  // LUCRO LÍQUIDO REAL
  const lucro = faturamento - reembolsos - gastoAds - impostoAds - custosOperacao

  const numVendas = aprovadas.length
  const dias = Math.max(1, diasNoIntervalo(inicio, fim))

  // Métodos de pagamento (sobre vendas aprovadas)
  const metodo = (v) => String(v.metodo_pagamento || '').toLowerCase()
  const numPix = aprovadas.filter((v) => metodo(v).includes('pix')).length
  const numCartao = aprovadas.filter((v) => metodo(v).includes('card') || metodo(v).includes('cart') || metodo(v).includes('credit')).length
  const numBoleto = aprovadas.filter((v) => metodo(v).includes('boleto')).length

  const tentativas = aprovadas.length + recusadas.length

  return {
    // Resultado
    lucro,
    margem: faturamento > 0 ? lucro / faturamento : null,
    roi: custoTotal > 0 ? lucro / custoTotal : null,
    lucroPorVenda: numVendas > 0 ? lucro / numVendas : null,
    lucroSobreGasto: gastoAds > 0 ? lucro / gastoAds : null,

    // Receita
    faturamento,
    faturamentoBruto,
    ticketMedio: numVendas > 0 ? faturamento / numVendas : null,
    ticketMedioBruto: numVendas > 0 ? faturamentoBruto / numVendas : null,
    numVendas,
    vendasPorDia: numVendas / dias,

    // Anúncios
    gastoAds,
    impostoAds,
    roas: gastoAds > 0 ? faturamento / gastoAds : null,
    cpa: numVendas > 0 ? custoTotal / numVendas : null,
    cpaAds: numVendas > 0 ? (gastoAds + impostoAds) / numVendas : null,
    gastoDiarioMedio: gastoAds / dias,

    // Custos
    custoTotal,
    custosOperacao,
    taxasPagas, // informativo

    // Risco
    reembolsos,
    valorReembolsado,
    valorChargeback,
    numReembolsos: reembolsadas.length,
    numChargebacks: chargebacks.length,
    taxaReembolso: numVendas + reembolsadas.length > 0 ? reembolsadas.length / (numVendas + reembolsadas.length) : null,
    taxaChargeback: numVendas + chargebacks.length > 0 ? chargebacks.length / (numVendas + chargebacks.length) : null,
    numRecusadas: recusadas.length,
    numPendentes: pendentes.length,
    taxaAprovacao: tentativas > 0 ? numVendas / tentativas : null,

    // Pagamento
    numPix,
    numCartao,
    numBoleto,
    pctPix: numVendas > 0 ? numPix / numVendas : null,
    pctCartao: numVendas > 0 ? numCartao / numVendas : null,
    pctBoleto: numVendas > 0 ? numBoleto / numVendas : null,
  }
}

/** Custos manuais: fixo_mensal rateado pró-rata pelos dias do período; pontual se data no período */
export function calcularCustosOperacao(custos, inicio, fim) {
  const dias = diasNoIntervalo(inicio, fim)
  let total = 0
  for (const c of custos) {
    if (c.ativo === false) continue
    const valor = Number(c.valor)
    if (c.tipo === 'fixo_mensal') {
      total += (valor / diasNoMes(fim)) * dias
    } else {
      const d = c.data_referencia
      if (d >= inicio && d <= fim) total += valor
    }
  }
  return total
}

/** Série diária de lucro para o gráfico de evolução */
export function serieDiaria({ vendas = [], gastos = [], custos = [], inicio, fim, config = {} }) {
  const dias = []
  let d = inicio
  while (d <= fim) {
    dias.push(d)
    d = proximoDia(d)
  }
  return dias.map((dia) => {
    const vDia = vendas.filter((v) => diaDe(v.data_venda) === dia)
    const gDia = gastos.filter((g) => g.data === dia)
    const m = calcularMetricas({ vendas: vDia, gastos: gDia, custos, inicio: dia, fim: dia, config })
    return { dia, lucro: m.lucro, faturamento: m.faturamento, gasto: m.gastoAds + m.impostoAds }
  })
}

/** Métricas agrupadas por produto */
export function metricasPorProduto({ vendas = [], gastos = [], produtos = [], inicio, fim, config = {} }) {
  const nomes = new Map()
  for (const v of vendas) {
    const chave = v.produto_id_cakto || v.produto_nome || 'sem-produto'
    if (!nomes.has(chave)) nomes.set(chave, { nome: v.produto_nome || 'Sem nome', vendas: [] })
    nomes.get(chave).vendas.push(v)
  }
  const resultado = []
  for (const [chave, grupo] of nomes) {
    const prod = produtos.find((p) => p.produto_id_cakto === chave)
    // gastos da conta de ads associada ao produto (se houver associação)
    const gastosProd = prod?.conta_ads_id ? gastos.filter((g) => g.conta_ads_id === prod.conta_ads_id) : []
    const m = calcularMetricas({ vendas: grupo.vendas, gastos: gastosProd, custos: [], inicio, fim, config })
    resultado.push({ chave, nome: grupo.nome, contaAds: prod?.conta_ads_id || null, ...m })
  }
  return resultado.sort((a, b) => b.lucro - a.lucro)
}

// ============================================================
// Agregações para os gráficos do dashboard
// ============================================================

/** Vendas aprovadas por método de pagamento — dados para gráfico de pizza */
export function dadosPagamento({ vendas = [] }) {
  const aprovadas = vendas.filter((v) => v.status === 'aprovada')
  const metodo = (v) => String(v.metodo_pagamento || '').toLowerCase()
  const grupos = [
    { id: 'pix', nome: 'Pix', filtro: (m) => m.includes('pix') },
    { id: 'cartao', nome: 'Cartão', filtro: (m) => m.includes('card') || m.includes('cart') || m.includes('credit') },
    { id: 'boleto', nome: 'Boleto', filtro: (m) => m.includes('boleto') },
  ]
  const total = aprovadas.length
  const usados = new Set()
  const resultado = grupos.map((g) => {
    const qtd = aprovadas.filter((v) => {
      const ok = g.filtro(metodo(v))
      if (ok) usados.add(v.id)
      return ok
    }).length
    return { id: g.id, nome: g.nome, qtd, pct: total > 0 ? qtd / total : 0 }
  })
  const outros = aprovadas.filter((v) => !usados.has(v.id)).length
  if (outros > 0) resultado.push({ id: 'outros', nome: 'Outros', qtd: outros, pct: total > 0 ? outros / total : 0 })
  return resultado.filter((r) => r.qtd > 0)
}

/** Vendas aprovadas por hora do dia (fuso de Brasília) */
export function vendasPorHorario({ vendas = [] }) {
  const aprovadas = vendas.filter((v) => v.status === 'aprovada')
  const horas = Array.from({ length: 24 }, (_, h) => ({ hora: h, vendas: 0, faturamento: 0 }))
  for (const v of aprovadas) {
    const h = horaDe(v.data_venda)
    horas[h].vendas += 1
    horas[h].faturamento += Number(v.valor_comissao) || 0
  }
  return horas
}

/**
 * Lucro por hora do dia (aproximação): comissão por hora menos o custo
 * total do período (gasto + imposto + custos operacionais + reembolsos)
 * distribuído uniformemente pelas 24h. A Meta não fornece gasto por hora
 * via API padrão, então a distribuição uniforme é a melhor estimativa.
 */
export function lucroPorHorario({ vendas = [], gastos = [], custos = [], inicio, fim, config = {} }) {
  const m = calcularMetricas({ vendas, gastos, custos, inicio, fim, config })
  const custoPorHora = (m.gastoAds + m.impostoAds + m.custosOperacao + m.reembolsos) / 24
  return vendasPorHorario({ vendas }).map((h) => ({
    hora: h.hora,
    lucro: h.faturamento - custoPorHora,
    faturamento: h.faturamento,
  }))
}

/**
 * Funil de conversão: Cliques > Vis. de página > ICs > Vendas iniciadas > Vendas aprovadas.
 * Cliques/LPV/ICs vêm da API de Insights da Meta (eventos do pixel reportados
 * de volta), gravados por dia em gastos_ads. Vendas vêm da Cakto.
 */
export function dadosFunil({ vendas = [], gastos = [] }) {
  const cliques = soma(gastos.map((g) => Number(g.cliques) || 0))
  const lpv = soma(gastos.map((g) => Number(g.visualizacoes_pagina) || 0))
  const ics = soma(gastos.map((g) => Number(g.checkouts_iniciados) || 0))
  const iniciadas = vendas.length
  const aprovadas = vendas.filter((v) => v.status === 'aprovada').length
  const base = cliques > 0 ? cliques : null
  const etapas = [
    { id: 'cliques', nome: 'Cliques', valor: cliques },
    { id: 'lpv', nome: 'Vis. de página', valor: lpv },
    { id: 'ics', nome: 'ICs', valor: ics },
    { id: 'iniciadas', nome: 'Vendas iniciadas', valor: iniciadas },
    { id: 'aprovadas', nome: 'Vendas aprovadas', valor: aprovadas },
  ]
  return etapas.map((e) => ({ ...e, pct: base ? e.valor / base : null }))
}

// helpers
function horaDe(timestamptz) {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }).format(new Date(timestamptz))) % 24
}
function soma(arr) {
  return arr.reduce((acc, v) => acc + (Number(v) || 0), 0)
}
function diaDe(timestamptz) {
  // converte para data no fuso de Brasília
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(timestamptz))
}
function proximoDia(iso) {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}
