import { createFileRoute, redirect } from '@tanstack/react-router'
import { Auth } from '../domains/auth/Auth'
import { useAuth } from '@hooks'

export const Route = createFileRoute('/signup')({
  component: SignupComp
})

function SignupComp() {
  const { signUp, isLoading } = useAuth()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)

    const email = fd.get('email') as string
    const password = fd.get('password') as string

    const { data, error } = await signUp(email, password)

    if (error) {
      return error.message // already normalized
    }

    // If auto-confirmed
    if (data?.session) {
      throw redirect({ href: '/' })
    }

    return 'Please check email to confirm your account.'
  }

  return <Auth actionText="Sign Up" status={isLoading ? 'pending' : 'idle'} onSubmit={handleSubmit} />
}
