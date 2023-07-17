import { useEffect, useState, useReducer } from 'react'
import { useLoginMutation, useGoogleLoginMutation } from './authApiSlice'
import usePersist from '../../hooks/usePersist'
import { useNavigate } from 'react-router-dom'
import { useGoogleLogin } from '@react-oauth/google'
import formReducer from '../../hooks/useReducer'
import Input from '../../components/Input'

const PWD_REGEX =
  /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,20}$/
const USER_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const Login = () => {
  // Login hook
  const [login, { isLoading, isError, error }] = useLoginMutation()
  const [
    googleLogin,
    { isLoading: isGoogleLoading, isError: isGoogleError, error: googleError },
  ] = useGoogleLoginMutation()

  const navigate = useNavigate()

  const [state, setState] = useReducer(formReducer, {})
  const [persist, setPersist] = usePersist()
  const [errMsg, setErrMsg] = useState('')

  useEffect(() => {
    setState({
      payload: {
        target: {
          name: 'validUsername',
          value: USER_REGEX.test(state.username),
        },
      },
    })
  }, [state.username])

  useEffect(() => {
    setState({
      payload: {
        target: {
          name: 'validPassword',
          value: PWD_REGEX.test(state.password),
        },
      },
    })
  }, [state.password])

  // Login function
  const onLoginClicked = async () => {
    if (state.validUsername === true && state.validPassword === true) {
      try {
        await login({ username: state.username, password: state.password })
        navigate('/')
      } catch (err) {
        if (!err.status) {
          setErrMsg('No Server Response')
        } else {
          setErrMsg(err.message)
        }
      }
    } else {
      if (!state.validUsername) {
        setState({
          payload: { target: { name: 'validUClass', value: 'is-invalid' } },
        })
      } else {
        setState({
          payload: { target: { name: 'validUClass', value: 'is-valid' } },
        })
      }
      if (!state.validPassword) {
        setState({
          payload: { target: { name: 'validPClass', value: 'is-invalid' } },
        })
      } else {
        setState({
          payload: { target: { name: 'validPClass', value: 'is-valid' } },
        })
      }
    }
  }

  const onGoogleLoginClicked = useGoogleLogin({
    onSuccess: async ({ code }) => {
      try {
        await googleLogin({ code })
        navigate('/')
      } catch (err) {
        console.log(err.message)
      }
    },
    flow: 'auth-code',
  })

  const content = (
    <form className='needs-validation' noValidate>
      {isError && <p>{errMsg}</p>}
      <Input
        type='email'
        className={`${state?.validUClass} mb-3`}
        name='username'
        label={true}
        placeholder='Email Address'
        autoComplete='username'
        onChange={setState}
        invalidText='Username must be a valid email address.'
      />
      <div className='input-group mb-3'>
        <Input
          type={state.showPassword ? 'text' : 'password'}
          className={`${state?.validPClass}`}
          name='password'
          placeholder='Password'
          label={true}
          autoComplete='password'
          onChange={setState}
          aria-describedby='eye-addon'
          invalidText='Password must be 8-20 characters long and contain 1 uppercase, lowercase, numeric, and special character.'
        />
        <span
          className='input-group-text bi bi-eye>'
          id='eye-addon'
          onClick={() =>
            setState({
              payload: {
                target: { name: 'showPassword', value: !state.showPassword },
              },
            })
          }
        >
          <i
            className={state.showPassword ? 'bi bi-eye-slash' : 'bi bi-eye'}
          ></i>
        </span>
      </div>
      <div className='pb-2'>
        <input
          type='checkbox'
          className='form-check-input'
          id='persist'
          onChange={() => setPersist((prev) => !prev)}
          checked={persist}
        />
        <label htmlFor='persist' className='ps-2'>
          Trust This Device
        </label>
      </div>
      <button
        className='w-100 mb-2 btn btn-lg rounded-3 btn-primary'
        type='button'
        disabled={state?.submitting}
        onClick={() => {
          setState({ payload: { target: { name: 'submitting', value: true } } })
          onLoginClicked()
        }}
      >
        {(!isLoading || !isGoogleLoading) && !state.submitting
          ? 'Submit'
          : 'Submitting'}
      </button>
      {isError && <div className='register-error'>{error?.data?.message}</div>}
      {isGoogleError && (
        <div className='register-error'>{googleError?.data?.message}</div>
      )}
      <div className='text-body-secondary text-center'>
        By clicking Submit, you agree to the terms of use.
      </div>
      <hr className='my-4' />
      <h2 className='fs-5 fw-bold mb-3 text-center'>Or use a third-party</h2>
      <button
        className='w-100 py-2 mb-2 btn btn-outline-primary rounded-3'
        type='button'
        onClick={onGoogleLoginClicked}
      >
        <i className='bi bi-google'></i> Login with Google
      </button>
      <button
        className='w-100 py-2 mb-2 btn btn-outline-primary rounded-3'
        type='button'
      >
        <i className='bi bi-facebook'></i> Login with Facebook
      </button>
      <button
        className='w-100 py-2 mb-2 btn btn-outline-primary rounded-3'
        type='button'
      >
        <i className='bi bi-twitch'></i> Login with Twitch
      </button>
    </form>
  )

  return content
}
export default Login
