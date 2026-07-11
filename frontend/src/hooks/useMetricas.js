import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase.js'
import { inicioDoDia, fimDoDia, hojeBrasilia, somaDias } from '../lib/formato.js'
import { calcularMetricas, serieDiaria, metricasPorProduto, vendasPorHorario, lucroPorHorario, dadosPagamento, dadosFunil } from '../lib/calculos.js'

// ============================================================
// Cache de janela larga: busca uma vez os últimos ~62 dias e
// fatia no cliente. Trocar de período predefinido vira operação
// instantânea (zero rede). Rede só quando o período pedido sai
// da janela (datas personalizadas antigas) ou no refresh.
// ============================================================
const DIAS_JANELA = 62

export function useMetricas(inicio, fim) {
  const [cache, setCache] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const janelaRef = useRef({ inicio: null, fim: null })
  const buscandoRef = useRef(false)

  const buscarJanela = useCallback(async (jInicio, jFim, silencioso) => {
    if (buscandoRef.current) return
    buscandoRef.current = true
    if (!silencioso) setCarregando(true)
    setErro(null)
    try {
      const [vendasQ, gastosQ, custosQ, configQ, produtosQ] = await Promise.all([
        supabase.from('vendas').select('*')
          .gte('data_venda', inicioDoDia(jInicio).toISOString())
          .lte('data_venda', fimDoDia(jFim).toISOString()),
        supabase.from('gastos_ads').select('*').gte('data', jInicio).lte('data', jFim),
        supabase.from('custos_operacao').select('*').eq('ativo', true),
        supabase.from('config_custos').select('*').maybeSingle(),
        supabase.from('produtos').select('*'),
      ])
      for (const q of [vendasQ, gastosQ, custosQ, configQ, produtosQ]) {
        if (q.error) throw q.error
      }
      janelaRef.current = { inicio: jInicio, fim: jFim }
      setCache({
        janelaInicio: jInicio,
        janelaFim: jFim,
        vendas: vendasQ.data || [],
        gastos: gastosQ.data || [],
        custos: custosQ.data || [],
        config: configQ.data || {},
        produtos: produtosQ.data || [],
      })
    } catch (e) {
      setErro(e.message || 'Erro ao carregar dados')
    } finally {
      buscandoRef.current = false
      setCarregando(false)
    }
  }, [])

  // Garante que a janela em cache cobre o período pedido
  useEffect(() => {
    const j = janelaRef.current
    if (j.inicio && j.inicio <= inicio && j.fim >= fim) return // já coberto — instantâneo
    const hoje = hojeBrasilia()
    const padraoInicio = somaDias(hoje, -(DIAS_JANELA - 1))
    const jInicio = inicio < padraoInicio ? inicio : padraoInicio
    const jFim = fim > hoje ? fim : hoje
    buscarJanela(jInicio, jFim, false)
  }, [inicio, fim, buscarJanela])

  // Revalidação silenciosa: mantém os dados na tela enquanto atualiza
  const revalidar = useCallback(() => {
    const j = janelaRef.current
    if (!j.inicio) return
    buscarJanela(j.inicio, j.fim, true)
  }, [buscarJanela])

  // Atualização automática a cada 60s
  useEffect(() => {
    const timer = setInterval(revalidar, 60000)
    return () => clearInterval(timer)
  }, [revalidar])

  // Tempo real: venda/gasto novo atualiza na hora (sem piscar a tela)
  useEffect(() => {
    const canal = supabase
      .channel('metricas-tempo-real')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vendas' }, revalidar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gastos_ads' }, revalidar)
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [revalidar])

  // Fatia a janela para o período pedido e calcula tudo no cliente
  const dados = useMemo(() => {
    if (!cache) return null
    if (!(cache.janelaInicio <= inicio && cache.janelaFim >= fim)) return null
    const tIni = inicioDoDia(inicio).getTime()
    const tFim = fimDoDia(fim).getTime()
    const vendas = cache.vendas.filter((v) => {
      const t = new Date(v.data_venda).getTime()
      return t >= tIni && t <= tFim
    })
    const gastos = cache.gastos.filter((g) => g.data >= inicio && g.data <= fim)
    const base = { vendas, gastos, custos: cache.custos, config: cache.config, produtos: cache.produtos, inicio, fim }
    return {
      metricas: calcularMetricas(base),
      serie: serieDiaria(base),
      porProduto: metricasPorProduto(base),
      porHorario: vendasPorHorario(base),
      lucroHorario: lucroPorHorario(base),
      pagamentos: dadosPagamento(base),
      funil: dadosFunil(base),
      bruto: base,
    }
  }, [cache, inicio, fim])

  const cobre = cache && cache.janelaInicio <= inicio && cache.janelaFim >= fim

  return { dados, carregando: carregando && !cobre, erro, recarregar: revalidar }
}
