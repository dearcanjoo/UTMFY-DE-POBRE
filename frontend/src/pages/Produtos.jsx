import { useState, useEffect } from 'react'
import { usePeriodo } from '../hooks/usePeriodo.js'
import { useMetricas } from '../hooks/useMetricas.js'
import SeletorPeriodo from '../components/SeletorPeriodo.jsx'
import TabelaProdutos from '../components/TabelaProdutos.jsx'
import { supabase } from '../lib/supabase.js'

export default function Produtos() {
  const periodo = usePeriodo()
  const { dados, carregando, erro, recarregar } = useMetricas(periodo.inicio, periodo.fim)
  const [contas, setContas] = useState([])
  const [editando, setEditando] = useState(null)

  useEffect(() => {
    supabase.from('conexoes').select('contas_ads').eq('provedor', 'meta').maybeSingle()
      .then(({ data }) => setContas(data?.contas_ads || []))
  }, [])

  async function associarConta(chaveProduto, nomeProduto, contaId) {
    const { data: usr } = await supabase.auth.getUser()
    await supabase.from('produtos').upsert({
      usuario_id: usr.user.id,
      produto_id_cakto: chaveProduto,
      nome: nomeProduto,
      conta_ads_id: contaId || null,
    }, { onConflict: 'usuario_id,produto_id_cakto' })
    setEditando(null)
    recarregar()
  }

  return (
    <div>
      <h1 className="titulo-pagina">Produtos</h1>
      <SeletorPeriodo periodo={periodo} />
      {erro && <div className="erro-msg">{erro}</div>}
      {carregando && !dados ? (
        <div className="card"><div className="skeleton" style={{ height: 80 }} /></div>
      ) : dados && (
        <>
          <TabelaProdutos porProduto={dados.porProduto} />
          {dados.porProduto.length > 0 && (
            <div className="secao" style={{ marginTop: 24 }}>
              <div className="subtitulo">Associar produto e conta de anúncios</div>
              <p className="texto-suave" style={{ marginBottom: 12 }}>
                Associe cada produto à conta do Meta que roda os anúncios dele, para o lucro por produto incluir o gasto certo.
              </p>
              {dados.porProduto.map((p) => (
                <div className="card bloco-inset produto-linha" key={p.chave} style={{ marginBottom: 8, padding: 14 }}>
                  <div className="produto-nome" style={{ fontSize: 14 }}>{p.nome}</div>
                  {editando === p.chave ? (
                    <select
                      style={{ background: 'var(--bg-card)', color: 'var(--texto)', border: '1px solid var(--borda-forte)', borderRadius: 8, padding: 8 }}
                      defaultValue={p.contaAds || ''}
                      onChange={(e) => associarConta(p.chave, p.nome, e.target.value)}
                    >
                      <option value="">Nenhuma</option>
                      {contas.map((c) => (
                        <option key={c.id} value={c.id}>{c.name || c.id}</option>
                      ))}
                    </select>
                  ) : (
                    <button className="botao secundario pequeno" onClick={() => setEditando(p.chave)}>
                      {p.contaAds ? `Conta: ${p.contaAds}` : 'Associar conta'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
