import {
  passwordMatchFeedback,
  passwordMatchFeedbackError,
  passwordMatchFeedbackSuccess
} from '../auth.css'

export function PasswordMatchFeedback({
  confirmation,
  password
}: {
  confirmation: string
  password: string
}) {
  if (!confirmation) return null

  const passwordsMatch = password === confirmation

  return (
    <div
      className={`${passwordMatchFeedback} ${
        passwordsMatch ? passwordMatchFeedbackSuccess : passwordMatchFeedbackError
      }`}
      role='status'
      aria-live='polite'
    >
      {passwordsMatch ? 'Passwords match.' : 'Passwords do not match.'}
    </div>
  )
}
