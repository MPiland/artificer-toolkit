import { useState, useReducer, useRef } from 'react'
import { useLoginMutation, useGoogleLoginMutation } from './authApiSlice'
import usePersist from '../../hooks/usePersist'
import { useNavigate } from 'react-router-dom'
import { useGoogleLogin } from '@react-oauth/google'
import formReducer from '../../hooks/useReducer'
import Input from '../../components/Input'

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
  const inputRefs = useRef([])

  const addToInputRefs = (ref) => {
    if (ref && !inputRefs.current.includes(ref)) {
      inputRefs.current.push(ref)
    }
  }

  const handleValidation = () => {
    let isValid
    inputRefs.current.forEach((inputRef) => {
      if (inputRef) {
        const validStatus = inputRef.getValidation()
        if (!validStatus) {
          inputRef.setClass('is-invalid')
          isValid = false
        } else {
          inputRef.setClass('is-valid')
        }
      }
    })
    return isValid
  }

  // Login function
  const onLoginClicked = async () => {
    const isValid = handleValidation()
    if (isValid !== false) {
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
        console.log(err.message)
      }
    },
    flow: 'auth-code',
  })

  const content = (
    <form className='needs-validation' noValidate>
      {isError && <p>{errMsg}</p>}
      <div className='pb-2'>
        <Input
          ref={addToInputRefs}
          validation='user'
          type='email'
          name='username'
          label={true}
          placeholder='Email Address'
          autoComplete='username'
          required={true}
          onChange={setState}
          invalidText='Username must be a valid email address.'
        />
      </div>
      <div className='pb-2'>
        <div className='input-group'>
          <Input
            ref={addToInputRefs}
            validation='pwd'
            type={state.showPassword ? 'text' : 'password'}
            name='password'
            placeholder='Password'
            label={true}
            autoComplete='password'
            required={true}
            aria-describedby='eye-addon'
            invalidText='Password must be 8-20 characters long and contain 1 uppercase, lowercase, numeric, and special character.'
            onChange={setState}
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
        onClick={(e) => {
          e.preventDefault()
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
        className='disabled w-100 py-2 mb-2 btn btn-outline-primary rounded-3'
        type='button'
      >
        <i className='bi bi-facebook'></i> Login with Facebook
      </button>
      <button
        className='disabled w-100 py-2 mb-2 btn btn-outline-primary rounded-3'
        type='button'
      >
        <i className='bi bi-twitch'></i> Login with Twitch
      </button>
    </form>
  )

  return content
}
export default Login
