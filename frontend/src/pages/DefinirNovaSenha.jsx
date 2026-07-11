import { useState, useMemo } from 'react'
import { MarcaMacacoFy } from '../components/BarraNavegacao.jsx'

const OlhoAberto = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
)
const OlhoFechado = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
)

function forcaSenha(s) {
  if (!s) return 0
  let f = 0
  if (s.length >= 6) f++
  if (s.length >= 10) f++
  if (/[A-Z]/.test(s) && /[a-z]/.test(s)) f++
  if (/\d/.test(s)) f++
  if (/[^A-Za-z0-9]/.test(s)) f++
  return Math.min(f, 4)
}

export default function DefinirNovaSenha({ atualizarSenha, concluir, sair }) {
  const [senha, setSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [verSenha, setVerSenha] = useState(false)
  const [verConfirma, setVerConfirma] = useState(false)
  const [erro, setErro] = useState(null)
  const [ok, setOk] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const forca = useMemo(() => forcaSenha(senha), [senha])
  const forcaRotulo = ['', 'Fraca', 'Razoável', 'Boa', 'Forte'][forca]

  async function enviar(e) {
    e.preventDefault()
    setErro(null)
    if (senha.length < 6) { setErro('A senha precisa ter no mínimo 6 caracteres.'); return }
    if (senha !== confirma) { setErro('As senhas não conferem.'); return }

    setEnviando(true)
    const { error } = await atualizarSenha(senha)
    setEnviando(false)
    if (error) {
      if (/should be different|different from the old/i.test(error.message)) setErro('A nova senha precisa ser diferente da anterior.')
      else if (/at least 6/i.test(error.message)) setErro('A senha precisa ter no mínimo 6 caracteres.')
      else setErro(error.message)
      return
    }
    setOk(true)
    // Pequena pausa para o usuário ver a confirmação e então entra no app (já está logado).
    setTimeout(() => concluir(), 1200)
  }

  return (
    <div className="tela-login">
      <div className="card login-card">
        <div className="login-marca">
          <MarcaMacacoFy tamanho={44} />
          <h1 className="marca-nome">MacacoFy</h1>
        </div>

        <div className="login-titulo">Definir nova senha</div>
        <p className="texto-suave login-sub" style={{ marginBottom: 18 }}>
          Escolha uma nova senha para sua conta. Depois de salvar, você já entra direto.
        </p>

        {erro && <div className="erro-msg">{erro}</div>}
        {ok && <div className="sucesso-msg">Senha atualizada! Entrando…</div>}

        {!ok && (
          <form onSubmit={enviar} noValidate>
            <div className="campo">
              <label>Nova senha</label>
              <div className="campo-senha">
                <input
                  type={verSenha ? 'text' : 'password'}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  autoComplete="new-password"
                  autoFocus
                  required
                />
                <button type="button" className="olho" onClick={() => setVerSenha((v) => !v)} aria-label={verSenha ? 'Ocultar senha' : 'Mostrar senha'} tabIndex={-1}>
                  {verSenha ? <OlhoFechado /> : <OlhoAberto />}
                </button>
              </div>
              {senha.length > 0 && (
                <div className="forca-senha">
                  <div className="forca-barras">
                    {[1, 2, 3, 4].map((n) => (
                      <span key={n} className={`forca-barra n${forca}` + (n <= forca ? ' ativa' : '')} />
                    ))}
                  </div>
                  <span className="forca-rotulo">{forcaRotulo}</span>
                </div>
              )}
            </div>

            <div className="campo">
              <label>Confirmar nova senha</label>
              <div className="campo-senha">
                <input
                  type={verConfirma ? 'text' : 'password'}
                  value={confirma}
                  onChange={(e) => setConfirma(e.target.value)}
                  placeholder="Repita a nova senha"
                  autoComplete="new-password"
                  required
                />
                <button type="button" className="olho" onClick={() => setVerConfirma((v) => !v)} aria-label={verConfirma ? 'Ocultar senha' : 'Mostrar senha'} tabIndex={-1}>
                  {verConfirma ? <OlhoFechado /> : <OlhoAberto />}
                </button>
              </div>
              {confirma.length > 0 && confirma !== senha && (
                <span className="campo-aviso">As senhas não conferem.</span>
              )}
            </div>

            <button className="botao" disabled={enviando}>
              {enviando ? 'Salvando…' : 'Salvar nova senha'}
            </button>
          </form>
        )}

        <p className="texto-suave login-troca">
          <a href="#" onClick={(e) => { e.preventDefault(); sair() }}>Cancelar e voltar ao login</a>
        </p>
      </div>
    </div>
  )
}
