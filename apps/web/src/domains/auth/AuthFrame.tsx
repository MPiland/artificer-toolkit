import type { ReactNode } from 'react'
import ILogo from '@assets/icons/ILogo'
import {
  authBrandBlock,
  authBrandEyebrow,
  authBrandMark,
  authBrandName,
  authCard,
  authHeader,
  authHero,
  authHeroBrand,
  authHeroCopy,
  authHeroItem,
  authHeroKicker,
  authHeroList,
  authHeroTitle,
  authPanel,
  authRoot,
  authStage,
  authSubtitle,
  authTitle,
} from './Auth.css'

const heroItems = [
  'Create classes, races, spells, and character options in one calm workspace.',
  'Keep long-form homebrew readable with structure that scales across desktop and mobile.',
  'Move from draft to table-ready material without fighting the interface.',
]

interface AuthFrameProps {
  title: string
  subtitle: ReactNode
  children: ReactNode
}

export function AuthFrame({ title, subtitle, children }: AuthFrameProps) {
  return (
    <div className={authRoot}>
      <div className={authStage}>
        <aside className={authHero}>
          <div className={authHeroBrand}>
            <ILogo className={authBrandMark} />
            <div className={authBrandBlock}>
              <div className={authBrandEyebrow}>Homebrew design studio</div>
              <div className={authBrandName}>Artificer Toolkit</div>
            </div>
          </div>

          <div className={authHeroKicker}>Built for the long session</div>
          <h1 className={authHeroTitle}>Build worlds with a steadier toolkit.</h1>
          <p className={authHeroCopy}>
            Shape your system, organize your ideas, and keep every decision readable from first spark to
            final revision.
          </p>

          <ul className={authHeroList}>
            {heroItems.map((item) => (
              <li key={item} className={authHeroItem}>
                {item}
              </li>
            ))}
          </ul>
        </aside>

        <section className={authPanel}>
          <div className={authCard}>
            <div className={authHeader}>
              <div className={authHeroBrand}>
                <ILogo className={authBrandMark} />
                <div className={authBrandBlock}>
                  <div className={authBrandEyebrow}>Homebrew design studio</div>
                  <div className={authBrandName}>Artificer Toolkit</div>
                </div>
              </div>

              <div className={authTitle}>{title}</div>
              <div className={authSubtitle}>{subtitle}</div>
            </div>

            {children}
          </div>
        </section>
      </div>
    </div>
  )
}
