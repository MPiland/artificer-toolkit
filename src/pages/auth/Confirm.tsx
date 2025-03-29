import { Navigate, useRouterState } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import Input from '../../components/Input/Input'
import Button from '../../components/Button/Button'
import { sprinkles } from '../../css/sprinkles.css'
import { handleResendSignUpCode, useConfirmPasswordReset, useConfirmSignUp } from '../../apis/authApi'
import Spinner from '../../components/Spinner/Spinner'
import { TbEye, TbEyeOff } from 'react-icons/tb'
import { Route } from '../../routes/$auth/$action'

const Confirm = () => {
  const { action } = Route.useParams()
  const username = useRouterState({ select: (s) => s.location.state.username })!
  const confirmationCode = useRouterState({ select: (s) => s.location.state.confirmationCode })!

  const resetPassword = action === 'reset-password'

  const { mutateAsync: confirmSignUp } = useConfirmSignUp()
  const { mutateAsync: confirmPasswordReset } = useConfirmPasswordReset()

  const [state, setState] = useState<{ password: string; username: string; confirmationCode: string }>({
    password: '',
    username: '',
    confirmationCode: '',
  })
  const [errorMsg, setErrMsg] = useState<string | null>(null)
  const [resendConfirm, setResendConfirm] = useState<boolean>(false)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [showPassword, setShowPassword] = useState<boolean>(false)

  const passwordRef = useRef<HTMLInputElement>(null!)

  const onConfirmClicked = async () => {
    setSubmitting(true)
    try {
      if (!resetPassword) {
        const result = await confirmSignUp({
          username: username,
          confirmationCode: state.confirmationCode,
        })

        if (result === 'SIGNED_IN') {
          setSubmitting(false)
          return <Navigate to='/' />
        }
        if (result === 'CODE_MISMATCH') {
          setErrMsg('Confirmation code does not match. Please re-enter and try again.')
          setSubmitting(false)
        }
      } else {
        const result = await confirmPasswordReset({
          username: username,
          confirmationCode: confirmationCode,
          password: state.password,
        })

        console.log({ result })

        if (result === 'DONE') {
          return <Navigate to='/$auth' params={{ auth: 'sign-in' }} />
        }
      }
    } catch (err: any) {
      setSubmitting(false)
      return console.error(err.message)
    }
  }

  return (
    <>
      {errorMsg && <p>{errorMsg}</p>}
      {resendConfirm && (
        <>
          <p>Username was not registration was not confirmed. Please resend confirmation to complete registration.</p>
          <Button
            color='primary'
            type='submit'
            disabled={submitting}
            onClick={(e: any) => {
              e.preventDefault()
              handleResendSignUpCode(state.username)
              setResendConfirm(false)
            }}
            className={sprinkles({ width: 'size-full' })}
          >
            {submitting ?
              <Spinner />
            : 'Resend Confirmation Code'}
          </Button>
        </>
      )}
      {!resendConfirm && (
        <>
          <p>Check the email used for registration for the confirmation code.</p>
          {resetPassword && (
            <Input
              className={sprinkles({ mb: 'space-2' })}
              validation='pwd'
              placeholder='Enter password...'
              type={showPassword ? 'text' : 'password'}
              name='password'
              label={'New Password'}
              autoComplete={'new-password'}
              required={true}
              value={state.password}
              onChange={(e) =>
                setState((prevState) => ({
                  ...prevState,
                  password: (e as { type: 'update'; value: string }).value,
                }))
              }
              endAdornment={
                <span
                  onClick={(e: any) => {
                    e.stopPropagation()
                    setShowPassword((prev) => !prev)
                  }}
                >
                  {showPassword ?
                    <TbEyeOff />
                  : <TbEye />}
                </span>
              }
              errorMsg={
                resetPassword &&
                'Password must be between 8 and 15 characters and include at least one uppercase letter, one lowercase letter, one symbol, and one number.'
              }
              ref={passwordRef}
            />
          )}
          <Input
            className={sprinkles({ mb: 'space-2' })}
            placeholder='Confirmation code...'
            name='confirmationCode'
            label={'Confirmation Code'}
            required={true}
            value={state.confirmationCode}
            onChange={(e) =>
              setState((prevState) => ({
                ...prevState,
                confirmationCode: (e as { type: 'update'; value: string }).value,
              }))
            }
          />
          <Button
            color='primary'
            type='submit'
            disabled={submitting}
            onClick={(e: any) => {
              e.preventDefault()
              onConfirmClicked()
            }}
            className={sprinkles({ width: 'size-full' })}
          >
            {submitting ?
              <Spinner />
            : 'Submit'}
          </Button>
        </>
      )}
    </>
  )
}

export default Confirm
