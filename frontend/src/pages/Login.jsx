import { useState, useMemo } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import { MarcaMacacoFy } from '../components/BarraNavegacao.jsx'

const FAIXAS = [
  { valor: 'sem_faturamento', rotulo: 'Ainda não faturo' },
  { valor: 'ate_5k', rotulo: 'Até R$ 5 mil / mês' },
  { valor: '5k_20k', rotulo: 'R$ 5 mil – R$ 20 mil / mês' },
  { valor: '20k_50k', rotulo: 'R$ 20 mil – R$ 50 mil / mês' },
  { valor: '50k_100k', rotulo: 'R$ 50 mil – R$ 100 mil / mês' },
  { valor: 'acima_100k', rotulo: 'Acima de R$ 100 mil / mês' },
]

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

export default function Login() {
  const { entrar, cadastrar, recuperarSenha, reenviarConfirmacao } = useAuth()
  const [modo, setModo] = useState('entrar') // 'entrar' | 'cadastrar' | 'recuperar'

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [nascimento, setNascimento] = useState('')
  const [faixa, setFaixa] = useState('')
  const [senha, setSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [verSenha, setVerSenha] = useState(false)
  const [verConfirma, setVerConfirma] = useState(false)

  const [erro, setErro] = useState(null)
  const [msg, setMsg] = useState(null)
  const [precisaConfirmar, setPrecisaConfirmar] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const forca = useMemo(() => forcaSenha(senha), [senha])
  const forcaRotulo = ['', 'Fraca', 'Razoável', 'Boa', 'Forte'][forca]

  function limparMensagens() {
    setErro(null); setMsg(null); setPrecisaConfirmar(false)
  }

  function trocarModo(novo) {
    limparMensagens()
    setSenha(''); setConfirma('')
    setModo(novo)
  }

  function validar() {
    if (modo === 'cadastrar') {
      if (!nome.trim()) return 'Informe seu nome.'
      if (!nascimento) return 'Informe sua data de nascimento.'
      const idade = idadeEmAnos(nascimento)
      if (idade === null) return 'Data de nascimento inválida.'
      if (idade < 18) return 'Você precisa ter 18 anos ou mais para criar uma conta.'
      if (idade > 120) return 'Data de nascimento inválida.'
      if (!faixa) return 'Selecione sua média de faturamento.'
      if (senha.length < 6) return 'A senha precisa ter no mínimo 6 caracteres.'
      if (senha !== confirma) return 'As senhas não conferem.'
    }
    if (modo === 'entrar' && senha.length < 1) return 'Digite sua senha.'
    return null
  }

  async function enviar(e) {
    e.preventDefault()
    limparMensagens()

    if (modo === 'recuperar') {
      setEnviando(true)
      const { error } = await recuperarSenha(email)
      setEnviando(false)
      if (error) setErro(traduzErro(error.message))
      else setMsg('Se este e-mail estiver cadastrado, enviamos um link para redefinir a senha.')
      return
    }

    const problema = validar()
    if (problema) { setErro(problema); return }

    setEnviando(true)
    if (modo === 'entrar') {
      const { error } = await entrar(email, senha)
      setEnviando(false)
      if (error) {
        if (/email not confirmed/i.test(error.message)) {
          setPrecisaConfirmar(true)
          setErro('Seu e-mail ainda não foi confirmado.')
        } else {
          setErro(traduzErro(error.message))
        }
      }
      return
    }

    // cadastrar
    const { data, error } = await cadastrar(email, senha, {
      nome: nome.trim(),
      data_nascimento: nascimento,
      faturamento_faixa: faixa,
    })
    setEnviando(false)
    if (error) { setErro(traduzErro(error.message)); return }
    // Se a confirmação de e-mail estiver desligada, a sessão já vem pronta e o app entra sozinho.
    if (!data.session) {
      setMsg('Conta criada! Verifique seu e-mail para confirmar antes de entrar.')
      setModo('entrar')
    }
  }

  async function reenviar() {
    limparMensagens()
    setEnviando(true)
    const { error } = await reenviarConfirmacao(email)
    setEnviando(false)
    if (error) setErro(traduzErro(error.message))
    else setMsg('Enviamos um novo e-mail de confirmação.')
  }

  const titulo = modo === 'entrar' ? 'Entrar' : modo === 'cadastrar' ? 'Criar conta' : 'Recuperar senha'

  return (
    <div className="tela-login">
      <div className="card login-card">
        <div className="login-marca">
          <MarcaMacacoFy tamanho={44} />
          <h1 className="marca-nome">MacacoFy</h1>
          <p className="texto-suave login-sub">Seu lucro real, em tempo real. Dados individuais e privados.</p>
        </div>

        <div className="login-titulo">{titulo}</div>

        {erro && <div className="erro-msg">{erro}</div>}
        {precisaConfirmar && (
          <button type="button" className="botao secundario" style={{ marginBottom: 16 }} onClick={reenviar} disabled={enviando}>
            Reenviar e-mail de confirmação
          </button>
        )}
        {msg && <div className="sucesso-msg">{msg}</div>}

        <form onSubmit={enviar} noValidate>
          {modo === 'cadastrar' && (
            <div className="campo">
              <label>Nome completo</label>
              <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Como podemos te chamar" autoComplete="name" />
            </div>
          )}

          <div className="campo">
            <label>E-mail</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" autoComplete="email" required />
          </div>

          {modo === 'cadastrar' && (
            <>
              <div className="campo">
                <label>Data de nascimento</label>
                <input type="date" value={nascimento} onChange={(e) => setNascimento(e.target.value)} max={hojeISO()} autoComplete="bday" />
              </div>
              <div className="campo">
                <label>Média de faturamento mensal com infoprodutos</label>
                <select value={faixa} onChange={(e) => setFaixa(e.target.value)}>
                  <option value="" disabled>Selecione uma faixa</option>
                  {FAIXAS.map((f) => (
                    <option key={f.valor} value={f.valor}>{f.rotulo}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {modo !== 'recuperar' && (
            <div className="campo">
              <label>Senha</label>
              <div className="campo-senha">
                <input
                  type={verSenha ? 'text' : 'password'}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder={modo === 'cadastrar' ? 'Mínimo 6 caracteres' : 'Sua senha'}
                  autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
                  required
                />
                <button type="button" className="olho" onClick={() => setVerSenha((v) => !v)} aria-label={verSenha ? 'Ocultar senha' : 'Mostrar senha'} tabIndex={-1}>
                  {verSenha ? <OlhoFechado /> : <OlhoAberto />}
                </button>
              </div>
              {modo === 'cadastrar' && senha.length > 0 && (
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
          )}

          {modo === 'cadastrar' && (
            <div className="campo">
              <label>Confirmar senha</label>
              <div className="campo-senha">
                <input
                  type={verConfirma ? 'text' : 'password'}
                  value={confirma}
                  onChange={(e) => setConfirma(e.target.value)}
                  placeholder="Repita a senha"
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
          )}

          {modo === 'entrar' && (
            <div className="login-esqueci">
              <a href="#" onClick={(e) => { e.preventDefault(); trocarModo('recuperar') }}>Esqueci minha senha</a>
            </div>
          )}

          <button className="botao" disabled={enviando}>
            {enviando ? 'Aguarde…' : titulo}
          </button>
        </form>

        <p className="texto-suave login-troca">
          {modo === 'entrar' && (
            <>Não tem conta? <a href="#" onClick={(e) => { e.preventDefault(); trocarModo('cadastrar') }}>Cadastre-se grátis</a></>
          )}
          {modo === 'cadastrar' && (
            <>Já tem conta? <a href="#" onClick={(e) => { e.preventDefault(); trocarModo('entrar') }}>Entrar</a></>
          )}
          {modo === 'recuperar' && (
            <>Lembrou a senha? <a href="#" onClick={(e) => { e.preventDefault(); trocarModo('entrar') }}>Voltar para o login</a></>
          )}
        </p>
      </div>
    </div>
  )
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10)
}

function idadeEmAnos(iso) {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  const hoje = new Date()
  let idade = hoje.getFullYear() - d.getFullYear()
  const m = hoje.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && hoje.getDate() < d.getDate())) idade--
  return idade
}

function traduzErro(msg) {
  if (/invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.'
  if (/already registered|already been registered/i.test(msg)) return 'Este e-mail já está cadastrado. Tente entrar.'
  if (/at least 6|password should be at least/i.test(msg)) return 'A senha precisa ter no mínimo 6 caracteres.'
  if (/email not confirmed/i.test(msg)) return 'Seu e-mail ainda não foi confirmado.'
  if (/unable to validate email|invalid.*email/i.test(msg)) return 'E-mail inválido.'
  if (/rate limit|too many/i.test(msg)) return 'Muitas tentativas. Aguarde alguns instantes e tente de novo.'
  if (/network|failed to fetch/i.test(msg)) return 'Falha de conexão. Verifique sua internet.'
  return msg
}
