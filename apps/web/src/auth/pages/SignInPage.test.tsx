import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { AuthFormProps } from '../components/authForm.types'
import { SignInPage } from './SignInPage'

const mocks = vi.hoisted(() => ({
  invalidate: vi.fn(),
  clear: vi.fn(),
  navigate: vi.fn(),
  form: vi.fn<(props: AuthFormProps) => void>()
}))
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ clear: mocks.clear })
}))

vi.mock('../components/AuthPageShell', () => ({
  AuthPageShell: ({ children }: { children: ReactNode }) => children
}))
vi.mock('../components/SignInForm', () => ({
  SignInForm: (props: AuthFormProps) => {
    mocks.form(props)
    return null
  }
}))

it.each([undefined, '/systems'])(
  'clears the previous identity cache before one document redirect: %s',
  async (redirectTo) => {
    vi.clearAllMocks()
    render(<SignInPage redirectTo={redirectTo} />)
    const onSuccess = mocks.form.mock.lastCall?.[0].onSuccess
    expect(onSuccess).toBeDefined()
    const assign = vi.fn()
    vi.stubGlobal('window', { location: { assign } })
    try {
      await onSuccess?.({ ok: true })
      expect(mocks.clear).toHaveBeenCalledOnce()
      expect(assign).toHaveBeenCalledExactlyOnceWith(redirectTo ?? '/home')
      expect(mocks.clear.mock.invocationCallOrder[0]).toBeLessThan(
        assign.mock.invocationCallOrder[0]!
      )
    } finally {
      vi.unstubAllGlobals()
    }
  }
)
