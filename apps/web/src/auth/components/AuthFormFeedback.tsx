import { authFormMessage, authFormMessageError, authFormMessageSuccess } from '../auth.css'
import type { AuthFeedback } from './authForm.types'

export function AuthFormFeedback({ feedback }: { feedback: AuthFeedback | null }) {
  if (!feedback) return null
  const isError = feedback.tone === 'error'
  return (
    <div
      className={`${authFormMessage} ${isError ? authFormMessageError : authFormMessageSuccess}`}
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
    >
      {feedback.message}
    </div>
  )
}
