import { Link } from 'react-router-dom'

// Página pública (não exige login) — exigida pela revisão do Meta.
export default function Privacidade() {
  return (
    <div className="pagina-legal">
      <div className="legal-cabecalho">
        <span className="legal-marca">MacacoFy</span>
        <Link to="/" className="texto-suave legal-voltar">← Voltar ao app</Link>
      </div>

      <div className="card secao legal-conteudo">
        <h1 className="titulo-pagina">Política de Privacidade</h1>
        <p className="texto-suave">Última atualização: 11 de julho de 2026</p>

        <p>
          O MacacoFy é um painel para anunciantes acompanharem o lucro real de suas vendas de
          infoprodutos, reunindo em um só lugar as vendas e os gastos com anúncios. Esta política
          explica quais dados coletamos, como os usamos e quais são os seus direitos. Ao usar o
          MacacoFy, você concorda com o descrito aqui.
        </p>

        <h2 className="legal-titulo">1. Quais dados coletamos</h2>
        <p>Coletamos apenas o necessário para o funcionamento do painel:</p>
        <ul className="legal-lista">
          <li><strong>Dados de conta:</strong> e-mail e nome de usuário, usados para autenticação e para identificar sua conta.</li>
          <li><strong>Dados de vendas:</strong> quando você conecta uma plataforma de pagamento (por exemplo, a Cakto), importamos os dados das suas vendas — valores, comissões, status (aprovada, reembolso, chargeback) — para calcular seu faturamento e lucro.</li>
          <li><strong>Dados de anúncios (Meta):</strong> quando você conecta sua conta do Facebook, usamos a permissão <strong>ads_read</strong> para ler, <strong>somente de forma consultiva</strong>, o gasto diário com anúncios e métricas de funil (cliques, visualizações de página e checkouts iniciados) das contas de anúncios que <em>você mesmo</em> seleciona.</li>
          <li><strong>Custos configurados por você:</strong> impostos, taxas e outros custos que você cadastra manualmente para o cálculo de lucro.</li>
        </ul>

        <h2 className="legal-titulo">2. Como usamos os dados do Meta (ads_read)</h2>
        <p>
          A conexão com o Meta é <strong>estritamente de leitura</strong>. Usamos a permissão ads_read
          exclusivamente para importar o valor investido em anúncios e combiná-lo com suas vendas,
          calculando indicadores como ROI, ROAS e lucro líquido no seu painel.
        </p>
        <p>
          <strong>Nós nunca criamos, publicamos, editamos ou pausamos campanhas, anúncios ou
          qualquer configuração da sua conta de anúncios.</strong> Não temos e não solicitamos
          acesso de escrita. Você pode revogar o acesso a qualquer momento, tanto pelo botão
          “Desconectar” dentro do MacacoFy quanto nas configurações de aplicativos da sua conta
          do Facebook.
        </p>

        <h2 className="legal-titulo">3. Onde os dados ficam armazenados</h2>
        <p>
          Seus dados são armazenados em servidores seguros (infraestrutura Supabase) com acesso
          restrito. Os tokens de acesso às plataformas conectadas são guardados apenas para permitir
          a sincronização automática dos seus próprios dados e não são compartilhados com terceiros.
        </p>

        <h2 className="legal-titulo">4. Compartilhamento</h2>
        <p>
          Não vendemos e não compartilhamos seus dados com terceiros para fins de marketing.
          Os dados são usados apenas para prestar o serviço a você. Podemos divulgar informações
          se exigido por lei ou ordem judicial.
        </p>

        <h2 className="legal-titulo">5. Seus direitos</h2>
        <p>
          Você pode acessar, corrigir e excluir seus dados a qualquer momento. Pode também desconectar
          qualquer integração diretamente no app. Para solicitar a exclusão completa da sua conta e
          dos seus dados, consulte a página de <Link to="/exclusao-de-dados">Exclusão de Dados</Link>.
        </p>

        <h2 className="legal-titulo">6. Contato</h2>
        <p>
          Dúvidas sobre esta política ou sobre seus dados? Fale com a gente pelo e-mail{' '}
          <a href="mailto:deiviarcanjoo@gmail.com">deiviarcanjoo@gmail.com</a>.
        </p>
      </div>
    </div>
  )
}
