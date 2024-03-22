import Form from '../../components/Form/Form'
import {
  useAddNewBackgroundMutation,
  useUpdateBackgroundMutation,
  useGetBackgroundsQuery,
  selectBackgroundById,
} from './backgroundApiSlice'
import { useLocation, useParams } from 'react-router-dom'
import { FormContext, Step } from '../../utils/types'

const BackgroundForm = () => {
  const { context } = useParams()
  const location = useLocation()

  const { background } = useGetBackgroundsQuery(undefined, {
    selectFromResult: ({ data }) => ({
      background: data && selectBackgroundById(data, location.state?.data?._id),
    }),
  })

  const steps: Step[] = ['Details', 'Proficiencies', 'Equipment', 'Features']

  return (
    <Form
      context={{ type: context, title: 'background' } as FormContext}
      steps={steps}
      item={background}
      location={location}
      useAddNewItem={useAddNewBackgroundMutation}
      useUpdateItem={useUpdateBackgroundMutation}
    />
  )
}
export default BackgroundForm
