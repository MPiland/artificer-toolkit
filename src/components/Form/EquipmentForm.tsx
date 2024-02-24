import { FC, useState, useReducer, useEffect, Fragment } from 'react'
import { FetchBaseQueryError } from '@reduxjs/toolkit/query'
import { SerializedError } from '@reduxjs/toolkit'
import Grid from '../Grid/Grid'
import Button from '../Button/Button'
import Dropdown from '../Dropdown/Dropdown'
import { useGetBuildersQuery } from '../../features/builders/buildersApiSlice'
import {
  selectAllItems,
  useGetItemsQuery,
} from '../../features/items/itemsApiSlice'
import Input from '../Input/Input'
import useIsLoading from '../../hooks/useIsLoading'
import { DropdownOption, ReducerActionType } from '../../utils/types'
import {
  equipment_form_sub_group,
  equipment_sub_group_button,
  form_add_button,
  form_content,
  form_remove_button,
  form_wrapper,
} from './Form.css'
import FormFooter from './FormFooter'
import { useNavigate } from 'react-router-dom'
import ScrollArea from '../ScrollArea/ScrollArea'
import formReducer from '../../hooks/useReducer'
import { isEqual } from 'lodash'
import Divider from '../Divider/Divider'
import Spinner from '../Spinner/Spinner'
import Card from '../Card/Card'
import Group from '../Group/Group'
import { sprinkles } from '../../css/sprinkles.css'
import { TbPlus, TbX } from 'react-icons/tb'
import clsx from 'clsx'

interface EquipmentProps {
  state: any
  setState: (arg: ReducerActionType) => void
  context: {
    type: 'edit' | 'create'
    title: string
  }
  isLastStep?: boolean
  isFirstStep?: boolean
  setStepIndex: (arg: (i: number) => number) => void
  handleSubmit: () => Promise<void>
  update: (
    arg: any
  ) => Promise<{ data: any } | { error: FetchBaseQueryError | SerializedError }>
  setErrorMessage: (arg: string) => void
}

