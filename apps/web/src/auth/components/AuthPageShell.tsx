import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import ILogo from '#assets/icons/ILogo'
import { ThemeToggle } from '#ui/primitives'
import * as styles from '../auth.css'
import { MoveLeft } from 'lucide-react'

export interface AuthPageShellProps {
  title: string
  description: string
  children: ReactNode
}

export function AuthPageShell({ title, description, children }: AuthPageShellProps) {
  return (
    <main className={styles.authRoot} data-testid='auth-shell'>
      <section className={styles.authHeroPanel} aria-label='Artificer Toolkit introduction'>
        <div className={styles.authHeroHeader}>
          <Link className={styles.authBrand} to='/'>
            <ILogo className={styles.authLogo} aria-hidden='true' />
            <span>Artificer Toolkit</span>
          </Link>
          <ThemeToggle />
        </div>

        <div className={styles.authHeroCopy}>
          <h1 className={styles.authHeroTitle}>Make something worth playing.</h1>
          <p className={styles.authHeroSubtitle}>
            Sign in to keep your homebrew, characters, and table tools close without turning
            creativity into paperwork.
          </p>
        </div>
      </section>

      <section className={styles.authPanel} aria-label={title}>
        <Link to='/' className={styles.authBackLink}>
          <MoveLeft />
          Back
        </Link>
        <div className={styles.authCard}>
          <header className={styles.authCardHeader}>
            <h2 className={styles.authTitle}>{title}</h2>
            <p className={styles.authDescription}>{description}</p>
          </header>
          {children}
        </div>
      </section>
    </main>
  )
}
