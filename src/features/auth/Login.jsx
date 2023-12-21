import { useState, useReducer, useEffect } from 'react'
import { useLoginMutation, useGoogleLoginMutation } from './authApiSlice'
import usePersist from '../../hooks/usePersist'
import { useNavigate, useLocation, useOutletContext } from 'react-router-dom'
import { useGoogleLogin } from '@react-oauth/google'
import { handleValidation } from '../../helpers/form'
import formReducer from '../../hooks/useReducer'

const Login = () => {
  const [
    login,
    { isLoading: loginIsLoading, isError: loadingIsError, error: loginError },
  ] = useLoginMutation()
  const [
    googleLogin,
    { isLoading: googleIsLoading, isError: googleIsError, error: googleError },
  ] = useGoogleLoginMutation()

  const navigate = useNavigate()
  const location = useLocation()
  const { handleClose } = useOutletContext()

  const [state, setState] = useReducer(formReducer, {})
  const [persist, setPersist] = usePersist()
  const [errMsg, setErrMsg] = useState()

  useEffect(() => {
    if (loadingIsError) {
      setErrMsg(loginError.message)
      setState()
    }
    if (googleIsError) {
      setErrMsg(googleError.message)
      setState()
    }
  }, [loadingIsError, loginError, googleIsError, googleError])

  const onLoginClicked = async () => {
    const isValid = handleValidation()
    if (isValid) {
      setState({ payload: { target: { name: 'submitting', value: true } } })
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
    }
  }

  const onGoogleLoginClicked = useGoogleLogin({
    onSuccess: async ({ code }) => {
      try {
        await googleLogin({ code })
        navigate('/')
      } catch (err) {
        setErrMsg(err.message)
      }
    },
    flow: 'auth-code',
  })

  const content = (
    <>
      <div className='modal-header'>
        <h1 className='fw-bold mb-0 fs-2 ms-auto'>{location.state.title}</h1>
        <button
          type='button'
          className='btn-close'
          aria-label='Close'
          onClick={handleClose}
        ></button>
      </div>
      <div className='modal-body'>
        <form>
          {errMsg && <p>{errMsg}</p>}
          <div className='pb-2'>
            <div className='position-relative'>
              <label className='form-input-label required' htmlFor='password'>
                Email Address
              </label>
              <input
                className='form-control'
                validation='user'
                type='email'
                name='username'
                label={true}
                autoComplete='username'
                required={true}
                onChange={(e) =>
                  setState({
                    payload: {
                      target: { name: 'username', value: e.target.value },
                    },
                  })
                }
                value={state.username}
                invalidText='Username must be a valid email address.'
              />
            </div>
            <div id='passwordTooltip' className='invalid-tooltip'>
              Password must be 8-20 characters long and contain 1 uppercase,
              lowercase, numeric, and special character.
            </div>
          </div>
          <div className='pb-2'>
            <div className='position-relative'>
              <label className='form-input-label required' htmlFor='password'>
                Password
              </label>
              <div className='input-group'>
                <input
                  validation='pwd'
                  className='form-control'
                  type={state.showPassword ? 'text' : 'password'}
                  name='password'
                  autoComplete='password'
                  required={true}
                  value={state.password}
                  aria-describedby='eye-addon'
                  onChange={(e) =>
                    setState({
                      payload: {
                        target: { name: 'password', value: e.target.value },
                      },
                    })
                  }
                />
                <span
                  className='input-group-text bi bi-eye>'
                  id='eye-addon'
                  onClick={() =>
                    setState({
                      payload: {
                        target: {
                          name: 'showPassword',
                          value: !state.showPassword,
                        },
                      },
                    })
                  }
                >
                  <i
                    className={
                      state.showPassword ? 'bi bi-eye-slash' : 'bi bi-eye'
                    }
                  ></i>
                </span>
              </div>
              <div id='passwordTooltip' className='invalid-tooltip'>
                Password must be 8-20 characters long and contain 1 uppercase,
                lowercase, numeric, and special character.
              </div>
            </div>
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
            className='login w-100 mb-2 btn btn-lg rounded-3 btn-primary'
            type='button'
            disabled={state?.submitting}
            onClick={(e) => {
              e.preventDefault()
              onLoginClicked()
            }}
          >
            {(!loginIsLoading || !googleIsLoading) && !state.submitting ? (
              'Submit'
            ) : (
              <div className='spinner-border text-primary' role='status'>
                <span className='visually-hidden'>Loading...</span>
              </div>
            )}
          </button>
          {errMsg && <div className='register-error'>{errMsg}</div>}
          <div className='text-body-secondary text-center'>
            By clicking Submit, you agree to the terms of use.
          </div>
          <hr className='my-4' />
          <h2 className='fs-5 fw-bold mb-3 text-center'>
            Or use a third-party
          </h2>
          <button
            className='login disabled w-100 py-2 mb-2 btn-lg btn-outline-primary rounded-3'
            type='button'
            onClick={onGoogleLoginClicked}
          >
            <i className='bi bi-google'></i> Login with Google
          </button>
          <button
            className='login disabled w-100 py-2 mb-2 btn-lg btn-outline-primary rounded-3'
            type='button'
          >
            <i className='bi bi-facebook'></i> Login with Facebook
          </button>
          <button
            className='login disabled w-100 py-2 mb-2 btn-lg btn-outline-primary rounded-3'
            type='button'
          >
            <i className='bi bi-twitch'></i> Login with Twitch
          </button>
        </form>
      </div>
    </>
  )

  return content
}
export default Login
