import { useReducer, useEffect, useState } from 'react'
import formReducer from '../../hooks/useReducer'
import Form from '../../components/Form/Form'
import { useLocation, useParams } from 'react-router-dom'
import {
  useAddNewSpellMutation,
  useUpdateSpellMutation,
  useGetSpellsQuery,
  selectSpellById,
} from './spellsApiSlice'
import { isEqual } from 'lodash'
import { FormContext, Steps } from '../../utils/types'
import Spinner from '../../components/Spinner/Spinner'
const SpellForm = () => {
  const { context } = useParams()
  const location = useLocation()

  const id = location.state?.data

  const { spell } = useGetSpellsQuery(undefined, {
    selectFromResult: ({ data }) => ({
      spell: data && selectSpellById(data, id),
    }),
  })

  const [oldState, setOldState] = useState(spell)
  const [state, setState] = useReducer(
    formReducer,
    context === 'edit' || id ? spell : {}
  )
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [match, setMatch] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(
    (context === 'new' && id) ?? false
  )

  const [
    addNewSpell,
    { isSuccess: addIsSuccess, isError: addIsError, error: addError },
  ] = useAddNewSpellMutation()

  const [
    updateSpell,
    { isSuccess: updateIsSuccess, isError: updateIsError, error: updateError },
  ] = useUpdateSpellMutation()

  useEffect(() => {
    if (!state && spell) {
      setState({
        type: 'reset',
        target: { value: spell },
      })
    }
  }, [spell, state, state?.value, context])

  useEffect(() => {
    if (state && state?.value !== '' && isLoading) {
      setState({ target: { name: 'value', value: '' } })
      setOldState(state)
    }
    setIsLoading(false)
  }, [state, state?.value, isLoading])

  useEffect(() => {
    if (!oldState && spell) {
      setOldState(spell)
    }
  }, [spell, oldState])

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
    document.addEventListener('mouseup', () => {
      if (successMessage != null && !match) {
        setSuccessMessage(null)
      }
      if (errorMessage) {
        setErrorMessage(null)
      }
    })
    return () =>
      document.removeEventListener('mouseup', () => {
        if (successMessage != null && !match) {
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

  const onSubmit = async () => {
    await addNewSpell(state)
  }

  const steps: Steps = ['Details', 'Attributes']

  return isLoading || !state ? (
    <Spinner />
  ) : (
    <Form
      context={{ type: context as FormContext, title: 'spell' }}
      handleSubmit={onSubmit}
      update={updateSpell}
      steps={steps}
      state={state}
      setState={setState}
      errorMessage={errorMessage}
      successMessage={successMessage}
      setErrorMessage={setErrorMessage}
      location={location}
    />
  )
}
export default SpellForm
