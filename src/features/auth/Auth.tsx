import { useState, useRef, useEffect } from 'react'
import { validate } from '../../utils/form'
import Input from '../../components/Input/Input'
import Button from '../../components/Button/Button'
import { TbEye, TbEyeOff } from 'react-icons/tb'
import { sprinkles } from '../../css/sprinkles.css'
import Modal from '../../components/Modal/Modal'
import { useSignUp, useSignIn } from './authApi'
import { useLocation, useNavigate } from 'react-router-dom'
import Group from '../../components/Group/Group'
import Spinner from '../../components/Spinner/Spinner'

const Auth = () => {
  const location = useLocation()
  const navigate = useNavigate()

  const { mutateAsync: signUp } = useSignUp()
  const { mutateAsync: signIn } = useSignIn()

  const [state, setState] = useState<{ password: string; username: string; submitting: boolean }>({
    password: '',
    username: '',
    submitting: false,
  })
  const [showPassword, setShowPassword] = useState<boolean>(false)
  const [persist, setPersist] = useState<boolean>(false)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [errorMsg, setErrMsg] = useState<string | null>(null)
  const [isSignIn, setIsSignIn] = useState<boolean>(null)

  const contentRef = useRef(null)

  useEffect(() => {
    if (isSignIn === null) {
      setIsSignIn(location.pathname === '/sign-in')
    }
  }, [location.pathname, isSignIn])

  const auth = isSignIn ? signIn : signUp

  const onSubmit = async () => {
    const isValid = validate()
    if (isValid) {
      setSubmitting(true)
      setState((prevState) => ({ ...prevState, submitting: true }))
      try {
        const result = await auth({
          username: state.username,
          password: state.password,
          persist: persist,
        })
        if (result === 'CONFIRM_SIGN_UP') {
          setSubmitting(false)
          return navigate(isSignIn ? '/sign-in/confirm-sign-up' : '/sign-up/confirm-sign-up', {
            state: {
              username: state.username,
            },
          })
        }
        if (result === 'USERNAME_EXISTS') {
          setSubmitting(false)
          return setErrMsg('Username already exists. Please sign in.')
        }
        if (result === 'NOT_AUTHORIZED') {
          setSubmitting(false)
          return setErrMsg('Incorrect username or password.')
        }
        if (result === 'SIGNED_IN') {
          setSubmitting(false)
          return navigate('/', {
            state: { authenticated: true },
            replace: true,
          })
        }
        return setSubmitting(false)
      } catch (err: any) {
        setSubmitting(false)
        console.error(err)
        setErrMsg(err.message)
      }
    }
  }

  return (
    <>
      <Modal>
        <Modal.Dialogue ref={contentRef} size='xs'>
          <Modal.Header title={isSignIn ? 'Sign In' : 'Sign Up'} />
          <Modal.Content>
            {errorMsg && <p>{errorMsg}</p>}
            <Input
              className={sprinkles({ mb: 'space-4' })}
              validation='user'
              placeholder='john.doe@email.com'
              name='username'
              type='email'
              label={'Email Address'}
              autoComplete='username'
              required={true}
              onChange={(e) =>
                setState((prevState) => ({ ...prevState, username: (e as { type: 'update'; value: string }).value }))
              }
              value={state.username}
              errorMsg='Username must be a valid email address.'
            />
            <Input
              className={sprinkles({ mb: 'space-2' })}
              validation='pwd'
              placeholder='Enter password...'
              type={showPassword ? 'text' : 'password'}
              name='password'
              label={'Password'}
              autoComplete={isSignIn ? 'current-password' : 'new-password'}
              required={true}
              value={state.password}
              onChange={(e) =>
                setState((prevState) => ({ ...prevState, password: (e as { type: 'update'; value: string }).value }))
              }
              endAdornment={
                <span
                  onClick={(e: any) => {
                    e.stopPropagation()
                    setShowPassword((prev) => !prev)
                  }}
                >
                  {showPassword ? <TbEyeOff /> : <TbEye />}
                </span>
              }
            />
            <Group
              className={sprinkles({ mb: 'space-2' })}
              directionVariant='row'
              alignItemsVariant='center'
              justifyContentVariant='start'
            >
              <input
                type='checkbox'
                id='persist'
                name='persist'
                onChange={() => setPersist(!persist)}
                checked={persist}
              />
              <label htmlFor='persist' className={sprinkles({ ms: 'space-2' })}>
                Trust This Device
              </label>
            </Group>
            <Button
              color='primary'
              type='submit'
              disabled={submitting}
              onClick={(e: any) => {
                e.preventDefault()
                onSubmit()
              }}
              className={sprinkles({ width: 'size-full' })}
            >
              {submitting ? <Spinner /> : 'Submit'}
            </Button>
            <div className={sprinkles({ mt: 'space-2', ta: 'center', fontSize: 'font-size-00' })}>
              By clicking Submit, you agree to the terms of use.
            </div>
            <p
              onClick={() => setIsSignIn(!isSignIn)}
              className={sprinkles({ ta: 'center', mt: 'space-4', mb: 'space-x', fontWeight: 'font-weight-7' })}
            >
              {isSignIn ? 'Sign Up' : 'Sign In'}
            </p>
          </Modal.Content>
        </Modal.Dialogue>
      </Modal>
    </>
  )
}
export default Auth
