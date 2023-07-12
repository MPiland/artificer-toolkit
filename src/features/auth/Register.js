import { useEffect, useState } from 'react'
import {
  useGoogleLoginMutation,
  useRegisterMutation,
} from '../auth/authApiSlice'
import usePersist from '../../hooks/usePersist'
import { useNavigate } from 'react-router-dom'
import { useGoogleLogin } from '@react-oauth/google'
import { Tooltip } from 'react-tooltip'

const PWD_REGEX =
  /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,15}$/
const USER_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const Register = () => {
  // Register hook
  const [registerUser, { isLoading, isError, error }] = useRegisterMutation()

  // Google register hook
  const [
    googleLogin,
    { isLoading: isGoogleLoading, isError: isGoogleError, error: googleError },
  ] = useGoogleLoginMutation()

  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [validUsername, setValidUsername] = useState(null)
  const [validPassword, setValidPassword] = useState(null)
  const [validPwdClass, setValidPwdClass] = useState('')
  const [validUserClass, setValidUserClass] = useState('')
  const [submittingState, setSubmittingState] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [persist, setPersist] = usePersist(false)

  useEffect(() => {
    setValidUsername(USER_REGEX.test(username))
  }, [username, validUsername])

  useEffect(() => {
    setValidPassword(PWD_REGEX.test(password))
  }, [password, validPassword])

  useEffect(() => {
    if (isError || isGoogleError) {
      setUsername('')
      setPassword('')
      setValidPwdClass('')
      setValidUserClass('')
    }
    if (isLoading || isGoogleLoading) {
      setSubmittingState(true)
    }
  }, [isError, isGoogleError, isLoading, isGoogleLoading, navigate])

  const onUsernameChange = (e) => setUsername(e.target.value)
  const onPasswordChange = (e) => setPassword(e.target.value)
  const onShowPassword = () => setShowPassword(!showPassword)
  const handleToggle = () => setPersist((prev) => !prev)

  const onRegisterUserClicked = async (e) => {
    if (validPassword && validUsername) {
      e.preventDefault()
      try {
        await registerUser({ username, password })
        setUsername('')
        setPassword('')
        setSubmittingState(false)
        navigate('/')
      } catch (err) {
        console.log(err.message)
      }
    } else {
      if (!validPassword) {
        setValidPwdClass('is-invalid')
      } else {
        setValidPwdClass('is-valid')
      }
      if (!validUsername) {
        setValidUserClass('is-invalid')
      } else {
        setValidUserClass('is-valid')
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
    <form>
      <div className={`form-floating mb-3 ${validUserClass}`}>
        <input
          type='email'
          className={`form-control ${validUserClass}`}
          id='email'
          placeholder='name@example.com'
          onChange={onUsernameChange}
          autoComplete='username'
          aria-describedby='floatingInputFeedback'
        />
        <label htmlFor='email'>Email address</label>
        <div id='emailFeedback' className='invalid-feedback'>
          Username must be a valid email address.
        </div>
      </div>

      <div className='input-group mb-3 has-validation'>
        <div className='form-floating'>
          <input
            type={showPassword ? 'text' : 'password'}
            className={`form-control ${validPwdClass}`}
            id='password'
            placeholder='Password'
            autoComplete='new-password'
            onChange={onPasswordChange}
            aria-describedby='eye-addon'
            data-tooltip-id='passwordTooltip'
            data-tooltip-place='top'
            data-tooltip-html='<p>Password must contain 1 uppercase,<br />lowercase, numeric, and special character</p>'
          />
          <Tooltip id='passwordTooltip' />
          <label htmlFor='password'>Password</label>
          <div id='passwordFeedback' className='invalid-feedback'>
            Password must contain 1 uppercase, lowercase, numeric, and special
            character
          </div>
        </div>
        <span
          className='input-group-text bi bi-eye>'
          id='eye-addon'
          onClick={onShowPassword}
        >
          <i className={showPassword ? 'bi bi-eye-slash' : 'bi bi-eye'}></i>
        </span>
        <div id='passwordFeedback' className='invalid-feedback'>
          Password must contain 1 uppercase, lowercase, numeric, and special
          character
        </div>
      </div>
      <div className='pb-2'>
        <input
          type='checkbox'
          className='form__checkbox'
          id='persist'
          onChange={handleToggle}
          checked={persist}
        />
        <label htmlFor='persist' className='ps-2'>
          Trust This Device
        </label>
      </div>

      <button
        className='w-100 mb-2 btn btn-lg rounded-3 btn-primary'
        type='submit'
        disabled={submittingState}
        onClick={onRegisterUserClicked}
      >
        {!isLoading && !submittingState ? 'Sign up' : 'Submitting'}
      </button>
      {isError && <div className='register-error'>{error?.data?.message}</div>}
      {isGoogleError && (
        <div className='register-error'>{googleError?.data?.message}</div>
      )}

      <div className='text-body-secondary text-center'>
        By clicking Sign up, you agree to the terms of use.
      </div>
      <hr className='my-4' />
      <h2 className='fs-5 fw-bold mb-3 text-center'>Or use a third-party</h2>
      <button
        className='w-100 py-2 mb-2 btn btn-outline-primary rounded-3'
        type='submit'
        onClick={(e) => {
          e.preventDefault()
          onGoogleLoginClicked()
        }}
      >
        <i className='bi bi-google'></i> Sign up with Google
      </button>
      <button
        className='w-100 py-2 mb-2 btn btn-outline-primary rounded-3'
        type='submit'
      >
        <i className='bi bi-facebook'></i> Sign up with Facebook
      </button>
      <button
        className='w-100 py-2 mb-2 btn btn-outline-primary rounded-3'
        type='submit'
      >
        <i className='bi bi-twitch'></i> Sign up with Twitch
      </button>
      <div id='signUpDiv'></div>
    </form>
  )

  return content
}
export default Register
