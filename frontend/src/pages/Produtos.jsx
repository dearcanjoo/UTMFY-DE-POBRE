import { usePeriodo } from '../hooks/usePeriodo.js'
import { useMetricas } from '../hooks/useMetricas.js'
import SeletorPeriodo from '../components/SeletorPeriodo.jsx'
import TabelaProdutos from '../components/TabelaProdutos.jsx'
import GraficoProdutos from '../components/GraficoProdutos.jsx'

export default function Produtos() {
  const periodo = usePeriodo()
  const { dados, carregando, erro } = useMetricas(periodo.inicio, periodo.fim)

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
          <GraficoProdutos vendas={dados.bruto?.vendas} inicio={periodo.inicio} fim={periodo.fim} />
        </>
      )}
    </div>
  )
}
