import { Link } from 'react-router-dom'

// Página pública (não exige login) — exigida pela revisão do Meta
// como "Data Deletion Instructions URL".
export default function ExclusaoDados() {
  return (
    <div className="pagina-legal">
      <div className="legal-cabecalho">
        <span className="legal-marca">MacacoFy</span>
        <Link to="/" className="texto-suave legal-voltar">← Voltar ao app</Link>
      </div>

      <div className="card secao legal-conteudo">
        <h1 className="titulo-pagina">Exclusão de Dados</h1>
        <p className="texto-suave">Última atualização: 11 de julho de 2026</p>

        <p>
          Você tem total controle sobre os seus dados no MacacoFy e pode excluí-los a qualquer
          momento. Abaixo explicamos as formas de fazer isso.
        </p>

        <h2 className="legal-titulo">Desconectar uma integração</h2>
        <p>
          Para remover apenas os dados vindos de uma plataforma conectada (como o Meta Ads ou a
          Cakto), acesse <strong>Integrações</strong> no app e clique em <strong>Desconectar</strong>
          no card correspondente. Isso apaga imediatamente as credenciais e o token daquela conexão
          dos nossos servidores. Você também pode revogar o acesso do MacacoFy nas configurações de
          aplicativos da sua conta do Facebook.
        </p>

        <h2 className="legal-titulo">Excluir toda a sua conta e dados</h2>
        <p>
          Para apagar permanentemente sua conta e todos os dados associados (perfil, vendas
          importadas, gastos de anúncios, custos e integrações), envie um e-mail para{' '}
          <a href="mailto:alessandro@setalab.com.br">alessandro@setalab.com.br</a> com o assunto
          <strong> “Exclusão de dados”</strong>, a partir do e-mail cadastrado na sua conta.
        </p>

        <h2 className="legal-titulo">O que é apagado</h2>
        <ul className="legal-lista">
          <li>Seu perfil e dados de conta;</li>
          <li>Todas as vendas importadas das plataformas conectadas;</li>
          <li>Todos os gastos de anúncios importados do Meta;</li>
          <li>Custos e configurações cadastrados;</li>
          <li>Tokens e credenciais de todas as integrações.</li>
        </ul>

        <h2 className="legal-titulo">Prazo</h2>
        <p>
          Solicitações de exclusão completa são processadas em até <strong>30 dias</strong>. A
          desconexão de uma integração feita pelo próprio app é imediata.
        </p>

        <h2 className="legal-titulo">Contato</h2>
        <p>
          Qualquer dúvida sobre exclusão de dados? Escreva para{' '}
          <a href="mailto:alessandro@setalab.com.br">alessandro@setalab.com.br</a>. Veja também nossa{' '}
          <Link to="/privacidade">Política de Privacidade</Link>.
        </p>
      </div>
    </div>
  )
}
