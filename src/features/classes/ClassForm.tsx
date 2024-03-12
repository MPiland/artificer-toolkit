import { useReducer, useEffect, useState } from 'react'
import formReducer from '../../hooks/useReducer'
import Form from '../../components/Form/Form'
import {
  useAddNewClassMutation,
  useUpdateClassMutation,
  useGetClassesQuery,
  selectClassById,
} from './classesApiSlice'
import { useLocation, useParams } from 'react-router-dom'
import { FormContext, Step } from '../../utils/types'
import Spinner from '../../components/Spinner/Spinner'

const ClassForm = () => {
  const { context } = useParams()
  const location = useLocation()

  const id = location.state?.data

  const { userClass } = useGetClassesQuery(undefined, {
    selectFromResult: ({ data }) => ({
      userClass: data && selectClassById(data, id),
    }),
  })

  const [oldState, setOldState] = useState(userClass)
  const [state, setState] = useReducer(
    formReducer,
    context === 'edit' || id ? userClass : {}
  )
  const [isLoading, setIsLoading] = useState<boolean>(
    (context === 'new' && id) ?? false
  )

  useEffect(() => {
    if (!state && userClass) {
      setState({
        type: 'reset',
        target: { value: userClass },
      })
    }
  }, [userClass, state, state?.value, context])

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
