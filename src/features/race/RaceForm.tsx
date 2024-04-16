import {
  useAddNewRaceMutation,
  useUpdateRaceMutation,
} from './raceApiSlice'
import { useLocation, useParams } from 'react-router-dom'
import Form from '../../components/Form/Form'
import { FormContext, Step } from '../../utils/types'

const RaceForm = () => {
  const { context } = useParams()
  const location = useLocation()

  const steps: Step[] = ['Details', 'Traits', 'Ancestry', 'Features']

  return (
    <Form
      context={{ type: context, title: 'race' } as FormContext}
      steps={steps}
      item={location.state.data}
      location={location}
      useUpdateItem={useUpdateRaceMutation}
      useAddNewItem={useAddNewRaceMutation}
    />
  )
}
export default RaceForm
