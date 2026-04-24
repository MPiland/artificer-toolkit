import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import ILogo from '#assets/icons/ILogo'
import { authHeroBullets } from '#app/marketing/data'
import { ThemeToggle } from '#app/ui/primitives'
import {
  authBrand,
  authBulletList,
  authCard,
  authCardHeader,
  authDescription,
  authHeroCopy,
  authHeroHeader,
  authHeroPanel,
  authHeroSubtitle,
  authHeroTitle,
  authLogo,
  authPanel,
  authRoot,
  authTitle
} from '../auth.css'

export interface AuthPageShellProps {
  title: string
  description: string
  children: ReactNode
}

export function AuthPageShell({ title, description, children }: AuthPageShellProps) {
  return (
    <main className={authRoot} data-testid='auth-shell'>
      <section className={authHeroPanel} aria-label='Artificer Toolkit introduction'>
        <div className={authHeroHeader}>
          <Link className={authBrand} to='/'>
            <ILogo className={authLogo} aria-hidden='true' />
            <span>Artificer Toolkit</span>
          </Link>
          <ThemeToggle />
        </div>

        <div className={authHeroCopy}>
          <div>
            <h1 className={authHeroTitle}>
              Your world.
              <br />
              Your rules.
            </h1>
            <p className={authHeroSubtitle}>A creative toolkit for tabletop worldbuilders.</p>
          </div>
          <ul className={authBulletList}>
            {authHeroBullets.map((item) => (
              <li key={item}>
                *
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={authPanel} aria-label={title}>
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
