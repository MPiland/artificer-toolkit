import Form from '../../components/Form/Form'
import {
  useAddNewFeatMutation,
  useUpdateFeatMutation,
  useGetFeatsQuery,
  selectFeatById,
} from './featApiSlice'
import { useLocation, useParams } from 'react-router-dom'
import { FormContext, Step } from '../../utils/types'

const FeatForm = () => {
  const { context } = useParams()
  const location = useLocation()

  const { feat } = useGetFeatsQuery(undefined, {
    selectFromResult: ({ data }) => ({
      feat: data && selectFeatById(data, location.state?.data?._id),
    }),
  })

  const steps: Step[] = ['Features']

  return (
    <Form
      context={{ type: context, title: 'feat' } as FormContext}
      steps={steps}
      item={feat}
      location={location}
      useAddNewItem={useAddNewFeatMutation}
      useUpdateItem={useUpdateFeatMutation}
    />
  )
}
export default FeatForm
