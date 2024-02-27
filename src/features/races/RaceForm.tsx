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
import { FormContext, Steps } from '../../utils/types'
import Spinner from '../../components/Spinner/Spinner'

const RaceForm = () => {
  const { context } = useParams()
  const location = useLocation()

  const id = location.state?.data

  const { race } = useGetRacesQuery(undefined, {
    selectFromResult: ({ data }) => ({
      race: data && selectRaceById(data, id),
    }),
  })

  const [state, setState] = useReducer(
    formReducer,
    context === 'edit' || id ? race : {}
  )
  const [oldState, setOldState] = useState(race)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(
    (context === 'new' && id) ?? false
  )

  const [
    addNewRace,
    { isSuccess: addIsSuccess, isError: addIsError, error: addError },
  ] = useAddNewRaceMutation()

  const [
    updateRace,
    { isSuccess: updateIsSuccess, isError: updateIsError, error: updateError },
  ] = useUpdateRaceMutation()

  useEffect(() => {
    if (!state && race) {
      console.log('race', race)
      setState({
        type: 'reset',
        target: { value: race },
      })
    }
  }, [race, state, state?.value, context])

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
    await addNewRace(state)
  }

  const steps: Steps = ['Details', 'Traits', 'Features']

  return isLoading || !state ? (
    <Spinner />
  ) : (
    <Form
      context={{ type: context as FormContext, title: 'race' }}
      handleSubmit={handleSubmit}
      update={updateRace}
      steps={steps}
      state={state}
      setState={setState}
      errorMessage={errorMessage}
      successMessage={successMessage}
      setErrorMessage={setErrorMessage}
      setSuccessMessage={setSuccessMessage}
      location={location}
    />
  )
}
export default RaceForm
