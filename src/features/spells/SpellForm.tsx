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

  const [state, setState] = useReducer(
    formReducer,
    context === 'edit' || id ? spell : {}
  )
  const [oldState, setOldState] = useState(spell)
  const [isLoading, setIsLoading] = useState<boolean>(
    (context === 'new' && id) ?? false
  )

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

  const steps: Steps = ['Details', 'Attributes']

  return isLoading || !state ? (
    <Spinner />
  ) : (
    <Form
      context={{ type: context as FormContext, title: 'spell' }}
      steps={steps}
      state={state}
      setState={setState}
      location={location}
      useAddNewItem={useAddNewSpellMutation}
      useUpdateItem={useUpdateSpellMutation}
    />
  )
}
export default SpellForm
