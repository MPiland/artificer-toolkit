import { Button, Stack } from '@mantine/core'
import { Link } from '@tanstack/react-router'
import { CheckCircle2 } from 'lucide-react'
import { confirmedIcon, confirmedSubtext, confirmedTitle, submitButton } from './Auth.css'
import { AuthFrame } from './AuthFrame'

export function AuthConfirmed() {
  return (
    <AuthFrame title='Email confirmed' subtitle='Your account is ready. Sign in and get back to building.'>
      <Stack gap='xl' align='flex-start'>
        <div className={confirmedIcon}>
          <CheckCircle2 size={30} strokeWidth={1.8} />
        </div>

        <Stack gap='sm'>
          <div className={confirmedTitle}>You are all set.</div>
          <div className={confirmedSubtext}>
            Your email is confirmed and your workspace is ready when you are.
          </div>
        </Stack>

        <Button component={Link} to='/login' fullWidth className={submitButton}>
          Go to sign in
        </Button>
      </Stack>
    </AuthFrame>
  )
}
