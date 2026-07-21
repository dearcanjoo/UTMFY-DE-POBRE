import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase.js'
import { inicioDoDia, fimDoDia } from '../lib/formato.js'

// Aba Campanhas: cruza insights do Meta (por anúncio) com as vendas da Cakto
// atribuídas por UTM. Hierarquia: campanha > conjunto > anúncio.
//
// Casamento venda ↔ anúncio:
//   utm_content  → nome (ou id) do anúncio
//   utm_term     → nome (ou id) do conjunto (ou placement, ignorado se não casar)
//   utm_campaign → nome (ou id) da campanha
// Aceita "nome|id" (template recomendado), só o nome, e sufixo "::clickid::".
export function useCampanhas(inicio, fim, contaId) {
  const [insights, setInsights] = useState(null)
  const [vendas, setVendas] = useState(null)
  const [statusMapa, setStatusMapa] = useState(null)
  const [contas, setContas] = useState([])
  const [erro, setErro] = useState(null)
  const [carregandoBruto, setCarregandoBruto] = useState(true)

  // Contas de anúncios selecionadas na conexão Meta (para o filtro de conta)
  useEffect(() => {
    supabase.from('conexoes').select('contas_ads, contas_selecionadas')
      .eq('provedor', 'meta').maybeSingle()
      .then(({ data }) => {
        if (!data) return
        const nomes = new Map((data.contas_ads ?? []).map((c) => [String(c.id), c.name || String(c.id)]))
        const sel = (data.contas_selecionadas ?? []).filter((c) => typeof c === 'string')
        setContas(sel.map((id) => ({ id, nome: nomes.get(String(id)) ?? id })))
      })
  }, [])

  useEffect(() => {
    let ativo = true
    setErro(null)
    setCarregandoBruto(true)

    let qInsights = supabase.from('anuncios_insights').select('*')
      .gte('data', inicio).lte('data', fim)
    if (contaId) qInsights = qInsights.eq('conta_ads_id', contaId)

    Promise.all([
      qInsights,
      supabase.from('vendas')
        .select('status, valor_comissao, utm_source, utm_medium, utm_campaign, utm_content, utm_term, data_venda')
        .gte('data_venda', inicioDoDia(inicio).toISOString())
        .lte('data_venda', fimDoDia(fim).toISOString()),
      supabase.from('anuncios_status').select('objeto_id, status'),
    ]).then(([ri, rv, rs]) => {
      if (!ativo) return
      setCarregandoBruto(false)
      if (ri.error) { setErro(ri.error.message); return }
      if (rv.error) { setErro(rv.error.message); return }
      setInsights(ri.data ?? [])
      setVendas(rv.data ?? [])
      // status é opcional: se a consulta falhar, seguimos sem filtro de status
      setStatusMapa(new Map((rs.data ?? []).map((s) => [String(s.objeto_id), s.status])))
    })
    return () => { ativo = false }
  }, [inicio, fim, contaId])

  const dados = useMemo(() => {
    if (!insights || !vendas) return null
    return montarArvore(insights, vendas, statusMapa ?? new Map())
  }, [insights, vendas, statusMapa])

  return { dados, contas, carregando: carregandoBruto && !dados, erro }
}

// Um nó (campanha/conjunto/anúncio) está "ativo" quando o Meta diz ACTIVE.
// Sem informação de status, consideramos ativo para nunca esconder dados.
export function estaAtivo(status) {
  return status == null || status === 'ACTIVE'
}

export function rotuloStatus(status) {
  if (status == null || status === 'ACTIVE') return null
  if (status === 'PAUSED') return 'pausada'
  if (status === 'CAMPAIGN_PAUSED') return 'campanha pausada'
  if (status === 'ADSET_PAUSED') return 'conjunto pausado'
  if (status === 'ARCHIVED') return 'arquivada'
  if (status === 'DELETED') return 'excluída'
  if (status === 'IN_PROCESS' || status === 'PENDING_REVIEW') return 'em análise'
  if (status === 'WITH_ISSUES' || status === 'DISAPPROVED') return 'com problema'
  return status.toLowerCase()
}

const norm = (s) => (s ?? '').toString().trim().toLowerCase()

// "nome|id" -> { nome, id }; sem pipe -> { nome, id: null }.
// O checkout pode anexar um sufixo de click id no formato "::token::" — removemos.
function separar(utm) {
  let s = (utm ?? '').toString().trim()
  if (!s) return { nome: '', id: null }
  s = s.split('::')[0].trim() // ex.: "6 — Cópia|1202484...::IwZXh0...::" -> "6 — Cópia|1202484..."
  if (!s) return { nome: '', id: null }
  const i = s.lastIndexOf('|')
  if (i > 0) {
    const cauda = s.slice(i + 1).trim()
    // "nome|123456..." -> id numérico do Meta
    if (/^\d{5,}$/.test(cauda)) return { nome: norm(s.slice(0, i)), id: cauda }
    // "nome|{{ad.id}}" (macro não preenchida) ou "nome|" -> usa só o nome
    if (!cauda || /^\{\{.*\}\}$/.test(cauda)) return { nome: norm(s.slice(0, i)), id: null }
  }
  return { nome: norm(s), id: null }
}

