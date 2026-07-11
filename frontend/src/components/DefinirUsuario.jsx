import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { MarcaMacacoFy } from './BarraNavegacao.jsx'

// Modal obrigatório (não-dispensável): trava o app até o usuário definir um nome de usuário.
// Aparece para contas antigas, criadas antes de existir o campo de username.
export default function DefinirUsuario({ sugestao = '', onConcluir }) {
  const [nomeUsuario, setNomeUsuario] = useState(
    (sugestao || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20),
  )
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const valido = /^[a-z0-9_]{3,20}$/.test(nomeUsuario)

  async function salvar(e) {
    e.preventDefault()
    setErro('')
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
    onConcluir?.()
  }

  return (
    <div className="modal-fundo" style={{ zIndex: 200 }}>
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-corpo" style={{ padding: '28px 26px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <MarcaMacacoFy tamanho={34} />
            <span className="marca-nome" style={{ fontSize: 18, fontWeight: 700 }}>MacacoFy</span>
          </div>

          <div className="modal-titulo" style={{ fontSize: 18 }}>Escolha seu nome de usuário</div>
          <p className="texto-suave" style={{ marginTop: 6, marginBottom: 18 }}>
            É assim que você aparece no ranking público de vendedores. Você só precisa fazer isso uma vez.
          </p>

          {erro && <div className="erro-msg" style={{ marginBottom: 14 }}>{erro}</div>}

          <form onSubmit={salvar} noValidate>
            <div className="campo">
              <label>Nome de usuário</label>
              <input
                type="text"
                value={nomeUsuario}
                onChange={(e) => setNomeUsuario(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="ex: joao_vendas"
                autoFocus
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={20}
              />
              <span className="campo-aviso" style={{ color: 'var(--texto-suave)' }}>
                3 a 20 caracteres — letras minúsculas, números e _.
              </span>
            </div>
            <button className="botao" disabled={salvando || !valido} style={{ width: '100%', marginTop: 6 }}>
              {salvando ? 'Salvando…' : 'Confirmar e continuar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
