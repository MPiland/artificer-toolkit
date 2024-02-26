import { useReducer, useEffect, useState } from 'react'
import formReducer from '../../hooks/useReducer'
import Form from '../../components/Form/Form'
import {
  useAddNewItemMutation,
  useUpdateItemMutation,
  useGetItemsQuery,
  selectItemById,
} from './itemsApiSlice'
import { isEqual } from 'lodash'
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

  const [
    addNewItem,
    { isSuccess: addIsSuccess, isError: addIsError, error: addError },
  ] = useAddNewItemMutation()

  const [
    updateItem,
    { isSuccess: updateIsSuccess, isError: updateIsError, error: updateError },
  ] = useUpdateItemMutation()

  const [oldState, setOldState] = useState(item)
  const [state, setState] = useReducer(
    formReducer,
    context === 'edit' ? item : {}
  )
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [match, setMatch] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(
    (context === 'new' && id) ?? false
  )

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
  })

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

  useEffect(() => {
    document.addEventListener('keypress', () => {
      if (successMessage !== null && !match) {
        setSuccessMessage(null)
      }
      if (errorMessage) {
        setErrorMessage(null)
      }
    })
    return () =>
      document.removeEventListener('keypress', () => {
        if (successMessage !== null && !match) {
          setSuccessMessage(null)
        }
        if (errorMessage) {
          setErrorMessage(null)
        }
      })
  }, [errorMessage, match, successMessage])

  useEffect(() => {
    if (isEqual(oldState, state)) {
      setMatch(true)
    } else {
      setMatch(false)
    }
  }, [state, oldState])

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
    />
  )
}
export default ItemForm
