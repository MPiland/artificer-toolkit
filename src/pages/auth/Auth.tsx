import { useState, useRef, useEffect } from 'react'
import { validateForm } from '@/components/Form'
import Input from '@/components/Input/Input'
import Button from '@/components/Button/Button'
import { TbEye, TbEyeOff } from 'react-icons/tb'
import { sprinkles } from '@/css/sprinkles.css'
import { useSignUp, useSignIn, useResetPassword } from '@/apis/authApi'
import Group from '@/components/Group/Group'
import Spinner from '@/components/Spinner/Spinner'
import { auth_container, auth_link, error_message } from './Auth.css'
import { Link, useNavigate } from '@tanstack/react-router'
import { Route } from '@/routes/$auth'

const Auth = () => {
  const { auth } = Route.useParams()
  const navigate = useNavigate()

  const isSignIn = auth === 'sign-in'

  const { mutateAsync: signUp } = useSignUp()
  const { mutateAsync: signIn } = useSignIn()
  const { mutateAsync: resetPassword } = useResetPassword()

  const [state, setState] = useState<{ password: string; username: string; submitting: boolean }>({
    password: '',
    username: '',
    submitting: false,
  })
  const [showPassword, setShowPassword] = useState<boolean>(false)
  const [persist, setPersist] = useState<boolean>(false)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [errorMsg, setErrMsg] = useState<string | null>(null)
  const [errorSource, setErrorSource] = useState<'observer' | 'reset' | null>(null)

  const usernameRef = useRef<HTMLInputElement>(null!)
  const passwordRef = useRef<HTMLInputElement>(null!)

  useEffect(() => {
    const observer = new MutationObserver((mutations: MutationRecord[]) => {
      mutations.forEach((mutation: MutationRecord) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          const hasInvalidInput = [usernameRef.current?.parentElement, passwordRef.current?.parentElement].some((ref) =>
            ref?.classList.contains('invalid')
          )
          if (hasInvalidInput && isSignIn && errorSource !== 'reset') {
            setErrorSource('observer')
            setErrMsg('Invalid username or password.')
          }
        }
      })
    })

    const refs = [usernameRef.current?.parentElement, passwordRef.current?.parentElement].filter(Boolean)
    refs.forEach((ref) => {
      if (ref) {
        observer.observe(ref, {
          attributes: true,
          attributeFilter: ['class'],
        })
      }
    })

    return () => observer.disconnect()
  }, [isSignIn, errorMsg, errorSource])

  const handleResetPassword = async () => {
    const usernameInput = usernameRef.current

    const test = usernameInput?.value.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)

    if (!test) {
      setErrorSource('reset')
      setErrMsg('Please enter a valid username.')
      const event = new CustomEvent('setErrorState', {
        detail: !usernameInput?.value.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
      })
      return usernameInput?.dispatchEvent(event)
    }

    const result = await resetPassword(state.username)
    if (result !== 'DONE') {
      return navigate({
        to: '/$auth/$action',
        params: { auth: 'sign-in', action: 'reset-password' },
        state: { username: state.username },
      })
    }
  }

  const authFn = isSignIn ? signIn : signUp

  const onSubmit = async () => {
    const isValid = validateForm()
    if (isValid) {
      setSubmitting(true)
      setState((prevState) => ({ ...prevState, submitting: true }))
      try {
        const result = await authFn({
          username: state.username,
          password: state.password,
          persist: persist,
        })
        setSubmitting(false)
        if (result === 'CONFIRM_SIGN_UP') {
          return navigate({
            to: '/$auth/$action',
            params: { auth: isSignIn ? 'sign-in' : 'sign-up', action: 'confirm-sign-up' },
            state: { username: state.username },
          })
        }
        if (result === 'USERNAME_EXISTS') {
          return setErrMsg('Username already exists. Please sign in.')
        }
        if (result === 'NOT_AUTHORIZED') {
          return setErrMsg('Incorrect username or password.')
        }
        if (result === 'SIGNED_IN') {
          return navigate({ to: '/home', replace: true })
        }
        return
      } catch (err: any) {
        setSubmitting(false)
        console.error(err)
        setErrMsg(err.message)
      }
    }
  }

  return (
    <div className={auth_container}>
      {errorMsg && <p className={error_message}>{errorMsg}</p>}
      <Input<{ username: string }>
        className={sprinkles({ mb: 'space-4' })}
        validation='user'
        placeholder='john.doe@email.com'
        name='username'
        type='email'
        label={'Email Address'}
        autoComplete='username'
        required={true}
        onChange={{
          updateField: ({ value }) => {
            return setState((prevState) => ({ ...prevState, username: value }))
          },
        }}
        value={state.username}
        errorMsg={!isSignIn ? 'Username must be a valid email address (example@domain.com).' : undefined}
        ref={usernameRef}
      />
      <Input<{ password: string }>
        className={sprinkles({ mb: 'space-2' })}
        validation='pwd'
        placeholder='Enter password...'
        type={showPassword ? 'text' : 'password'}
        name='password'
        label={'Password'}
        autoComplete={isSignIn ? 'current-password' : 'new-password'}
        required={true}
        value={state.password}
        onChange={{
          updateField: ({ value }) => {
            return setState((prevState) => ({ ...prevState, password: value }))
          },
        }}
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
          !isSignIn ?
            'Password must be between 8 and 15 characters and include at least one uppercase letter, one lowercase letter, one symbol, and one number.'
          : undefined
        }
        ref={passwordRef}
      />
      <Group
        className={sprinkles({ mb: 'space-2' })}
        directionVariant='row'
        alignItemsVariant='center'
        justifyContentVariant='start'
      >
        <input type='checkbox' id='persist' name='persist' onChange={() => setPersist(!persist)} checked={persist} />
        <label htmlFor='persist' className={sprinkles({ ms: 'space-2' })}>
          Trust This Device
        </label>
      </Group>
      <Button
        color='primary'
        type='submit'
        width='size-auto'
        disabled={submitting}
        onClick={(e: any) => {
          e.preventDefault()
          onSubmit()
        }}
      >
        {submitting ?
          <Spinner />
        : 'Submit'}
      </Button>
      <div className={sprinkles({ mt: 'space-2', ta: 'center', fontSize: 'font-size-00' })}>
        By clicking Submit, you agree to the terms of use.
      </div>
      <Link to='/$auth' params={{ auth: isSignIn ? 'sign-up' : 'sign-in' }} className={auth_link}>
        {isSignIn ? 'Sign Up' : 'Sign In'}
      </Link>
      {isSignIn && (
        <p
          onClick={handleResetPassword}
          className={sprinkles({ ta: 'center', mt: 'space-4', mb: 'space-x', fontWeight: 'font-weight-7' })}
          style={{ cursor: 'pointer' }}
        >
          Reset Password
        </p>
      )}
    </div>
  )
}

export default Auth