function novoNo(id, nome, status) {
  return {
    id, nome, status: status ?? null,
    gasto: 0, cliques: 0, ics: 0,
    vendas: 0, faturamento: 0,
    filhos: new Map(),
  }
}

function montarArvore(insights, vendasLista, statusMapa) {
  const campanhas = new Map()
  const porAnuncioId = new Map(); const porAnuncioNome = new Map()
  const porConjuntoId = new Map(); const porConjuntoNome = new Map()
  const porCampanhaId = new Map(); const porCampanhaNome = new Map()

  for (const l of insights) {
    const cId = l.campanha_id ?? `nome:${norm(l.campanha_nome)}`
    const sId = l.conjunto_id ?? `nome:${norm(l.conjunto_nome)}`
    const aId = String(l.anuncio_id)

    if (!campanhas.has(cId)) campanhas.set(cId, novoNo(cId, l.campanha_nome ?? 'Campanha sem nome', statusMapa.get(String(cId))))
    const camp = campanhas.get(cId)
    if (!camp.filhos.has(sId)) camp.filhos.set(sId, novoNo(sId, l.conjunto_nome ?? 'Conjunto sem nome', statusMapa.get(String(sId))))
    const conj = camp.filhos.get(sId)
    if (!conj.filhos.has(aId)) conj.filhos.set(aId, novoNo(aId, l.anuncio_nome ?? 'Anúncio sem nome', statusMapa.get(aId)))
    const anun = conj.filhos.get(aId)

    const gasto = Number(l.gasto) || 0
    const cliques = Number(l.cliques) || 0
    const ics = Number(l.checkouts_iniciados) || 0
    for (const no of [camp, conj, anun]) {
      no.gasto += gasto; no.cliques += cliques; no.ics += ics
    }

    const cadeiaAnuncio = [camp, conj, anun]
    porAnuncioId.set(aId, cadeiaAnuncio)
    if (l.anuncio_nome) porAnuncioNome.set(norm(l.anuncio_nome), cadeiaAnuncio)
    const cadeiaConjunto = [camp, conj]
    if (l.conjunto_id) porConjuntoId.set(String(l.conjunto_id), cadeiaConjunto)
    if (l.conjunto_nome) porConjuntoNome.set(norm(l.conjunto_nome), cadeiaConjunto)
    if (l.campanha_id) porCampanhaId.set(String(l.campanha_id), [camp])
    if (l.campanha_nome) porCampanhaNome.set(norm(l.campanha_nome), [camp])
  }

  // ===== Atribuição das vendas =====
  let naoAtribuidas = 0
  let naoAtribuidasFat = 0
  let semUtm = 0
  const aprovadas = vendasLista.filter((v) => v.status === 'aprovada')

  for (const v of aprovadas) {
    const anuncio = separar(v.utm_content)
    const conjunto = separar(v.utm_term)
    const campanha = separar(v.utm_campaign)
    const temUtm = anuncio.nome || anuncio.id || conjunto.nome || conjunto.id || campanha.nome || campanha.id
    if (!temUtm) { semUtm++; continue }

    const cadeia =
      (anuncio.id && porAnuncioId.get(anuncio.id)) ||
      (anuncio.nome && porAnuncioNome.get(anuncio.nome)) ||
      (conjunto.id && porConjuntoId.get(conjunto.id)) ||
      (conjunto.nome && porConjuntoNome.get(conjunto.nome)) ||
      (campanha.id && porCampanhaId.get(campanha.id)) ||
      (campanha.nome && porCampanhaNome.get(campanha.nome)) ||
      null

    if (!cadeia) { naoAtribuidas++; naoAtribuidasFat += Number(v.valor_comissao) || 0; continue }
    for (const no of cadeia) {
      no.vendas += 1
      no.faturamento += Number(v.valor_comissao) || 0
    }
  }

  const paraArray = (mapa) =>
    [...mapa.values()]
      .map((no) => ({ ...no, filhos: no.filhos ? paraArray(no.filhos) : [] }))
      .sort((a, b) => b.gasto - a.gasto)

  return {
    arvore: paraArray(campanhas),
    naoAtribuidas,
    naoAtribuidasFat,
    semUtm,
    totalAprovadas: aprovadas.length,
  }
}
