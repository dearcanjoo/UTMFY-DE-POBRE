import { useState } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import { MarcaMacacoFy } from '../components/BarraNavegacao.jsx'

export default function Login() {
  const { entrar, cadastrar } = useAuth()
  const [modo, setModo] = useState('entrar')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState(null)
  const [msg, setMsg] = useState(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(e) {
    e.preventDefault()
    setErro(null); setMsg(null); setEnviando(true)
    const fn = modo === 'entrar' ? entrar : cadastrar
    const { error } = await fn(email, senha)
    if (error) setErro(traduzErro(error.message))
    else if (modo === 'cadastrar') setMsg('Conta criada! Verifique seu e-mail para confirmar.')
    setEnviando(false)
  }

  return (
    <div className="tela-login">
      <div className="card">
        <div className="login-marca">
          <MarcaMacacoFy tamanho={44} />
          <h1 className="marca-nome">MacacoFy</h1>
          <p className="texto-suave" style={{ textAlign: 'center' }}>Seu lucro real, em tempo real. Dados individuais e privados.</p>
        </div>
        {erro && <div className="erro-msg">{erro}</div>}
        {msg && <div className="sucesso-msg">{msg}</div>}
        <form onSubmit={enviar}>
          <div className="campo">
            <label>E-mail</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div className="campo">
            <label>Senha</label>
            <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={6} autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'} />
          </div>
          <button className="botao" disabled={enviando}>
            {enviando ? 'Aguarde…' : modo === 'entrar' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>
        <p className="texto-suave" style={{ textAlign: 'center', marginTop: 16 }}>
          {modo === 'entrar' ? (
            <>Não tem conta? <a href="#" onClick={(e) => { e.preventDefault(); setModo('cadastrar') }}>Cadastre-se</a></>
          ) : (
            <>Já tem conta? <a href="#" onClick={(e) => { e.preventDefault(); setModo('entrar') }}>Entrar</a></>
          )}
        </p>
      </div>
    </div>
  )
}

function traduzErro(msg) {
  if (/invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.'
  if (/already registered/i.test(msg)) return 'Este e-mail já está cadastrado.'
  if (/at least 6/i.test(msg)) return 'A senha precisa ter no mínimo 6 caracteres.'
  return msg
}
