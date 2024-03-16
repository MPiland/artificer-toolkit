import { useReducer, useEffect, useState } from 'react'
import {
  useAddNewRaceMutation,
  useUpdateRaceMutation,
  useGetRacesQuery,
  selectRaceById,
} from './racesApiSlice'
import { useLocation, useParams } from 'react-router-dom'
import Form from '../../components/Form/Form'
import formReducer from '../../hooks/useReducer'
import { FormContext, Step } from '../../utils/types'
import Spinner from '../../components/Spinner/Spinner'
import { isEqual } from 'lodash'

const RaceForm = () => {
  const { context } = useParams()
  const location = useLocation()

  const formData = location.state?.data

  const { race } = useGetRacesQuery(undefined, {
    selectFromResult: ({ data }) => ({
      race: data && selectRaceById(data, formData?._id),
    }),
  })

  const [state, setState] = useReducer(
    formReducer,
    context === 'edit' ? (formData ? formData : race) : {}
  )
  const [oldState, setOldState] = useState(race)
  const [isLoading, setIsLoading] = useState<boolean>(
    (context === 'new' && formData?._id) ?? false
  )

  useEffect(() => {
    if (
      state &&
      Object.keys(state).length === 0 &&
      (formData || race) &&
      context === 'edit'
    ) {
      if (formData && !isEqual(state, formData)) {
        setState({
          type: 'reset',
          target: { value: formData },
        })
      } else if (race && !isEqual(state, race)) {
        setState({
          type: 'reset',
          target: { value: race },
        })
      }
    }
  }, [race, state, state?.value, context, formData])

  useEffect(() => {
    if (state && state?.value !== '' && isLoading) {
      setState({ target: { name: 'value', value: '' } })
      setOldState(state)
    }
    setIsLoading(false)
  }, [state, state?.value, isLoading])

  useEffect(() => {
    if (race && !oldState) {
      setOldState(race)
    }
  }, [oldState, race])

  const steps: Step[] = ['Details', 'Traits', 'Features']

  return isLoading || !state ? (
    <Spinner />
  ) : (
    <Form
      context={{ type: context, title: 'race' } as FormContext}
      steps={steps}
      state={state}
      setState={setState}
      location={location}
      useUpdateItem={useUpdateRaceMutation}
      useAddNewItem={useAddNewRaceMutation}
    />
  )
}
export default RaceForm
