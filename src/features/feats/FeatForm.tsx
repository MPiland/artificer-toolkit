import { useReducer, useEffect, useState } from 'react'
import formReducer from '../../hooks/useReducer'
import Form from '../../components/Form/Form'
import {
  useAddNewFeatMutation,
  useUpdateFeatMutation,
  useGetFeatsQuery,
  selectFeatById,
} from './featsApiSlice'
import { isEqual } from 'lodash'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { FormContext, Steps } from '../../utils/types'
import Spinner from '../../components/Spinner/Spinner'

const FeatForm = () => {
  const { context } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  const id = location.state?.data

  const { feat } = useGetFeatsQuery(undefined, {
    selectFromResult: ({ data }) => ({
      feat: data && selectFeatById(data, id),
    }),
  })

  const [oldState, setOldState] = useState(feat)
  const [state, setState] = useReducer(
    formReducer,
    context === 'edit' ? feat : {}
  )
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [match, setMatch] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(
    (context === 'new' && id) ?? false
  )

  const [
    addNewFeat,
    { isSuccess: addIsSuccess, isError: addIsError, error: addError },
  ] = useAddNewFeatMutation()

  const [
    updateFeat,
    { isSuccess: updateIsSuccess, isError: updateIsError, error: updateError },
  ] = useUpdateFeatMutation()

  useEffect(() => {
    if (!state && feat) {
      setState({
        type: 'reset',
        target: { value: feat },
      })
    }
  })

  useEffect(() => {
    if (state && state?.value !== '' && isLoading) {
      setState({ target: { name: 'value', value: '' } })
      setOldState(state)
    }
    setIsLoading(false)
  }, [state, state?.value, isLoading])

  useEffect(() => {
    if (feat && !oldState) {
      setOldState(feat)
    }
  }, [oldState, feat])

  useEffect(() => {
    if (addIsSuccess || updateIsSuccess) {
      setSuccessMessage('Spell added successfully!')
      setErrorMessage(null)
    }
  }, [addIsSuccess, updateIsSuccess])

  useEffect(() => {
    if (addIsError || updateIsError) {
      if (addError && 'data' in addError) {
        setErrorMessage((addError.data as any).message)
      }
      if (updateError && 'data' in updateError) {
        setErrorMessage((updateError.data as any).message)
      }
    }
  }, [addIsError, updateIsError, addError, updateError])

  useEffect(() => {
    document.addEventListener('keypress', () => {
      if (successMessage !== null && !match) {
        setSuccessMessage(null)
      }
      if (errorMessage) {
        setErrorMessage(null)
      }
    })
    return () =>
      document.removeEventListener('keypress', () => {
        if (successMessage !== null && !match) {
          setSuccessMessage(null)
        }
        if (errorMessage) {
          setErrorMessage(null)
        }
      })
  }, [errorMessage, match, successMessage])

  useEffect(() => {
    if (isEqual(oldState, state)) {
      setMatch(true)
    } else {
      setMatch(false)
    }
  }, [state, oldState])

  const handleSubmit = async () => {
    console.log('state', state)
    try {
      await addNewFeat(state)
      navigate(-1)
    } catch (err: any) {
      console.log(err.data.message)
    }
  }

  const steps: Steps = ['Features']

  return isLoading || !state ? (
    <Spinner />
  ) : (
    <Form
      context={{ type: context as FormContext, title: 'feat' }}
      handleSubmit={handleSubmit}
      update={updateFeat}
      steps={steps}
      state={state}
      setState={setState}
      errorMessage={errorMessage}
      successMessage={successMessage}
      setErrorMessage={setErrorMessage}
    />
  )
}
export default FeatForm
