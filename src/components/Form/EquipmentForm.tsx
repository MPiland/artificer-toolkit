import { Fragment, useEffect } from 'react'
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
import {
  DropdownOption,
  ReducerActionType,
} from '../../utils/types'
import {
  equipment_form_sub_group,
  equipment_sub_group_button,
  form_add_button,
  form_content,
  form_remove_button,
} from './Form.css'
import ScrollArea from '../ScrollArea/ScrollArea'
import Divider from '../Divider/Divider'
import Spinner from '../Spinner/Spinner'
import Group from '../Group/Group'
import { sprinkles } from '../../css/sprinkles.css'
import { TbPlus, TbX } from 'react-icons/tb'
import clsx from 'clsx'
import Collapse from '../Collapse/Collapse'

interface EquipmentProps {
  formState: any
  setFormState: (arg: ReducerActionType) => void
  handleRemove: (arg: string) => void
  handleAdd: (arg: string) => void
}

const EquipmentForm = ({
  formState,
  setFormState,
  handleRemove,
  handleAdd,
}: EquipmentProps) => {
  const isLoading = useIsLoading()

  const { data: builders } = useGetBuildersQuery(undefined)

  const { items } = useGetItemsQuery(undefined, {
    selectFromResult: ({ data }) => ({
      items: data && selectAllItems(data),
    }),
  })

  useEffect(() => {
    if (formState.startingEquipment?.length > 0) {
      const groupIndex = formState.startingEquipment.length - 1
      if (groupIndex >= 0) {
        const optionIndex =
          formState.startingEquipment[groupIndex].option?.length - 1
        if (optionIndex >= 0) {
          if (
            !(
              formState.startingEquipment[groupIndex].option[optionIndex]
                .equipment?.length > 0
            )
          ) {
            setFormState({
              type: 'added',
              target: {
                name: `startingEquipment.${groupIndex}.option.${optionIndex}.equipment`,
              },
            })
          }
        } else {
          setFormState({
            type: 'added',
            target: {
              name: `startingEquipment.${groupIndex}.option`,
            },
          })
        }
      }
    }
  }, [formState.startingEquipment, setFormState])

  return isLoading || !builders || !items ? (
    <Spinner />
  ) : (
    <>
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
              <Collapse
                title={`Option Group ${groupIndex}`}
                handleRemove={() =>
                  handleRemove(`startingEquipment.${groupIndex}`)
                }
                startOpened={true}
                key={groupIndex}
                className={sprinkles({ mb: 'size-3' })}
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
                    (optionItem: any, optionIndex: number) => (
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
                                      options={builders.section.item.attribute}
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
                                        .flatMap(
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
                                                    (equipmentProperty: any) =>
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
              </Collapse>
            )
          }
        )}
      </ScrollArea>
    </>
  )
}

export default EquipmentForm
