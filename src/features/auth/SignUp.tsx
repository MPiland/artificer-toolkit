import { useState, useReducer, useRef } from 'react'
import { validate } from '../../utils/form'
import Input from '../../components/Input/Input'
import Button from '../../components/Button/Button'
import formReducer from '../../hooks/useReducer'
import { TbEye, TbEyeOff } from 'react-icons/tb'
import { sprinkles } from '../../css/sprinkles.css'
import Modal from '../../components/Modal/Modal'
import { useConfirmSignUp, useSignUp } from './authApi'
import Slide from '@mui/material/Slide'
import { useNavigate } from 'react-router-dom'
import Group from '../../components/Group/Group'
import Spinner from '../../components/Spinner/Spinner'

const SignUp = () => {
  const { mutateAsync: signUp } = useSignUp()
  const { mutateAsync: confirmSignUp } = useConfirmSignUp()

  const navigate = useNavigate()

  const [state, setState] = useReducer(formReducer, {})
  const [confirm, setConfirm] = useState<boolean>(false)
  const [showPassword, setShowPassword] = useState<boolean>(false)
  const [persist, setPersist] = useState<boolean>(false)
  const [submitting, setSubmitting] = useState<boolean>(false)

  const contentRef = useRef(null)

  const onSubmitClicked = async () => {
    const isValid = validate()
    if (isValid) {
      setSubmitting(true)
      setState({ target: { name: 'submitting', value: true } })
      try {
        const { nextStep } = await signUp({
          username: state.username,
          password: state.password,
          persist: persist,
        })
        if (nextStep.signUpStep === 'CONFIRM_SIGN_UP') {
          setSubmitting(false)
          return setConfirm(true)
        }
      } catch (err: any) {
        setSubmitting(false)
        console.error(err.message)
      }
    }
  }

  const onConfirmClicked = async () => {
    setSubmitting(true)
    try {
      const isSignedIn = await confirmSignUp({
        username: state.username,
        confirmationCode: state.confirmationCode,
      })

      if (isSignedIn) {
        setSubmitting(false)
        return navigate('/')
      }
    } catch (err: any) {
      setSubmitting(false)
      console.error(err.message)
    }
  }

  return (
    <Modal>
      <Modal.Dialogue ref={contentRef} size='xs'>
        <Modal.Header title='Sign Up' />
        {!confirm && (
          <Slide in={!confirm} direction='left' container={contentRef.current} appear={false}>
            <Modal.Content>
              <Input
                className={sprinkles({ mb: 'space-4' })}
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
                className={sprinkles({ mb: 'space-4' })}
                validation='pwd'
                placeholder='Enter password...'
                type={showPassword ? 'text' : 'password'}
                name='password'
                label={'Password'}
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
                  onSubmitClicked()
                }}
                className={sprinkles({ width: 'size-full' })}
              >
                {submitting ? <Spinner /> : 'Submit'}
              </Button>
            </Modal.Content>
          </Slide>
        )}
        {confirm && (
          <Slide in={confirm} direction='left' container={contentRef.current}>
            <Modal.Content>
              <Input
                className={sprinkles({ mb: 'space-2' })}
                placeholder='Confirmation code...'
                name='confirmationCode'
                label={'Confirmation Code'}
                required={true}
                value={state.confirmationCode}
                onChange={setState}
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
                {submitting ? <Spinner /> : 'Submit'}
              </Button>
            </Modal.Content>
          </Slide>
        )}
      </Modal.Dialogue>
    </Modal>
  )
}
export default SignUp
