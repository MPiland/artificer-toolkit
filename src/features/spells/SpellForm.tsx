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
import { FormContext, Step } from '../../utils/types'
import Spinner from '../../components/Spinner/Spinner'
import { isEqual } from 'lodash'

const SpellForm = () => {
  const { context } = useParams()
  const location = useLocation()

  const formData = location.state?.data

  const { spell } = useGetSpellsQuery(undefined, {
    selectFromResult: ({ data }) => ({
      spell: data && selectSpellById(data, formData?._id),
    }),
  })

  const [state, setState] = useReducer(
    formReducer,
    context === 'edit' ? (formData ? formData : spell) : {}
  )
  const [oldState, setOldState] = useState(spell)
  const [isLoading, setIsLoading] = useState<boolean>(
    (context === 'new' && formData?._id) ?? false
  )

  useEffect(() => {
    if (
      state &&
      Object.keys(state).length === 0 &&
      (formData || spell) &&
      context === 'edit'
    ) {
      if (formData && !isEqual(state, formData)) {
        setState({
          type: 'reset',
          target: { value: formData },
        })
      } else if (spell && !isEqual(state, spell)) {
        setState({
          type: 'reset',
          target: { value: spell },
        })
      }
    }
  }, [spell, state, state?.value, context, formData])

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

  const steps: Step[] = ['Details', 'Attributes']

  return isLoading || !state ? (
    <Spinner />
  ) : (
    <Form
      context={{ type: context, title: 'spell' } as FormContext}
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
