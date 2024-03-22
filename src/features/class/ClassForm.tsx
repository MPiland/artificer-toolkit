import Form from '../../components/Form/Form'
import {
  useAddNewClassMutation,
  useUpdateClassMutation,
  useGetClassesQuery,
  selectClassById,
} from './classApiSlice'
import { useLocation, useParams } from 'react-router-dom'
import { FormContext, Step } from '../../utils/types'

const ClassForm = () => {
  const { context } = useParams()
  const location = useLocation()

  const { userClass } = useGetClassesQuery(undefined, {
    selectFromResult: ({ data }) => ({
      userClass: data && selectClassById(data, location.state?.data?._id),
    }),
  })

  const steps: Step[] = [
    'Details',
    'Proficiencies',
    'Equipment',
    'Attributes',
    'Features',
  ]

  return (
    <Form
      context={{ type: context, title: 'class' } as FormContext}
      steps={steps}
      stepFilter={{
        name: 'category.name',
        value: 'subclass',
        filter: 'Equipment',
      }}
      item={userClass}
      location={location}
      useUpdateItem={useUpdateClassMutation}
      useAddNewItem={useAddNewClassMutation}
    />
  )
}
export default ClassForm
