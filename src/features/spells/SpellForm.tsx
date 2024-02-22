import { useReducer, useEffect, useState, FC } from 'react'
import formReducer from '../../hooks/useReducer'
import Form from '../../components/Form/Form'
import { useLocation } from 'react-router-dom'
import {
  useAddNewSpellMutation,
  useUpdateSpellMutation,
  useGetSpellsQuery,
  selectSpellById,
} from './spellsApiSlice'
import { isEqual } from 'lodash'
import { Steps } from '../../utils/types'

interface SpellFormProps {
  context: 'create' | 'edit'
}

const SpellForm: FC<SpellFormProps> = ({ context }) => {
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
    context === 'edit' ? spell : {}
  )
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [match, setMatch] = useState<boolean>(false)

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
        target: { value: { spell } },
      })
    }
  }, [spell, state])

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

  const onUpdate = async () => {
    if (match) {
      setErrorMessage('No changes made')
    } else {
      await updateSpell(state)
      setOldState(state)
    }
  }

  const steps: Steps = ['Details', 'Attributes']

  return (
    <Form
      context={{ type: context, title: 'spell' }}
      handleSubmit={onSubmit}
      handleUpdate={onUpdate}
      steps={steps}
      state={state}
      setState={setState}
      errorMessage={errorMessage}
      successMessage={successMessage}
    />
  )
}
export default SpellForm
