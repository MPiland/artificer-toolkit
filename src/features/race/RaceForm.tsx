import { useAddNewRaceMutation, useUpdateRaceMutation } from './raceApiSlice'
import Form from '../../components/Form/Form'
import { Step } from '../../utils/types'

const RaceForm = () => {
  const steps: Step[] = ['Details', 'Traits', 'Ancestry', 'Features']

  return (
    <Form context='race' steps={steps} useUpdateItem={useUpdateRaceMutation} useAddNewItem={useAddNewRaceMutation} />
  )
}
export default RaceForm
