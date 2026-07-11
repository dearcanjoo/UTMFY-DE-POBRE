import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'
import { usePeriodo } from '../hooks/usePeriodo.js'
import { useMetricas } from '../hooks/useMetricas.js'
import SeletorPeriodo from '../components/SeletorPeriodo.jsx'
import { moeda } from '../lib/formato.js'

export default function Custos({ usuario }) {
  const periodo = usePeriodo()
  const { dados, recarregar } = useMetricas(periodo.inicio, periodo.fim)
  const [custos, setCustos] = useState([])
  const [config, setConfig] = useState({})
  const [novo, setNovo] = useState({ nome: '', valor: '', tipo: 'fixo_mensal', data_referencia: new Date().toISOString().slice(0, 10) })
  const [msg, setMsg] = useState(null)

  const carregar = useCallback(async () => {
    const [c, cfg] = await Promise.all([
      supabase.from('custos_operacao').select('*').eq('ativo', true).order('criado_em'),
      supabase.from('config_custos').select('*').maybeSingle(),
    ])
    setCustos(c.data || [])
    setConfig(cfg.data || {})
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function adicionarCusto(e) {
    e.preventDefault()
    await supabase.from('custos_operacao').insert({
      usuario_id: usuario.id,
      nome: novo.nome,
      valor: Number(novo.valor),
      tipo: novo.tipo,
      data_referencia: novo.data_referencia,
    })
    setNovo({ ...novo, nome: '', valor: '' })
    setMsg('Custo adicionado.')
    carregar(); recarregar()
  }

  async function removerCusto(id) {
    await supabase.from('custos_operacao').update({ ativo: false }).eq('id', id)
    carregar(); recarregar()
  }

  async function salvarConfig(campos) {
    const atualizado = { ...config, ...campos, usuario_id: usuario.id }
    setConfig(atualizado)
    await supabase.from('config_custos').upsert(atualizado, { onConflict: 'usuario_id' })
    recarregar()
  }

  const impostoAutoDisponivel = dados?.bruto?.gastos?.some((g) => g.imposto_origem === 'api' && Number(g.imposto) > 0)

  return (
    <div>
      <h1 className="titulo-pagina">Central de Custos</h1>
      <SeletorPeriodo periodo={periodo} />
      {msg && <div className="sucesso-msg">{msg}</div>}

      {/* 1. Taxas da plataforma */}
      <div className="card secao">
        <div className="subtitulo">Taxas da plataforma (Cakto) <span className="selo auto">automático</span> <span className="selo info">informativo</span></div>
        <p className="texto-suave" style={{ marginBottom: 12 }}>
          O faturamento já é a comissão líquida (após a taxa). A taxa <strong>não é descontada de novo</strong> — este valor é só para você saber quanto pagou.
        </p>
        <div className="card bloco-inset" style={{ textAlign: 'center', padding: 20 }}>
          <div className="texto-suave" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Total pago em taxas no período</div>
          <div className="valor-destaque">{moeda(dados?.metricas?.taxasPagas ?? 0)}</div>
        </div>
      </div>

      {/* 2. Imposto do Meta */}
      <div className="card secao">
        <div className="subtitulo">
          Imposto do Meta Ads {config.imposto_meta_usar_manual ? <span className="selo manual">manual</span> : <span className="selo auto">automático</span>}
        </div>
        <div className="card bloco-inset" style={{ textAlign: 'center', padding: 20, marginBottom: 12 }}>
          <div className="texto-suave" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Imposto sobre mídia no período</div>
          <div className="valor-destaque">{moeda(dados?.metricas?.impostoAds ?? 0)}</div>
        </div>
        {!impostoAutoDisponivel && !config.imposto_meta_usar_manual && (
          <div className="aviso">A API do Meta não retornou imposto para suas contas. Se sua conta paga imposto sobre mídia, ative o ajuste manual abaixo.</div>
        )}
        <label className="linha-flex" style={{ cursor: 'pointer', marginBottom: 10 }}>
          <span style={{ fontSize: 14 }}>Usar alíquota manual (fallback)</span>
          <input type="checkbox" checked={!!config.imposto_meta_usar_manual}
            onChange={(e) => salvarConfig({ imposto_meta_usar_manual: e.target.checked })}
            style={{ width: 20, height: 20, accentColor: 'var(--verde-escuro)' }} />
        </label>
        {config.imposto_meta_usar_manual && (
          <div className="campo">
            <label>Alíquota de imposto (%) sobre o gasto</label>
            <input type="number" step="0.01" min="0" max="100" value={config.imposto_meta_manual_pct ?? ''}
              onChange={(e) => setConfig({ ...config, imposto_meta_manual_pct: e.target.value })}
              onBlur={(e) => salvarConfig({ imposto_meta_manual_pct: Number(e.target.value) || 0 })}
              placeholder="Ex: 12.5" />
          </div>
        )}
      </div>

      {/* 3. Custos da operação */}
      <div className="card secao">
        <div className="subtitulo">Custos da operação <span className="selo manual">manual</span></div>
        <p className="texto-suave" style={{ marginBottom: 12 }}>
          Ferramentas, produção, edição… Fixo mensal é rateado por dia no período; pontual entra na data específica.
        </p>
        {custos.map((c) => (
          <div className="card bloco-inset linha-flex" key={c.id} style={{ marginBottom: 8, padding: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{c.nome}</div>
              <div className="texto-suave">
                {moeda(Number(c.valor))} · {c.tipo === 'fixo_mensal' ? 'fixo mensal' : `pontual em ${c.data_referencia.split('-').reverse().join('/')}`}
              </div>
            </div>
            <button className="botao perigo pequeno" onClick={() => removerCusto(c.id)}>Remover</button>
          </div>
        ))}
        <form onSubmit={adicionarCusto} style={{ marginTop: 12 }}>
          <div className="campo">
            <label>Nome do custo</label>
            <input value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} required placeholder="Ex: Cardápio Web" />
          </div>
          <div className="campo">
            <label>Valor (R$)</label>
            <input type="number" step="0.01" min="0" value={novo.valor} onChange={(e) => setNovo({ ...novo, valor: e.target.value })} required />
          </div>
          <div className="campo">
            <label>Tipo</label>
            <select value={novo.tipo} onChange={(e) => setNovo({ ...novo, tipo: e.target.value })}>
              <option value="fixo_mensal">Fixo mensal (rateado)</option>
              <option value="pontual">Pontual (data específica)</option>
            </select>
          </div>
          {novo.tipo === 'pontual' && (
            <div className="campo">
              <label>Data</label>
              <input type="date" value={novo.data_referencia} onChange={(e) => setNovo({ ...novo, data_referencia: e.target.value })} />
            </div>
          )}
          <button className="botao pequeno">Adicionar custo</button>
        </form>
      </div>
    </div>
  )
}