const EquipmentForm: FC<EquipmentProps> = ({
  state,
  setState,
  context,
  isLastStep,
  isFirstStep,
  setStepIndex,
  handleSubmit,
  update,
  setErrorMessage,
}) => {
  const [formState, setFormState] = useReducer(formReducer, state)
  const [oldFormState, setOldFormState] = useState<any>(formState)
  const [matches, setMatches] = useState<boolean>(false)

  const navigate = useNavigate()
  const isLoading = useIsLoading()

  const { data: builders } = useGetBuildersQuery(undefined)

  const { items } = useGetItemsQuery(undefined, {
    selectFromResult: ({ data }) => ({
      items: data && selectAllItems(data),
    }),
  })

  useEffect(() => {
    if (isEqual(formState, oldFormState)) {
      setMatches(true)
    } else {
      setMatches(false)
    }
  }, [formState, oldFormState])

  const handleAdd = (name: string) => {
    setFormState({
      type: 'added',
      target: { name: name },
    })
  }

  const handleRemove = (name: string) => {
    setFormState({
      type: 'removed',
      target: { name: name },
    })
  }

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

  return isLoading || !builders || !items ? (
    <Spinner />
  ) : (
    <div className={form_wrapper}>
      <Group className={sprinkles({ mb: 'size-3', px: 'size-3' })}>
        <Button
          variant='primary_outline'
          onClick={() => handleAdd('startingEquipment')}
        >
          Add Equipment Group
        </Button>
      </Group>
      <ScrollArea scrollDirection='vertical' className={form_content}>
        {formState.startingEquipment?.map(
          (groupItem: any, groupIndex: number) => {
            return (
              <Card
                handleRemove={() =>
                  handleRemove(`startingEquipment.${groupIndex}`)
                }
                key={groupIndex}
              >
                <Group className={sprinkles({ mb: 'size-3' })}>
                  <Button
                    variant='primary_outline'
                    onClick={() =>
                      handleAdd(`startingEquipment.${groupIndex}.option`)
                    }
                  >
                    Add Option
                  </Button>
                </Group>
                {groupItem.option?.length > 0 &&
                  groupItem.option?.map(
                    (optionItem: any, optionIndex: number) =>
                      !(optionItem.equipment?.length > 0) ? (
                        handleAdd(
                          `startingEquipment.${groupIndex}.option.${optionIndex}.equipment`
                        )
                      ) : (
                        <Fragment key={optionIndex}>
                          <>
                            {optionItem.equipment?.map(
                              (equipmentItem: any, equipmentIndex: number) => {
                                const multipleOptions =
                                  equipmentItem.attribute?.some(
                                    (attributeItem: any) =>
                                      attributeItem.name === 'providesOptions'
                                  )
                                return (
                                  <Group
                                    key={equipmentIndex}
                                    className={equipment_form_sub_group}
                                  >
                                    <Grid
                                      className={clsx({
                                        [sprinkles({ mb: 'size-3' })]:
                                          optionItem.equipment.length > 1,
                                      })}
                                    >
                                      <Dropdown
                                        name={`startingEquipment.${groupIndex}.option.${optionIndex}.equipment.${equipmentIndex}.attribute`}
                                        multiSelect={true}
                                        options={
                                          builders.section.item.attribute
                                        }
                                        label='Option Attributes'
                                        value={equipmentItem.attribute}
                                        onChange={setFormState}
                                      />
                                      <Dropdown
                                        name={`startingEquipment.${groupIndex}.option.${optionIndex}.equipment.${equipmentIndex}.category`}
                                        multiSelect={true}
                                        label='Item Category'
                                        value={equipmentItem.category}
                                        options={builders.item.category}
                                        onChange={setFormState}
                                      />

                                      <Dropdown
                                        name={`startingEquipment.${groupIndex}.option.${optionIndex}.equipment.${equipmentIndex}.property`}
                                        multiSelect={true}
                                        label='Item Property'
                                        value={equipmentItem.property}
                                        options={builders.item.category
                                          .filter((bCategoryItem: any) =>
                                            equipmentItem.category?.length > 0
                                              ? equipmentItem.category?.some(
                                                  (categoryItem: any) =>
                                                    categoryItem.name ===
                                                    bCategoryItem.name
                                                )
                                              : bCategoryItem
                                          )
                                          .map(
                                            (categoryItem: any) =>
                                              categoryItem.property
                                          )}
                                        onChange={setFormState}
                                      />
                                      <Dropdown
                                        name={`startingEquipment.${groupIndex}.option.${optionIndex}.equipment.${equipmentIndex}.itemType`}
                                        multiSelect={true}
                                        label='Item Type'
                                        value={equipmentItem.itemType}
                                        options={(
                                          items as unknown as DropdownOption[]
                                        )?.filter(
                                          (itemType) =>
                                            (!equipmentItem.category ||
                                              equipmentItem.category.length ===
                                                0 ||
                                              (equipmentItem.category?.length >
                                                0 &&
                                                equipmentItem.category.some(
                                                  (categoryItem: any) =>
                                                    categoryItem.name ===
                                                    itemType.category?.name
                                                ))) &&
                                            (!equipmentItem.property ||
                                              equipmentItem.property.length ===
                                                0 ||
                                              (equipmentItem.property?.length >
                                                0 &&
                                                itemType.property?.length > 0 &&
                                                itemType.property.some(
                                                  (propertyItem: any) =>
                                                    equipmentItem.property.some(
                                                      (
                                                        equipmentProperty: any
                                                      ) =>
                                                        equipmentProperty.name ===
                                                        propertyItem.name
                                                    )
                                                )))
                                        )}
                                        onChange={setFormState}
                                      />
                                      {multipleOptions ? (
                                        <Input
                                          validation='num'
                                          name={`startingEquipment.${groupIndex}.option.${optionIndex}.equipment.${equipmentIndex}.selectionCount`}
                                          label='# of Selections'
                                          autoComplete='off'
                                          value={equipmentItem.selectionCount}
                                          errorMsg='Must contain only numbers'
                                          required={true}
                                          onChange={setFormState}
                                        />
                                      ) : (
                                        <Input
                                          validation='num'
                                          name={`startingEquipment.${groupIndex}.option.${optionIndex}.equipment.${equipmentIndex}.quantity`}
                                          label='Quantity'
                                          autoComplete='off'
                                          value={equipmentItem.quantity}
                                          errorMsg='Must contain only numbers'
                                          required={true}
                                          onChange={setFormState}
                                        />
                                      )}
                                    </Grid>
                                    <Button
                                      variant='unstyled'
                                      className={clsx(
                                        form_remove_button,
                                        equipment_sub_group_button
                                      )}
                                      onClick={() => {
                                        if (optionItem.equipment.length === 1) {
                                          if (groupItem.option.length === 1) {
                                            handleRemove(
                                              `startingEquipment.${groupIndex}`
                                            )
                                          } else {
                                            handleRemove(
                                              `startingEquipment.${groupIndex}.option.${optionIndex}`
                                            )
                                          }
                                        } else {
                                          handleRemove(
                                            `startingEquipment.${groupIndex}.option.${optionIndex}.equipment.${equipmentIndex}`
                                          )
                                        }
                                      }}
                                    >
                                      <TbX />
                                    </Button>
                                    <Button
                                      variant='unstyled'
                                      className={clsx(
                                        form_add_button,
                                        equipment_sub_group_button
                                      )}
                                      onClick={() =>
                                        handleAdd(
                                          `startingEquipment.${groupIndex}.option.${optionIndex}.equipment`
                                        )
                                      }
                                    >
                                      <TbPlus />
                                    </Button>
                                  </Group>
                                )
                              }
                            )}
                          </>
                          {optionIndex !== groupItem.option?.length - 1 && (
                            <Divider label={'OR'} />
                          )}
                        </Fragment>
                      )
                  )}
              </Card>
            )
          }
        )}
      </ScrollArea>
      <FormFooter
        handleBack={handleBack}
        forwardLabel={
          isLastStep ? (context.type === 'edit' ? 'Add New' : 'Submit') : 'Next'
        }
        handleReset={handleReset}
        handleForward={handleForward}
        backLabel={'Back'}
        handleUpdate={context.type === 'edit' ? handleUpdate : undefined}
      />
    </div>
  )
}

export default EquipmentForm
