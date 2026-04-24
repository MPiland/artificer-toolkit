import { AuthClient, AuthResult } from '../authClient'

export interface AuthFormProps {
  authClient?: AuthClient
  onSuccess?: (result: AuthResult) => void | Promise<void>
}
