export default function Configuracoes({ usuario, sair }) {
  return (
    <div>
      <h1 className="titulo-pagina">Configurações</h1>
      <div className="card secao">
        <div className="subtitulo">Conta</div>
        <p style={{ fontSize: 14, marginBottom: 4 }}>{usuario.email}</p>
        <p className="texto-suave">Seus dados são privados: cada usuário enxerga apenas as próprias vendas, gastos e custos (garantido no nível do banco).</p>
      </div>
      <div className="card secao">
        <div className="subtitulo">Instalar no celular</div>
        <p className="texto-suave">
          No Chrome do celular, abra este site, toque no menu do navegador e escolha "Adicionar à tela inicial". O app abre em tela cheia, como um aplicativo nativo.
        </p>
      </div>
      <button className="botao perigo" onClick={sair}>Sair da conta</button>
    </div>
  )
}
