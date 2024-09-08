import { useState, useReducer } from 'react'
import usePersist from '../../hooks/usePersist'
import { useNavigate, useParams } from 'react-router-dom'
import { useGoogleLogin } from '@react-oauth/google'
import { validate } from '../../utils/form'
import Input from '../../components/Input/Input'
import Button from '../../components/Button/Button'
import formReducer from '../../hooks/useReducer'
import { TbEye, TbEyeOff } from 'react-icons/tb'
import Spinner from '../../components/Spinner/Spinner'
import { FaTwitch, FaFacebook, FaGoogle } from 'react-icons/fa'
import Group from '../../components/Group/Group'
import { sprinkles } from '../../css/sprinkles.css'
import Modal from '../../components/Modal/Modal'
import { startCase } from 'lodash'
import { useLogin, useRegister, useGoogleFetchLogin } from './authApi'

const SignIn = () => {
  const { context } = useParams()
  const navigate = useNavigate()

  const formContext = startCase(context)

  const { isPending: isLoginPending, mutateAsync: login } = useLogin()
  const { isPending: isGooglePending, mutateAsync: googleLogin } = useGoogleFetchLogin()
  const { isPending: isRegisterPending, mutateAsync: register } = useRegister()

  const [state, setState] = useReducer(formReducer, {})
  const [showPassword, setShowPassword] = useState(false)
  const [persist, setPersist] = usePersist()
  const [errMsg, setErrMsg] = useState<string>()

  const onLoginClicked = async () => {
    const isValid = validate()
    if (isValid) {
      setState({ target: { name: 'submitting', value: true } })
      try {
        await login({ username: state.username, password: state.password })
        navigate('/')
      } catch (err: any) {
        setErrMsg(err.message)
      }
    }
  }

  const onRegisterClicked = async () => {
    const isValid = validate()
    if (isValid) {
      setState({ target: { name: 'submitting', value: true } })
      try {
        await register({ username: state.username, password: state.password })
        navigate('/')
      } catch (err: any) {
        setErrMsg(err.message)
      }
    }
  }

  const onGoogleLoginClicked = useGoogleLogin({
    onSuccess: async ({ code }) => {
      try {
        await googleLogin({ code })
        navigate('/')
      } catch (err: any) {
        setErrMsg(err.message)
      }
    },
    flow: 'auth-code',
  })

  const isPending = isGooglePending || isLoginPending || isRegisterPending

  const content = (
    <Modal>
      <Modal.Dialogue>
        <Modal.Header title={formContext} />
        <Modal.Content>
          <form>
            {errMsg && <p>{errMsg}</p>}
            <Input
              className={sprinkles({ mb: 'space-2' })}
              validation='user'
              placeholder='john.doe@email.com'
              name='username'
              type='email'
              label={'Email Address'}
              autoComplete='username'
              required={true}
              onChange={setState}
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
              autoComplete={context === 'login' ? 'current-password' : 'new-password'}
              required={true}
              value={state.password}
              onChange={setState}
              rightSection={
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
              className={sprinkles({
                mb: 'space-2',
              })}
              directionVariant='row'
              alignItemsVariant='center'
              justifyContentVariant='start'
            >
              <input
                type='checkbox'
                className='login-check-input'
                id='persist'
                onChange={() => setPersist((prev: any) => !prev)}
                checked={persist}
              />
              <label htmlFor='persist' className={sprinkles({ ms: 'space-2' })}>
                Trust This Device
              </label>
            </Group>
            <Button
              color='primary'
              type='submit'
              disabled={state?.submitting}
              onClick={(e: any) => {
                e.preventDefault()
                formContext === 'Login' ? onLoginClicked() : onRegisterClicked()
              }}
              className={sprinkles({ width: 'size-full' })}
            >
              {!isPending && !state.submitting ? 'Submit' : <Spinner />}
            </Button>
          </form>
          {errMsg && <div className='register-errorMsg'>{errMsg}</div>}
          <div className={sprinkles({ ta: 'center' })}>By clicking Submit, you agree to the terms of use.</div>
        </Modal.Content>
        <Modal.Footer>
          <h2 className={sprinkles({ pb: 'space-3' })}>Or use a third-party</h2>
          <Group directionVariant='column'>
            <Button
              color='primary'
              type='button'
              disabled={true}
              onClick={onGoogleLoginClicked}
              className={sprinkles({ width: 'size-full' })}
            >
              <FaGoogle />
              <span className={sprinkles({ ms: 'space-1' })}>{formContext} with Google</span>
            </Button>
            <Button color='primary' type='button' disabled={true} className={sprinkles({ width: 'size-full' })}>
              <FaFacebook />
              <span className={sprinkles({ ms: 'space-1' })}>{formContext} with Facebook</span>
            </Button>
            <Button color='primary' type='button' disabled={true} className={sprinkles({ width: 'size-full' })}>
              <FaTwitch />
              <span className={sprinkles({ ms: 'space-1' })}>{formContext} with Twitch</span>
            </Button>
          </Group>
        </Modal.Footer>
      </Modal.Dialogue>
    </Modal>
  )

  return content
}
export default SignIn
