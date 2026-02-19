import { createFileRoute, redirect } from '@tanstack/react-router'
import { Auth } from '../domains/auth/Auth'
import { useAuth } from '@hooks'
import { useState } from 'react'
import { notifications } from '@mantine/notifications'
import { resendCodeFn } from '@server/auth'
import { useServerFn } from '@tanstack/react-start'

export const Route = createFileRoute('/login')({
  component: LoginComp,
})

function LoginComp() {
  const { signInWithPassword, isLoading } = useAuth()
  const resend = useServerFn(resendCodeFn)

  const [errorCode, setErrorCode] = useState<string | undefined>(undefined)
  const [email, setEmail] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)

    const emailVal = fd.get('email') as string
    const password = fd.get('password') as string

    setEmail(emailVal)

    const { error } = await signInWithPassword(emailVal, password)

    if (!error) {
      throw redirect({ href: '/' })
    }

    setErrorCode(error.code) // <- Typed: string
  }

  async function handleResend() {
    if (!email) return
    const res = await resend({ data: { email } })

    notifications.show({
      message: res.error ? 'Error resending email' : 'Confirmation link sent!',
      color: res.error ? 'red' : 'green',
    })
  }

  return (
    <Auth
      actionText='Login'
      status={isLoading ? 'pending' : 'idle'}
      onSubmit={handleSubmit}
      afterSubmit={
        errorCode === 'email_not_confirmed' ?
          <>
            Email not confirmed.
            <button onClick={handleResend}>Resend</button>
          </>
        : null
      }
    />
  )
}
