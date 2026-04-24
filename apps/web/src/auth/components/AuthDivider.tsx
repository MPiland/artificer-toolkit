import { authDivider, authDividerLine } from '../auth.css'

export function AuthDivider() {
  return (
    <div className={authDivider} aria-hidden='true'>
      <span className={authDividerLine} />
      <span>or</span>
      <span className={authDividerLine} />
    </div>
  )
}
