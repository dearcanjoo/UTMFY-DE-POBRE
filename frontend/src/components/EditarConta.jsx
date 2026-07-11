import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

// Edição dos dados da conta: nome de usuário, senha e e-mail.
// Cada bloco é independente e mostra seu próprio feedback de sucesso/erro.
export default function EditarConta({ usuario, entrar, atualizarSenha, atualizarEmail }) {
  return (
    <div className="card secao">
      <div className="subtitulo">Dados da conta</div>
      <BlocoUsuario />
      <div className="conta-divisor" />
      <BlocoSenha usuario={usuario} entrar={entrar} atualizarSenha={atualizarSenha} />
      <div className="conta-divisor" />
      <BlocoEmail usuario={usuario} entrar={entrar} atualizarEmail={atualizarEmail} />
    </div>
  )
}

// Mensagem de status reutilizável (verde para ok, vermelho para erro).
function Aviso({ tipo, children }) {
  if (!children) return null
  return <div className={tipo === 'ok' ? 'sucesso-msg' : 'erro-msg'} style={{ marginBottom: 12 }}>{children}</div>
}

function BlocoUsuario() {
  const [nomeUsuario, setNomeUsuario] = useState('')
  const [original, setOriginal] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id
      if (!uid) { setCarregando(false); return }
      const { data: perfil } = await supabase
        .from('perfis').select('nome_usuario').eq('usuario_id', uid).maybeSingle()
      const atual = perfil?.nome_usuario || ''
      setNomeUsuario(atual); setOriginal(atual); setCarregando(false)
    })
  }, [])

  const valido = /^[a-z0-9_]{3,20}$/.test(nomeUsuario)
  const mudou = nomeUsuario !== original

  async function salvar(e) {
    e.preventDefault()
    setErro(''); setOk('')
    if (!valido) { setErro('Use 3 a 20 caracteres: letras minúsculas, números e _.'); return }
    setSalvando(true)
    const { data, error } = await supabase.rpc('definir_username', { candidato: nomeUsuario })
    setSalvando(false)
    if (error) { setErro('Não consegui salvar agora. Tente novamente.'); return }
    if (!data?.ok) {
      if (data?.erro === 'em_uso') setErro('Esse nome de usuário já está em uso. Escolha outro.')
      else if (data?.erro === 'formato') setErro('Use 3 a 20 caracteres: letras minúsculas, números e _.')
      else setErro('Não consegui salvar agora. Tente novamente.')
      return
    }
    setOriginal(nomeUsuario)
    setOk('Nome de usuário atualizado.')
  }

  return (
    <form onSubmit={salvar} noValidate>
      <div className="conta-bloco-titulo">Nome de usuário</div>
      <p className="texto-suave" style={{ marginTop: 0, marginBottom: 12 }}>
        É assim que você aparece no ranking público de vendedores.
      </p>
      <Aviso tipo="erro">{erro}</Aviso>
      <Aviso tipo="ok">{ok}</Aviso>
      <div className="campo">
        <input
          type="text"
          value={nomeUsuario}
          onChange={(e) => { setNomeUsuario(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')); setOk('') }}
          placeholder={carregando ? 'carregando…' : 'ex: joao_vendas'}
          autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={20}
          disabled={carregando}
        />
        <span className="campo-aviso" style={{ color: 'var(--texto-suave)' }}>
          3 a 20 caracteres — letras minúsculas, números e _.
        </span>
      </div>
      <button className="botao" disabled={salvando || !valido || !mudou || carregando}>
        {salvando ? 'Salvando…' : 'Salvar nome de usuário'}
      </button>
    </form>
  )
}

function BlocoSenha({ usuario, entrar, atualizarSenha }) {
  const [atual, setAtual] = useState('')
  const [nova, setNova] = useState('')
  const [confirma, setConfirma] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')

  async function salvar(e) {
    e.preventDefault()
    setErro(''); setOk('')
    if (nova.length < 6) { setErro('A nova senha precisa ter ao menos 6 caracteres.'); return }
    if (nova !== confirma) { setErro('A confirmação não bate com a nova senha.'); return }
    if (nova === atual) { setErro('A nova senha precisa ser diferente da atual.'); return }
    setSalvando(true)
    // Confirma a senha atual reautenticando antes de trocar.
    const { error: erroLogin } = await entrar(usuario.email, atual)
    if (erroLogin) { setSalvando(false); setErro('Senha atual incorreta.'); return }
    const { error } = await atualizarSenha(nova)
    setSalvando(false)
    if (error) { setErro('Não consegui alterar a senha agora. Tente novamente.'); return }
    setAtual(''); setNova(''); setConfirma('')
    setOk('Senha alterada com sucesso.')
  }

  return (
    <form onSubmit={salvar} noValidate>
      <div className="conta-bloco-titulo">Senha</div>
      <Aviso tipo="erro">{erro}</Aviso>
      <Aviso tipo="ok">{ok}</Aviso>
      <div className="campo">
        <label>Senha atual</label>
        <input type="password" value={atual} onChange={(e) => { setAtual(e.target.value); setOk('') }}
          autoComplete="current-password" placeholder="sua senha atual" />
      </div>
      <div className="campo">
        <label>Nova senha</label>
        <input type="password" value={nova} onChange={(e) => { setNova(e.target.value); setOk('') }}
          autoComplete="new-password" placeholder="mínimo 6 caracteres" />
      </div>
      <div className="campo">
        <label>Confirmar nova senha</label>
        <input type="password" value={confirma} onChange={(e) => { setConfirma(e.target.value); setOk('') }}
          autoComplete="new-password" placeholder="repita a nova senha" />
      </div>
      <button className="botao" disabled={salvando || !atual || !nova || !confirma}>
        {salvando ? 'Salvando…' : 'Alterar senha'}
      </button>
    </form>
  )
}

function BlocoEmail({ usuario, entrar, atualizarEmail }) {
  const [novoEmail, setNovoEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')

  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(novoEmail.trim())

  async function salvar(e) {
    e.preventDefault()
    setErro(''); setOk('')
    if (!emailValido) { setErro('Digite um e-mail válido.'); return }
    if (novoEmail.trim().toLowerCase() === (usuario.email || '').toLowerCase()) {
      setErro('Esse já é o seu e-mail atual.'); return
    }
    setSalvando(true)
    // Confirma a identidade com a senha atual antes de trocar o e-mail.
    const { error: erroLogin } = await entrar(usuario.email, senha)
    if (erroLogin) { setSalvando(false); setErro('Senha incorreta.'); return }
    const { error } = await atualizarEmail(novoEmail)
    setSalvando(false)
    if (error) {
      if (/registered|already/i.test(error.message || '')) setErro('Esse e-mail já está em uso.')
      else setErro('Não consegui alterar o e-mail agora. Tente novamente.')
      return
    }
    setNovoEmail(''); setSenha('')
    setOk('Enviamos um link de confirmação para o novo e-mail. A troca só é concluída após você clicar nesse link.')
  }

  return (
    <form onSubmit={salvar} noValidate>
      <div className="conta-bloco-titulo">E-mail</div>
      <p className="texto-suave" style={{ marginTop: 0, marginBottom: 12 }}>
        E-mail atual: <strong>{usuario.email}</strong>
      </p>
      <Aviso tipo="erro">{erro}</Aviso>
      <Aviso tipo="ok">{ok}</Aviso>
      <div className="campo">
        <label>Novo e-mail</label>
        <input type="email" value={novoEmail}
          onChange={(e) => { setNovoEmail(e.target.value); setOk('') }}
          autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="novo@email.com" />
      </div>
      <div className="campo">
        <label>Senha atual</label>
        <input type="password" value={senha} onChange={(e) => { setSenha(e.target.value); setOk('') }}
          autoComplete="current-password" placeholder="confirme com sua senha" />
      </div>
      <button className="botao" disabled={salvando || !novoEmail || !senha}>
        {salvando ? 'Enviando…' : 'Alterar e-mail'}
      </button>
    </form>
  )
}
