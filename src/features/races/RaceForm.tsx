import { useEffect, useState, useReducer } from 'react'
import {
  useAddNewRaceMutation,
  useUpdateRaceMutation,
  useGetRacesQuery,
  selectRaceById,
} from './racesApiSlice'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import Form from '../../components/Form/Form'
import { isEqual } from 'lodash'
import formReducer from '../../hooks/useReducer'
import { FormContext, Steps } from '../../utils/types'
import Spinner from '../../components/Spinner/Spinner'

const RaceForm = () => {
  const { context } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  const id = location.state?.data

  const { race } = useGetRacesQuery(
    {},
    {
      selectFromResult: ({ data }) => ({
        race: data && selectRaceById(data, id),
      }),
    }
  )

  const [state, setState] = useReducer(
    formReducer,
    context === 'edit' || context === 'copy' ? race : {}
  )
  const [oldState, setOldState] = useState(race)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [match, setMatch] = useState<boolean>(false)
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
  })

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
    try {
      await addNewRace(state)
      navigate(-1)
    } catch (err: any) {
      console.log(err.data.message)
    }
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
    />
  )
}
export default RaceForm
