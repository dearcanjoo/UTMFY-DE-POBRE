import { Link } from 'react-router-dom'

// Página pública (não exige login).
export default function Termos() {
  return (
    <div className="pagina-legal">
      <div className="legal-cabecalho">
        <span className="legal-marca">MacacoFy</span>
        <Link to="/" className="texto-suave legal-voltar">← Voltar ao app</Link>
      </div>

      <div className="card secao legal-conteudo">
        <h1 className="titulo-pagina">Termos de Serviço</h1>
        <p className="texto-suave">Última atualização: 11 de julho de 2026</p>

        <p>
          Bem-vindo ao MacacoFy. Ao criar uma conta e usar nosso painel, você concorda com estes
          Termos de Serviço. Leia com atenção.
        </p>

        <h2 className="legal-titulo">1. O que é o MacacoFy</h2>
        <p>
          O MacacoFy é uma ferramenta de acompanhamento de resultados para anunciantes de
          infoprodutos. Reunimos, em um só painel, as vendas das plataformas de pagamento que você
          conecta e os gastos com anúncios das suas contas de anúncios, para calcular indicadores
          como faturamento, ROI, ROAS e lucro líquido.
        </p>

        <h2 className="legal-titulo">2. Sua conta</h2>
        <p>
          Você é responsável por manter a segurança das suas credenciais de acesso e por todas as
          atividades realizadas na sua conta. As integrações que você conecta são de uso exclusivo
          da sua própria conta.
        </p>

        <h2 className="legal-titulo">3. Integrações de terceiros</h2>
        <p>
          O MacacoFy se conecta a serviços de terceiros (como plataformas de pagamento e o Meta) por
          meio de autorização que você concede. O acesso às contas de anúncios do Meta é
          <strong> somente de leitura</strong>: não criamos, editamos nem pausamos campanhas.
          Você pode revogar qualquer integração a qualquer momento no app ou nas configurações do
          respectivo serviço.
        </p>

        <h2 className="legal-titulo">4. Uso adequado</h2>
        <p>
          Você concorda em usar o MacacoFy apenas para fins legítimos e de acordo com a legislação
          aplicável e com os termos das plataformas que você conecta. É proibido tentar burlar,
          sobrecarregar ou usar o serviço de forma indevida.
        </p>

        <h2 className="legal-titulo">5. Disponibilidade e limitação de responsabilidade</h2>
        <p>
          O serviço é fornecido “no estado em que se encontra”. Nos esforçamos para manter os dados
          precisos e o serviço disponível, mas não garantimos operação ininterrupta ou isenta de
          erros. Os números apresentados são de caráter informativo e não substituem sua própria
          conferência contábil.
        </p>

        <h2 className="legal-titulo">6. Encerramento</h2>
        <p>
          Você pode encerrar sua conta a qualquer momento. Para excluir seus dados, consulte a página
          de <Link to="/exclusao-de-dados">Exclusão de Dados</Link>. Podemos suspender contas que
          violem estes termos.
        </p>

        <h2 className="legal-titulo">7. Alterações</h2>
        <p>
          Podemos atualizar estes termos periodicamente. Mudanças relevantes serão comunicadas no
          próprio app. O uso continuado após a atualização implica concordância com os novos termos.
        </p>

        <h2 className="legal-titulo">8. Contato</h2>
        <p>
          Dúvidas sobre estes termos? Fale com a gente pelo e-mail{' '}
          <a href="mailto:deiviarcanjoo@gmail.com">deiviarcanjoo@gmail.com</a>. Veja também nossa{' '}
          <Link to="/privacidade">Política de Privacidade</Link>.
        </p>
      </div>
    </div>
  )
}
