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
import { FormContext, Steps } from '../../utils/types'

const ItemForm = () => {
  const { context } = useParams()
  const location = useLocation()

  const id = location.state?.data

  const { item } = useGetItemsQuery('itemsList', {
    selectFromResult: ({ data }) => ({
      item: data && selectItemById(data, id),
    }),
  })

  const [state, setState] = useReducer(
    formReducer,
    context === 'edit' || id ? item : {}
  )
  const [oldState, setOldState] = useState(item)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(
    (context === 'new' && id) ?? false
  )

  const [
    addNewItem,
    { isSuccess: addIsSuccess, isError: addIsError, error: addError },
  ] = useAddNewItemMutation()

  const [
    updateItem,
    { isSuccess: updateIsSuccess, isError: updateIsError, error: updateError },
  ] = useUpdateItemMutation()

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
    if (!state && item) {
      setState({
        type: 'reset',
        target: { value: item },
      })
    }
  }, [item, state, state?.value, context])

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

  useEffect(() => {
    if (addIsSuccess || updateIsSuccess) {
      setSuccessMessage('Spell added successfully!')
      setErrorMessage(null)
    }
  }, [addIsSuccess, updateIsSuccess])

  useEffect(() => {
    if (addIsError || updateIsError) {
      if (addError && 'data' in addError) {
        setErrorMessage((addError.data as any).message)
      }
      if (updateError && 'data' in updateError) {
        setErrorMessage((updateError.data as any).message)
      }
    }
  }, [addIsError, updateIsError, addError, updateError])

  const onSubmit = async () => {
    await addNewItem(state)
  }

  const steps: Steps = ['Details', 'Attributes', 'Features']

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
      context={{ type: context as FormContext, title: 'item' }}
      handleSubmit={onSubmit}
      update={updateItem}
      steps={steps}
      state={state}
      setState={setState}
      errorMessage={errorMessage}
      successMessage={successMessage}
      setErrorMessage={setErrorMessage}
      setSuccessMessage={setSuccessMessage}
      location={location}
    />
  )
}
export default ItemForm
