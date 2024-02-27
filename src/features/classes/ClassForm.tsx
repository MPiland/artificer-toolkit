import { useReducer, useEffect, useState } from 'react'
import formReducer from '../../hooks/useReducer'
import Form from '../../components/Form/Form'
import {
  useAddNewClassMutation,
  useUpdateClassMutation,
  useGetClassesQuery,
  selectClassById,
} from './classesApiSlice'
import { useLocation, useParams } from 'react-router-dom'
import { FormContext, Steps } from '../../utils/types'
import Spinner from '../../components/Spinner/Spinner'

const ClassForm = () => {
  const { context } = useParams()
  const location = useLocation()

  const id = location.state?.data

  const { userClass } = useGetClassesQuery(undefined, {
    selectFromResult: ({ data }) => ({
      userClass: data && selectClassById(data, id),
    }),
  })

  const [oldState, setOldState] = useState(userClass)
  const [state, setState] = useReducer(
    formReducer,
    context === 'edit' || id ? userClass : {}
  )
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(
    (context === 'new' && id) ?? false
  )

  const [
    addNewClass,
    { isSuccess: addIsSuccess, isError: addIsError, error: addError },
  ] = useAddNewClassMutation()

  const [
    updateClass,
    { isSuccess: updateIsSuccess, isError: updateIsError, error: updateError },
  ] = useUpdateClassMutation()

  useEffect(() => {
    if (!state && userClass) {
      setState({
        type: 'reset',
        target: { value: userClass },
      })
    }
  }, [userClass, state, state?.value, context])

  useEffect(() => {
    if (state && state?.value !== '' && isLoading) {
      setState({ target: { name: 'value', value: '' } })
      setOldState(state)
    }
    setIsLoading(false)
  }, [state, state?.value, isLoading])

  useEffect(() => {
    if (state && !oldState) {
      setOldState(state)
    }
  }, [state, oldState])

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

  const handleSubmit = async () => {
    await addNewClass(state)
  }

  const steps: Steps = [
    'Details',
    'Equipment',
    'Proficiencies',
    'Attributes',
    'Features',
  ]

  return isLoading || !state ? (
    <Spinner />
  ) : (
    <Form
      context={{ type: context as FormContext, title: 'class' }}
      handleSubmit={handleSubmit}
      steps={steps}
      state={state}
      setState={setState}
      update={updateClass}
      errorMessage={errorMessage}
      successMessage={successMessage}
      setErrorMessage={setErrorMessage}
      setSuccessMessage={setSuccessMessage}
      location={location}
    />
  )
}
export default ClassForm
