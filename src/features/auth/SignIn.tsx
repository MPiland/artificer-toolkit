import { useState, useReducer } from 'react'
import {
  useLoginMutation,
  useGoogleLoginMutation,
  useRegisterMutation,
} from './authApiSlice'
import usePersist from '../../hooks/usePersist'
import { useNavigate, useParams } from 'react-router-dom'
import { useGoogleLogin } from '@react-oauth/google'
import { handleValidation } from '../../utils/form'
import Input from '../../components/Input/Input'
import Button from '../../components/Button/Button'
import formReducer from '../../hooks/useReducer'
import { TbEye, TbEyeOff } from 'react-icons/tb'
import Spinner from '../../components/Spinner/Spinner'
import { FaTwitch, FaFacebook, FaGoogle } from 'react-icons/fa'
import Group from '../../components/Group/Group'
import { submit_button } from '../../css/Form.css'
import { sprinkles } from '../../css/sprinkles.css'
import Modal from '../../components/Modal/Modal'
import { startCase } from 'lodash'

const SignIn = () => {
  const { context } = useParams()
  const navigate = useNavigate()

  const formContext = startCase(context)

  const [login, { isLoading: loginIsLoading }] = useLoginMutation()
  const [register, { isLoading: registerIsLoading }] = useRegisterMutation()

  const [googleLogin, { isLoading: googleIsLoading }] = useGoogleLoginMutation()

  const [state, setState] = useReducer(formReducer, {})
  const [showPassword, setShowPassword] = useState(false)
  const [persist, setPersist] = usePersist()
  const [errMsg, setErrMsg] = useState<string>()

  const onLoginClicked = async () => {
    const isValid = handleValidation()
    if (isValid) {
      setState({ target: { name: 'submitting', value: true } })
      try {
        await login({ username: state.username, password: state.password })
        navigate('/')
      } catch (err: any) {
        if ('message' in err) {
          setErrMsg(err.message)
        } else if ('status' in err) {
          setErrMsg(err.status)
        } else {
          setErrMsg('No Server Response')
        }
      }
    }
  }

  const onRegisterClicked = async () => {
    const isValid = handleValidation()
    if (isValid) {
      setState({ target: { name: 'submitting', value: true } })
      try {
        await register({
          username: state.username,
          password: state.password,
        })
        navigate('/')
      } catch (err: any) {
        if ('message' in err) {
          setErrMsg(err.message)
        } else if ('status' in err) {
          setErrMsg(err.status)
        } else {
          setErrMsg('No Server Response')
        }
      }
    }
  }

  const onGoogleLoginClicked = useGoogleLogin({
    onSuccess: async ({ code }) => {
      try {
        await googleLogin({ code })
        navigate('/')
      } catch (err: any) {
        if ('message' in err) {
          setErrMsg(err.message)
        } else if ('status' in err) {
          setErrMsg(err.status)
        }
      }
    },
    flow: 'auth-code',
  })

  const content = (
    <>
      <Modal.Header title={formContext} />
      <Modal.Body>
        <form>
          {errMsg && <p>{errMsg}</p>}
          <Input
            className={sprinkles({ mb: 'size-2' })}
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
            className={sprinkles({ mb: 'size-2' })}
            validation='pwd'
            placeholder='Enter password...'
            type={showPassword ? 'text' : 'password'}
            name='password'
            label={'Password'}
            autoComplete={
              context === 'login' ? 'current-password' : 'new-password'
            }
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
          <div
            className={sprinkles({
              mb: 'size-2',
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
            })}
          >
            <input
              type='checkbox'
              className='login-check-input'
              id='persist'
              onChange={() => setPersist((prev: any) => !prev)}
              checked={persist}
            />
            <label htmlFor='persist' className={sprinkles({ ms: 'size-2' })}>
              Trust This Device
            </label>
          </div>
          <Button
            variant='primary'
            type='submit'
            className={submit_button}
            disabled={state?.submitting}
            onClick={(e: any) => {
              e.preventDefault()
              formContext === 'Login' ? onLoginClicked() : onRegisterClicked()
            }}
          >
            {!loginIsLoading &&
            !googleIsLoading &&
            !registerIsLoading &&
            !state.submitting ? (
              'Submit'
            ) : (
              <Spinner />
            )}
          </Button>
        </form>
        {errMsg && <div className='register-errorMsg'>{errMsg}</div>}
        <div className={sprinkles({ ta: 'center' })}>
          By clicking Submit, you agree to the terms of use.
        </div>
      </Modal.Body>
      <Modal.Footer>
        <h2 className={sprinkles({ pb: 'size-3' })}>Or use a third-party</h2>
        <Group directionVariant='column'>
          <Button
            variant='primary'
            type='button'
            className={submit_button}
            disabled={true}
            onClick={onGoogleLoginClicked}
          >
            <FaGoogle />
            <span className={sprinkles({ ms: 'size-1' })}>
              {formContext} with Google
            </span>
          </Button>
          <Button
            variant='primary'
            type='button'
            className={submit_button}
            disabled={true}
          >
            <FaFacebook />
            <span className={sprinkles({ ms: 'size-1' })}>
              {formContext} with Facebook
            </span>
          </Button>
          <Button
            variant='primary'
            type='button'
            className={submit_button}
            disabled={true}
          >
            <FaTwitch />
            <span className={sprinkles({ ms: 'size-1' })}>
              {formContext} with Twitch
            </span>
          </Button>
        </Group>
      </Modal.Footer>
    </>
  )

  return content
}
export default SignIn
