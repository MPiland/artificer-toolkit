import { useReducer, useEffect, useState } from 'react'
import formReducer from '../../hooks/useReducer'
import Form from '../../components/Form/Form'
import {
  useAddNewFeatMutation,
  useUpdateFeatMutation,
  useGetFeatsQuery,
  selectFeatById,
} from './featsApiSlice'
import { useLocation, useParams } from 'react-router-dom'
import { FormContext, Steps } from '../../utils/types'
import Spinner from '../../components/Spinner/Spinner'

const FeatForm = () => {
  const { context } = useParams()
  const location = useLocation()

  const id = location.state?.data

  const { feat } = useGetFeatsQuery(undefined, {
    selectFromResult: ({ data }) => ({
      feat: data && selectFeatById(data, id),
    }),
  })

  const [state, setState] = useReducer(
    formReducer,
    context === 'edit' || id ? feat : {}
  )
  const [oldState, setOldState] = useState(feat)
  const [isLoading, setIsLoading] = useState<boolean>(
    (context === 'new' && id) ?? false
  )

  useEffect(() => {
    if (!state && feat) {
      setState({
        type: 'reset',
        target: { value: feat },
      })
    }
  }, [feat, state, state?.value, context])

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

  const steps: Steps = ['Features']

  return isLoading || !state ? (
    <Spinner />
  ) : (
    <Form
      context={{ type: context as FormContext, title: 'feat' }}
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
