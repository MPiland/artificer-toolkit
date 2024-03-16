import { useReducer, useEffect, useState } from 'react'
import formReducer from '../../hooks/useReducer'
import Form from '../../components/Form/Form'
import {
  useAddNewItemMutation,
  useUpdateItemMutation,
  useGetItemsQuery,
  selectItemById,
} from './itemsApiSlice'
import { useLocation, useParams } from 'react-router-dom'
import Spinner from '../../components/Spinner/Spinner'
import { FormContext, Step } from '../../utils/types'
import { isEqual } from 'lodash'

const ItemForm = () => {
  const { context } = useParams()
  const location = useLocation()

  const formData = location.state?.data

  const { item } = useGetItemsQuery('itemsList', {
    selectFromResult: ({ data }) => ({
      item: data && selectItemById(data, formData?._id),
    }),
  })

  const [state, setState] = useReducer(
    formReducer,
    context === 'edit' ? (formData ? formData : item) : {}
  )
  const [oldState, setOldState] = useState(item)
  const [isLoading, setIsLoading] = useState<boolean>(
    (context === 'new' && formData?._id) ?? false
  )

  useEffect(() => {
    if (
      state &&
      Object.keys(state).length === 0 &&
      (formData || item) &&
      context === 'edit'
    ) {
      if (formData && !isEqual(state, formData)) {
        setState({
          type: 'reset',
          target: { value: formData },
        })
      } else if (item && !isEqual(state, item)) {
        setState({
          type: 'reset',
          target: { value: item },
        })
      }
    }
  }, [item, state, state?.value, context, formData])

  useEffect(() => {
    if (
      state.contains &&
      !state.attribute?.some(
        (attributeItem: any) => attributeItem.name === 'containsItems'
      )
    ) {
      setState({
        type: 'removed',
        target: {
          name: 'contains',
        },
      })
    }
  }, [state.contains, state.attribute])

  useEffect(() => {
    if (state && state?.value !== '' && isLoading) {
      setState({ target: { name: 'value', value: '' } })
      setOldState(state)
    }
    setIsLoading(false)
  }, [state, state?.value, isLoading])

  useEffect(() => {
    if (item && !oldState) {
      setOldState(item)
    }
  }, [oldState, item])

  const steps: Step[] = ['Details', 'Attributes', 'Features']

  useEffect(() => {
    if (
      state.attribute?.some(
        (attributeItem: any) => attributeItem.name === 'containsItems'
      )
    ) {
      steps.push('Contains')
    }
  })

  return isLoading || !state ? (
    <Spinner />
  ) : (
    <Form
      context={{ type: context, title: 'item' } as FormContext}
      steps={steps}
      state={state}
      setState={setState}
      location={location}
      useUpdateItem={useUpdateItemMutation}
      useAddNewItem={useAddNewItemMutation}
    />
  )
}
export default ItemForm
