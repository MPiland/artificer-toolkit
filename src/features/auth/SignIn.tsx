import { useState, useReducer } from 'react'
import { useNavigate } from 'react-router-dom'
import { validate } from '../../utils/form'
import Input from '../../components/Input/Input'
import Button from '../../components/Button/Button'
import formReducer from '../../hooks/useReducer'
import { TbEye, TbEyeOff } from 'react-icons/tb'
import { sprinkles } from '../../css/sprinkles.css'
import Modal from '../../components/Modal/Modal'
import { useSignIn } from './authApi'
import Group from '../../components/Group/Group'
import Spinner from '../../components/Spinner/Spinner'

const SignIn = () => {
  const navigate = useNavigate()

  const { mutateAsync: signIn } = useSignIn()

  const [state, setState] = useReducer(formReducer, {})
  const [showPassword, setShowPassword] = useState<boolean>(false)
  const [persist, setPersist] = useState<boolean>(false)
  const [errMsg, setErrMsg] = useState<string>()
  const [submitting, setSubmitting] = useState<boolean>(false)

  const onSubmitClicked = async () => {
    const isValid = validate()
    if (isValid) {
      setSubmitting(true)
      setState({ target: { name: 'submitting', value: true } })
      try {
        const { isSignedIn } = await signIn({
          username: state.username,
          password: state.password,
          persist: persist,
        })
        if (isSignedIn) {
          setSubmitting(false)
          return navigate(-1)
        }
      } catch (err: any) {
        setSubmitting(false)
        setErrMsg(err.message)
      }
    }
  }

  return (
    <Modal>
      <Modal.Dialogue size='xs'>
        <Modal.Header title='Sign In' />
        <Modal.Content>
          {errMsg && <p>{errMsg}</p>}
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
            autoComplete={'current-password'}
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
          <div className={sprinkles({ ta: 'center' })}>By clicking Submit, you agree to the terms of use.</div>
        </Modal.Content>
      </Modal.Dialogue>
    </Modal>
  )
}
export default SignIn
