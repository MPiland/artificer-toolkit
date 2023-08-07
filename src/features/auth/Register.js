import { useEffect, useState, useReducer, useRef } from 'react'
import {
  useGoogleLoginMutation,
  useRegisterMutation,
} from '../auth/authApiSlice'
import usePersist from '../../hooks/usePersist'
import { useNavigate } from 'react-router-dom'
import { useGoogleLogin } from '@react-oauth/google'
import formReducer from '../../hooks/useReducer'
import Input from '../../components/Input'

const Register = () => {
  // Register hook
  const [
    register,
    {
      isLoading: registerIsLoading,
      isError: registerIsError,
      error: registerError,
    },
  ] = useRegisterMutation()

  // Google register hook
  const [
    googleLogin,
    { isLoading: googleIsLoading, isError: googleIsError, error: googleError },
  ] = useGoogleLoginMutation()

  const navigate = useNavigate()

  const [state, setState] = useReducer(formReducer, {})
  const [persist, setPersist] = usePersist()
  const [errMsg, setErrMsg] = useState()
  const inputRefs = useRef([])

  useEffect(() => {
    if (registerIsError) {
      setErrMsg(registerError.message.data)
      setState()
    }
    if (googleIsError) {
      setErrMsg(googleError.message.data)
      setState()
    }
  }, [registerIsError, registerError, googleIsError, googleError])

  const addToInputRefs = (ref) => {
    if (ref && !inputRefs.current.includes(ref)) {
      inputRefs.current.push(ref)
    }
  }

  const handleValidation = () => {
    let isValid = true
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

  const onRegisterClicked = async () => {
    const isValid = handleValidation()
    if (isValid) {
      setState({ payload: { target: { name: 'submitting', value: true } } })
      try {
        await register({
          username: state.username,
          password: state.password,
        })
        navigate('/')
      } catch (err) {
        if (!err.status) {
          setErrMsg('No Server Response')
        } else if (err.status === 401) {
          setErrMsg('Unauthorized')
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
    <form className='needs-validation' noValidate>
      {errMsg && <p>{errMsg}</p>}
      <div className='pb-2'>
        <Input
          ref={addToInputRefs}
          validation='user'
          type='email'
          name='username'
          label={true}
          placeholder='Email Address'
          autoComplete='username'
          invalidText='Username must be a valid email address.'
          onChange={setState}
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
          onRegisterClicked()
        }}
      >
        {(!registerIsLoading || !googleIsLoading) && !state.submitting
          ? 'Submit'
          : 'Submitting'}
      </button>
      {errMsg && <div className='register-error'>{errMsg}</div>}
      <div className='text-body-secondary text-center'>
        By clicking Sign up, you agree to the terms of use.
      </div>
      <hr className='my-4' />
      <h2 className='fs-5 fw-bold mb-3 text-center'>Or use a third-party</h2>
      <button
        className='w-100 py-2 mb-2 btn btn-outline-primary rounded-3'
        type='button'
        onClick={onGoogleLoginClicked}
      >
        <i className='bi bi-google'></i> Sign up with Google
      </button>
      <button
        className='w-100 py-2 mb-2 btn btn-outline-primary rounded-3'
        type='button'
      >
        <i className='bi bi-facebook'></i> Sign up with Facebook
      </button>
      <button
        className='w-100 py-2 mb-2 btn btn-outline-primary rounded-3'
        type='button'
      >
        <i className='bi bi-twitch'></i> Sign up with Twitch
      </button>
      <div id='signUpDiv'></div>
    </form>
  )

  return content
}
export default Register
