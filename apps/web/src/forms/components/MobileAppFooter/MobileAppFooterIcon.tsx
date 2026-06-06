import { BookOpen, PlusCircle, Search, UserCircle } from 'lucide-react'
import type { MobileAppFooterItemIcon } from './MobileAppFooter.types'

export function MobileAppFooterIcon({ icon }: { icon: MobileAppFooterItemIcon }) {
  const size = 18

  switch (icon) {
    case 'account':
      return <UserCircle size={size} />
    case 'create':
      return <PlusCircle size={size} />
    case 'search':
      return <Search size={size} />
    case 'library':
    default:
      return <BookOpen size={size} />
  }
}
