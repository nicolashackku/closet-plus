import { CalendarDays, Layers, Shirt, Sparkles, User } from 'lucide-react'
import { useStore } from './store'
import { Avatar, Confirm, Spinner } from './ui'
import Closet from './pages/Closet'
import Outfits, { OutfitDetail, OutfitPicker, PlanSheet } from './pages/Outfits'
import Stylist, { ItemPicker } from './pages/Stylist'
import Calendar from './pages/Calendar'
import Profile from './pages/Profile'
import { ItemDetail, ItemEditor } from './pages/ItemSheets'
import { OutfitEditor } from './pages/OutfitEditor'

const TABS = [
  { id: 'closet', name: 'Armario', icon: Shirt, page: Closet },
  { id: 'outfits', name: 'Outfits', icon: Layers, page: Outfits },
  { id: 'stylist', name: 'Estilista', icon: Sparkles, page: Stylist },
  { id: 'calendar', name: 'Calendario', icon: CalendarDays, page: Calendar },
  { id: 'profile', name: 'Perfil', icon: User, page: Profile },
]

const OVERLAYS = {
  item: ItemDetail, itemEdit: ItemEditor, outfit: OutfitDetail, outfitEdit: OutfitEditor,
  plan: PlanSheet, outfitPick: OutfitPicker, itemPick: ItemPicker, confirm: Confirm,
}

export default function App() {
  const { ready, tab, go, overlays, toast, profile } = useStore()
  if (!ready) return <div className="boot"><Spinner size={22} /></div>
  const current = TABS.find((t) => t.id === tab) || TABS[0]
  const Page = current.page

  return (
    <div className="shell">
      <nav className="nav" aria-label="Secciones">
        <div className="brand">Closet<span>+</span></div>
        {TABS.map((t) => (
          <button key={t.id} className={t.id === current.id ? 'on' : ''} onClick={() => go(t.id)} aria-current={t.id === current.id ? 'page' : undefined}>
            {t.id === 'profile' && profile.avatar ? <Avatar size={24} /> : <t.icon size={22} strokeWidth={t.id === current.id ? 2.1 : 1.7} />}
            <span>{t.name}</span>
          </button>
        ))}
      </nav>

      <main className="main" key={current.id}><Page /></main>

      {overlays.map((o) => {
        const Comp = OVERLAYS[o.type]
        return Comp ? <Comp key={o.key} {...o.props} /> : null
      })}

      {toast && <div className="toast" role="status" key={toast.id}>{toast.msg}</div>}
    </div>
  )
}
