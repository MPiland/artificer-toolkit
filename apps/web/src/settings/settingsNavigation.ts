import { ShieldCheck, SlidersHorizontal, UserRound } from 'lucide-react'

export const settingsNavigation = [
  { href: '/settings/profile', icon: UserRound, label: 'Profile' },
  { href: '/settings/preferences', icon: SlidersHorizontal, label: 'Preferences' },
  { href: '/settings/account', icon: ShieldCheck, label: 'Account' }
] as const
