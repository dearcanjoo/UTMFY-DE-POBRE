import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth.js'
import { useSyncAutomatico } from './hooks/useSyncAutomatico.js'
import BarraNavegacao from './components/BarraNavegacao.jsx'
import Login from './pages/Login.jsx'
import DefinirNovaSenha from './pages/DefinirNovaSenha.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Produtos from './pages/Produtos.jsx'
import Integracoes from './pages/Integracoes.jsx'
import Custos from './pages/Custos.jsx'
import Configuracoes from './pages/Configuracoes.jsx'

export default function App() {
  const { usuario, carregando, recuperandoSenha, atualizarSenha, concluirRecuperacao, sair } = useAuth()
  useSyncAutomatico(usuario) // sincroniza Cakto + Meta ao abrir o app e ao voltar o foco

  if (carregando) {
    return (
      <div className="tela-login">
        <div className="texto-suave">Carregando…</div>
      </div>
    )
  }

  // Fluxo do link "esqueci minha senha": mostra a tela de definir nova senha
  // antes de liberar o app, mesmo que já exista uma sessão de recuperação.
  if (recuperandoSenha) {
    return <DefinirNovaSenha atualizarSenha={atualizarSenha} concluir={concluirRecuperacao} sair={sair} />
  }

  if (!usuario) return <Login />

  return (
    <div className="app-layout">
      <BarraNavegacao />
      <main className="conteudo">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/produtos" element={<Produtos />} />
          <Route path="/integracoes" element={<Integracoes usuario={usuario} />} />
          <Route path="/custos" element={<Custos usuario={usuario} />} />
          <Route path="/configuracoes" element={<Configuracoes usuario={usuario} sair={sair} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <BarraNavegacao inferior />
    </div>
  )
}
