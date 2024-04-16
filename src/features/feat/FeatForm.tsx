import Form from '../../components/Form/Form'
import { useAddNewFeatMutation, useUpdateFeatMutation } from './featApiSlice'
import { useLocation, useParams } from 'react-router-dom'
import { FormContext, Step } from '../../utils/types'

const FeatForm = () => {
  const { context } = useParams()
  const location = useLocation()

  const steps: Step[] = ['Features']

  return (
    <Form
      context={{ type: context, title: 'feat' } as FormContext}
      steps={steps}
      item={location.state.data}
      location={location}
      useAddNewItem={useAddNewFeatMutation}
      useUpdateItem={useUpdateFeatMutation}
    />
  )
}
export default FeatForm
