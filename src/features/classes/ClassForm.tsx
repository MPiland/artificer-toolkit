import { useReducer, useEffect, useState } from 'react'
import formReducer from '../../hooks/useReducer'
import Form from '../../components/Form/Form'
import { isEqual } from 'lodash'
import {
  useAddNewClassMutation,
  useUpdateClassMutation,
  useGetClassesQuery,
  selectClassById,
} from './classesApiSlice'
import { useLocation } from 'react-router-dom'
import { Steps } from '../../utils/types'

interface ClassFormProps {
  context: 'create' | 'edit'
}

const ClassForm = ({ context }: ClassFormProps) => {
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
    context === 'edit' ? userClass : {}
  )
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [match, setMatch] = useState<boolean>(false)

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
  })

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
    await addNewClass(state)
  }

  const handleUpdate = async () => {
    if (match) {
      setErrorMessage('No changes made')
    } else {
      await updateClass(state)
      setOldState(state)
    }
  }

  const steps: Steps = [
    'Details',
    'Attributes',
    'Equipment',
    'Proficiencies',
    'Features',
  ]

  return (
    <Form
      context={{ type: context, title: 'class' }}
      handleSubmit={handleSubmit}
      handleUpdate={handleUpdate}
      steps={steps}
      state={state}
      setState={setState}
      errorMessage={errorMessage}
      successMessage={successMessage}
    />
  )
}
export default ClassForm
