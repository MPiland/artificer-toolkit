import { useReducer, useEffect, useState } from 'react'
import formReducer from '../../hooks/useReducer'
import Form from '../../components/Form/Form'
import {
  useAddNewClassMutation,
  useUpdateClassMutation,
  useGetClassesQuery,
  selectClassById,
} from './classApiSlice'
import { useLocation, useParams } from 'react-router-dom'
import { FormContext, Step } from '../../utils/types'
import Spinner from '../../components/Spinner/Spinner'
import { isEqual } from 'lodash'

const ClassForm = () => {
  const { context } = useParams()
  const location = useLocation()

  const formData = location.state?.data
  const defaultCategory = location.state?.defaultCategory

  const { userClass } = useGetClassesQuery(undefined, {
    selectFromResult: ({ data }) => ({
      userClass: data && selectClassById(data, formData?._id),
    }),
  })

  const [oldState, setOldState] = useState(userClass)
  const [state, setState] = useReducer(
    formReducer,
    context === 'edit'
      ? formData
        ? formData
        : userClass
      : { category: { name: defaultCategory } }
  )
  const [isLoading, setIsLoading] = useState<boolean>(
    (context === 'new' && formData?._id) ?? false
  )

  console.log({ state: state })

  useEffect(() => {
    if (
      state &&
      Object.keys(state).length === 0 &&
      (formData || userClass) &&
      context === 'edit'
    ) {
      if (formData && !isEqual(state, formData)) {
        setState({
          type: 'reset',
          target: { value: formData },
        })
      } else if (userClass && !isEqual(state, userClass)) {
        setState({
          type: 'reset',
          target: { value: userClass },
        })
      }
    }
  }, [userClass, state, state?.value, context, formData])

  useEffect(() => {
    if (state && state?.value !== '' && isLoading) {
      setState({ target: { name: 'value', value: '' } })
      setOldState(state)
    }
    setIsLoading(false)
  }, [state, state?.value, isLoading])

  useEffect(() => {
    if (state && !oldState) {
      setOldState(state)
    }
  }, [state, oldState])

  const steps: Step[] = [
    'Details',
    'Proficiencies',
    'Equipment',
    'Attributes',
    'Features',
  ]

  return isLoading || !state ? (
    <Spinner />
  ) : (
    <Form
      context={{ type: context, title: 'class' } as FormContext}
      steps={steps}
      stepFilter={{
        name: 'category.name',
        value: 'subclass',
        filter: 'Equipment',
      }}
      state={state}
      setState={setState}
      location={location}
      useUpdateItem={useUpdateClassMutation}
      useAddNewItem={useAddNewClassMutation}
    />
  )
}
export default ClassForm
