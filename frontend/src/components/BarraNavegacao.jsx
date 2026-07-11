import { NavLink } from 'react-router-dom'

const Icone = ({ d }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
)

// Marca MacacoFy: quadrado amarelo banana com arco em verde-grafite
export const MarcaMacacoFy = ({ tamanho = 30 }) => (
  <svg width={tamanho} height={tamanho} viewBox="0 0 32 32" aria-hidden="true">
    <rect width="32" height="32" rx="9" fill="#f2c53d" />
    <path d="M8 19c3.6 4.4 10 4.2 14-2" stroke="#121814" strokeWidth="3.4" strokeLinecap="round" fill="none" />
    <circle cx="23.2" cy="15.4" r="1.7" fill="#121814" />
  </svg>
)

const ITENS = [
  { para: '/', rotulo: 'Dashboard', icone: 'M3 12l9-9 9 9M5 10v10h5v-6h4v6h5V10' },
  { para: '/produtos', rotulo: 'Produtos', icone: 'M21 8l-9-5-9 5v8l9 5 9-5V8M3 8l9 5 9-5M12 13v8' },
  { para: '/custos', rotulo: 'Custos', icone: 'M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6' },
  { para: '/integracoes', rotulo: 'Conexões', icone: 'M10 13a5 5 0 007.5.5l3-3a5 5 0 00-7-7l-1.5 1.5M14 11a5 5 0 00-7.5-.5l-3 3a5 5 0 007 7L12 19' },
  { para: '/configuracoes', rotulo: 'Conta', icone: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8' },
]

export default function BarraNavegacao({ inferior = false }) {
  const classe = inferior ? 'nav-inferior' : 'nav-lateral'
  return (
    <nav className={classe}>
      {!inferior && (
        <div className="nav-logo">
          <MarcaMacacoFy />
          <span className="marca-nome">MacacoFy</span>
        </div>
      )}
      {ITENS.map((item) => (
        <NavLink
          key={item.para}
          to={item.para}
          className={({ isActive }) => `nav-item ${isActive ? 'ativo' : ''}`}
          end={item.para === '/'}
        >
          <Icone d={item.icone} />
          {item.rotulo}
        </NavLink>
      ))}
    </nav>
  )
}
