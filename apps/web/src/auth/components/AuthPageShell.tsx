import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import ILogo from '#assets/icons/ILogo'
import { ThemeToggle } from '#app/ui/primitives'
import {
  authBrand,
  authCard,
  authCardHeader,
  authDescription,
  authHeroCopy,
  authHeroHeader,
  authHeroPanel,
  authHeroPanelSupport,
  authHeroSubtitle,
  authHeroTitle,
  authHeroTitleSupport,
  authLogo,
  authPanel,
  authPanelSupport,
  authRoot,
  authRootSupport,
  authTitle
} from '../auth.css'

export interface AuthPageShellProps {
  title: string
  description: string
  children: ReactNode
  variant?: 'entry' | 'support'
}

export function AuthPageShell({ title, description, children, variant = 'entry' }: AuthPageShellProps) {
  const isSupport = variant === 'support'

  return (
    <main className={isSupport ? `${authRoot} ${authRootSupport}` : authRoot} data-testid='auth-shell'>
      <section
        className={isSupport ? `${authHeroPanel} ${authHeroPanelSupport}` : authHeroPanel}
        aria-label='Artificer Toolkit introduction'
      >
        <div className={authHeroHeader}>
          <Link className={authBrand} to='/'>
            <ILogo className={authLogo} aria-hidden='true' />
            <span>Artificer Toolkit</span>
          </Link>
          <ThemeToggle />
        </div>

        <div className={authHeroCopy}>
          <div>
            <h1 className={isSupport ? `${authHeroTitle} ${authHeroTitleSupport}` : authHeroTitle}>
              {isSupport ? (
                <>
                  Get back to your table.
                </>
              ) : (
                <>
                  Make something worth playing.
                </>
              )}
            </h1>
            <p className={authHeroSubtitle}>
              {isSupport
                ? 'A short account step, then you are back to building characters, content, and play-ready notes.'
                : 'Sign in to keep your homebrew, characters, and table tools close without turning creativity into paperwork.'}
            </p>
          </div>
        </div>
      </section>

      <section className={isSupport ? `${authPanel} ${authPanelSupport}` : authPanel} aria-label={title}>
        <div className={authCard}>
          <header className={authCardHeader}>
            <h2 className={authTitle}>{title}</h2>
            <p className={authDescription}>{description}</p>
          </header>
          {children}
        </div>
      </section>
    </main>
  )
}
