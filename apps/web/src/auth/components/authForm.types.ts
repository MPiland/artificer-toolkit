import { AuthClient } from '../authClient'

export interface AuthFormProps {
  authClient?: AuthClient
  onSuccess?: () => void | Promise<void>
}
