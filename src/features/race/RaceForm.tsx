import { useAddNewRaceMutation, useUpdateRaceMutation } from './raceApiSlice'
import Form from '../../components/Form/Form'
import { Step } from '../../utils/types'
import FormStepsProvider from '../../components/Form/FormStepsProvider'

const RaceForm = () => {
  const steps: Step[] = ['Details', 'Traits', 'Ancestry', 'Features']

  return (
    <FormStepsProvider steps={steps}>
      <Form useUpdateItem={useUpdateRaceMutation} useAddNewItem={useAddNewRaceMutation} />
    </FormStepsProvider>
  )
}
export default RaceForm
