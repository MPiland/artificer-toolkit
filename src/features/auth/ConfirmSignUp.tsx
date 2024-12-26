import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Input from '../../components/Input/Input'
import Button from '../../components/Button/Button'
import { sprinkles } from '../../css/sprinkles.css'
import Modal from '../../components/Modal/Modal'
import { handleResendSignUpCode, useConfirmSignUp } from './authApi'
import Spinner from '../../components/Spinner/Spinner'

const ConfirmSignUp = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const { mutateAsync: confirmSignUp } = useConfirmSignUp()

  const [state, setState] = useState<{ password: string; username: string; confirmationCode: string }>({
    password: '',
    username: '',
    confirmationCode: '',
  })
  const [errorMsg, setErrMsg] = useState<string | null>(null)
  const [resendConfirm, setResendConfirm] = useState<boolean>(false)
  const [submitting, setSubmitting] = useState<boolean>(false)

  const onConfirmClicked = async () => {
    setSubmitting(true)
    try {
      const result = await confirmSignUp({
        username: location.state.username,
        confirmationCode: state.confirmationCode,
      })

      if (result === 'SIGNED_IN') {
        setSubmitting(false)
        return navigate('/')
      }
      if (result === 'CODE_MISMATCH') {
        setErrMsg('Confirmation code does not match. Please re-enter and try again.')
        setSubmitting(false)
      }
    } catch (err: any) {
      setSubmitting(false)
      return console.error(err.message)
    }
  }

  return (
    <Modal handleCloseFn={() => navigate('/')}>
      <Modal.Dialogue size='xs'>
        <Modal.Header title='Confirmation' />
        <Modal.Content>
          {errorMsg && <p>{errorMsg}</p>}
          {resendConfirm && (
            <>
              <p>
                Username was not registration was not confirmed. Please resend confirmation to complete registration.
              </p>
              <Button
                color='primary'
                type='submit'
                disabled={submitting}
                onClick={(e: any) => {
                  e.preventDefault()
                  handleResendSignUpCode(state.username)
                  setResendConfirm(false)
                }}
                className={sprinkles({ width: 'size-full' })}
              >
                {submitting ? <Spinner /> : 'Resend Confirmation Code'}
              </Button>
            </>
          )}
          {!resendConfirm && (
            <>
              <p>Check the email used for registration for the confirmation code.</p>
              <Input
                className={sprinkles({ mb: 'space-2' })}
                placeholder='Confirmation code...'
                name='confirmationCode'
                label={'Confirmation Code'}
                required={true}
                value={state.confirmationCode}
                onChange={(e) =>
                  setState((prevState) => ({
                    ...prevState,
                    confirmationCode: (e as { type: 'update'; value: string }).value,
                  }))
                }
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
            </>
          )}
        </Modal.Content>
      </Modal.Dialogue>
    </Modal>
  )
}
export default ConfirmSignUp
