import Spinner from '../../../Spinner/Spinner'
import RaceFeatures from './RaceFeatures'
import { useForm } from '../../../../hooks/UseForm'
import RaceSelection from './RaceSelection'
import { useIsFetching } from '@tanstack/react-query'

const Races = () => {
  const isLoading = useIsFetching() > 0

  const { formState, changeRace } = useForm()

  return isLoading ? (
    <Spinner />
  ) : formState?.race != null && !changeRace ? (
    <RaceFeatures race={formState?.race} />
  ) : (
    <RaceSelection />
  )
}

export default Races
