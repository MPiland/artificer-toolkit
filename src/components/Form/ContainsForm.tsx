import { FC, useEffect, useReducer, memo, useState } from 'react'
import Table from '../Table/Table'
import {
  useGetItemsQuery,
  selectAllItems,
} from '../../features/items/itemsApiSlice'
import { FetchBaseQueryError } from '@reduxjs/toolkit/query'
import { SerializedError } from '@reduxjs/toolkit'
import { ReducerActionType } from '../../utils/types'
import ScrollArea from '../ScrollArea/ScrollArea'
import { form_content } from './Form.css'
import FormFooter from './FormFooter'
import { useNavigate } from 'react-router-dom'
import formReducer from '../../hooks/useReducer'
import { isEqual } from 'lodash'

interface ContainsFormProps {
  state: any
  setState: (arg: ReducerActionType) => void
  setStepIndex: (arg: (i: number) => number) => void
  context: {
    type: 'edit' | 'create'
    title: string
  }
  isLastStep: boolean
  isFirstStep: boolean
  handleSubmit: () => Promise<void>
  update: (
    arg: any
  ) => Promise<{ data: any } | { error: FetchBaseQueryError | SerializedError }>
  setErrorMessage: (arg: string) => void
}

const ContainsForm: FC<ContainsFormProps> = memo(
  ({
    setState,
    state,
    isLastStep,
    isFirstStep,
    context,
    setStepIndex,
    handleSubmit,
    update,
    setErrorMessage,
  }) => {
    const [formState, setFormState] = useReducer(formReducer, state)
    const [oldFormState, setOldFormState] = useState<any>(state)
    const [matches, setMatches] = useState<boolean>(false)

    const navigate = useNavigate()

    const { items } = useGetItemsQuery('itemsList', {
      selectFromResult: ({ data }) => ({
        items: data && selectAllItems(data),
      }),
    })

    //Create contains data for table
    useEffect(() => {
      if (!state.contains) {
        setFormState({
          type: 'added',
          target: {
            name: 'contains',
          },
        })
      }
    }, [setState, state.contains])

    //Determine if changes made for warning in handleBack
    useEffect(() => {
      if (isEqual(formState, oldFormState)) {
        setMatches(true)
      } else {
        setMatches(false)
      }
    }, [formState, oldFormState])

    const handleReset = () => {
      setFormState({
        type: 'reset',
        target: { value: oldFormState },
      })
    }

    const handleForward = () => {
      setState({
        target: {
          value: formState,
        },
      })
      if (!isLastStep) {
        return setStepIndex((i: number) => {
          return i + 1
        })
      }
      handleSubmit()
    }

    const handleBack = () => {
      if (!matches) {
        console.log('changes made, alert!')
      }
      if (isFirstStep) {
        return navigate(-1)
      }
      if (!isFirstStep) {
        setStepIndex((i: number) => {
          if (i <= 0) {
            return i
          } else {
            return i - 1
          }
        })
      }
    }

    const handleUpdate = async () => {
      if (matches) {
        setErrorMessage('No changes made')
      } else {
        setState({
          type: 'reset',
          target: { value: formState },
        })
        await update(formState)
        setOldFormState(formState)
      }
    }

    return (
      <>
        <ScrollArea scrollDirection='vertical' className={form_content}>
          <Table
            name='contains'
            rows={{
              inputs: [
                {
                  name: 'item',
                  type: 'select',
                  options: items?.filter((item: any) =>
                    formState.containsFilter?.length > 0
                      ? formState.containsFilter?.some(
                          (categoryItem: any) =>
                            categoryItem.name === item.categoryItem.name
                        )
                      : item
                  ),
                },
                {
                  name: 'quantity',
                  validation: 'num',
                  errorMsg: 'Must be whole numbers only',
                },
              ],
              headers: [
                {
                  value: 'Item',
                },
                {
                  value: 'Quantity',
                },
              ],
            }}
            value={formState.contains}
            addRow={true}
            onChange={setFormState}
          />
        </ScrollArea>
        <FormFooter
          handleBack={handleBack}
          forwardLabel={
            isLastStep
              ? context.type === 'edit'
                ? 'Add New'
                : 'Submit'
              : 'Next'
          }
          handleReset={handleReset}
          handleForward={handleForward}
          backLabel={'Back'}
          handleUpdate={context.type === 'edit' ? handleUpdate : undefined}
        />{' '}
      </>
    )
  }
)

ContainsForm.displayName = 'ContainsForm'

export default ContainsForm
