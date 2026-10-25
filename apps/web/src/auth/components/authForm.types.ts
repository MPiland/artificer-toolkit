import { AuthClient, AuthResult } from '../authClient'

export interface AuthFormProps {
  authClient?: AuthClient
  onSuccess?: (result: AuthResult) => void | Promise<void>
}

export type AuthFeedback = { tone: 'error' | 'success'; message: string }
