import { useReducer, useEffect, useState } from 'react'
import formReducer from '../../hooks/useReducer'
import Form from '../../components/Form/Form'
import {
  useAddNewFeatMutation,
  useUpdateFeatMutation,
  useGetFeatsQuery,
  selectFeatById,
} from './featApiSlice'
import { useLocation, useParams } from 'react-router-dom'
import { FormContext, Step } from '../../utils/types'
import Spinner from '../../components/Spinner/Spinner'
import { isEqual } from 'lodash'

const FeatForm = () => {
  const { context } = useParams()
  const location = useLocation()

  const formData = location.state?.data

  const { feat } = useGetFeatsQuery(undefined, {
    selectFromResult: ({ data }) => ({
      feat: data && selectFeatById(data, formData?._id),
    }),
  })

  const [state, setState] = useReducer(
    formReducer,
    context === 'edit' ? (formData ? formData : feat) : {}
  )
  const [oldState, setOldState] = useState(feat)
  const [isLoading, setIsLoading] = useState<boolean>(
    (context === 'new' && formData?._id) ?? false
  )

  useEffect(() => {
    if (
      state &&
      Object.keys(state).length === 0 &&
      (formData || feat) &&
      context === 'edit'
    ) {
      if (formData && !isEqual(state, formData)) {
        setState({
          type: 'reset',
          target: { value: formData },
        })
      } else if (feat && !isEqual(state, feat)) {
        setState({
          type: 'reset',
          target: { value: feat },
        })
      }
    }
  }, [feat, state, state?.value, context, formData])

  useEffect(() => {
    if (state && state?.value !== '' && isLoading) {
      setState({ target: { name: 'value', value: '' } })
      setOldState(state)
    }
    setIsLoading(false)
  }, [state, state?.value, isLoading])

  useEffect(() => {
    if (feat && !oldState) {
      setOldState(feat)
    }
  }, [oldState, feat])

  const steps: Step[] = ['Features']

  return isLoading || !state ? (
    <Spinner />
  ) : (
    <Form
      context={{ type: context, title: 'feat' } as FormContext}
      steps={steps}
      state={state}
      setState={setState}
      location={location}
      useAddNewItem={useAddNewFeatMutation}
      useUpdateItem={useUpdateFeatMutation}
    />
  )
}
export default FeatForm
