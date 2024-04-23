import { Fragment, useEffect, useState } from 'react'
import Grid from '../../Grid/Grid'
import Button from '../../Button/Button'
import Dropdown from '../../Dropdown/Dropdown'
import { useGetBuildersQuery } from '../../../features/builder/builderApiSlice'
import { selectAllItems, useGetItemsQuery } from '../../../features/item/itemApiSlice'
import Input from '../../Input/Input'
import useIsLoading from '../../../hooks/useIsLoading'
import { DropdownOption, FormContext, ReducerActionType } from '../../../utils/types'
import { equipment_form_sub_group, equipment_sub_group_button, form_add_button, form_content, form_remove_button } from '../Form.css'
import ScrollArea from '../../ScrollArea/ScrollArea'
import Divider from '../../Divider/Divider'
import Spinner from '../../Spinner/Spinner'
import Group from '../../Group/Group'
import { sprinkles } from '../../../css/sprinkles.css'
import { TbPlus, TbX } from 'react-icons/tb'
import clsx from 'clsx'
import Accordion from '../../Accordion/Accordion'

interface EquipmentProps {
  formState: any
  context: FormContext
  setFormState: (arg: ReducerActionType) => void
}

const EquipmentForm = ({ formState, context, setFormState }: EquipmentProps) => {
  const isLoading = useIsLoading()

  const [activequipmentIndex, setActivequipmentIndex] = useState<number | null>(context.type !== 'new' ? null : 0)

  const { data: builders } = useGetBuildersQuery(undefined)

  const { items } = useGetItemsQuery(undefined, {
    selectFromResult: ({ data }) => ({
      items: data && selectAllItems(data),
    }),
  })

  const toggle = (index: number) => {
    if (activequipmentIndex === index) {
      return setActivequipmentIndex(null)
    }
    setActivequipmentIndex(index)
  }

  useEffect(() => {
    if (formState.equipment?.length > 0) {
      const equipmentIndex = formState.equipment?.length - 1
      if (equipmentIndex >= 0) {
        const optionIndex = formState.equipment[equipmentIndex].option?.length - 1
        if (optionIndex >= 0) {
          if (!(formState.equipment[equipmentIndex].option[optionIndex]?.group?.length > 0)) {
            setFormState({
              type: 'added',
              target: {
                name: `equipment.${equipmentIndex}.option.${optionIndex}.group`,
              },
            })
          }
        } else {
          setFormState({
            type: 'added',
            target: {
              name: `equipment.${equipmentIndex}.option`,
            },
          })
        }
      }
    }
  }, [formState.equipment, setFormState])

  return isLoading || !builders || !items ? (
    <Spinner />
  ) : (
    <>
      <Group className={sprinkles({ mb: 'size-3', px: 'size-3' })}>
        {context.title === 'class' && (
          <Button
            variant='primary_outline'
            onClick={() => {
              if (formState?.equipment?.length > 0) {
                setActivequipmentIndex(formState?.equipment?.length)
              } else {
                setActivequipmentIndex(0)
              }
              setFormState({
                type: 'added',
                target: { name: 'equipment' },
              })
            }}
          >
            Add Equipment Group
          </Button>
        )}
      </Group>
      <ScrollArea scrollDirection='vertical' className={form_content}>
        {formState.equipment && (
          <>
            {context.title !== 'class' ? (
              formState.equipment?.map((groupItem: any, groupIndex: number) => {
                const multipleOptions = groupItem.attribute?.some((attributequipmentItem: any) => attributequipmentItem.name === 'providesOptions')
                return (
                  <Grid
                    className={clsx({
                      [sprinkles({ mb: 'size-3' })]: formState.equipment?.length > 1,
                    })}
                    cols={{
                      lg: groupItem.category?.some((categoryItem: any) => categoryItem.name === 'currency') ? 7 : 5,
                    }}
                    key={groupIndex}
                  >
                    <Dropdown
                      name={`equipment.${groupIndex}.attribute`}
                      multiSelect={true}
                      options={builders.section.item.attribute}
                      label='Equipment Attributes'
                      value={groupItem.attribute}
                      onChange={setFormState}
                    />
                    <Dropdown
                      name={`equipment.${groupIndex}.category`}
                      label='Item Category'
                      value={groupItem.category}
                      options={builders.item.category}
                      onChange={setFormState}
                    />
                    {!groupItem.category?.some((categoryItem: any) => categoryItem.name === 'currency') && (
                      <>
                        <Dropdown
                          name={`equipment.${groupIndex}.property.type`}
                          multiSelect={true}
                          label='Item Property'
                          value={groupItem.property?.type}
                          options={builders.item.category
                            .filter((bCategoryItem: any) => (groupItem.category?._id ? groupItem.category?._id === bCategoryItem._id : bCategoryItem))
                            .flatMap((bCategoryItem: any) => bCategoryItem.property)}
                          onChange={setFormState}
                        />
                        <Dropdown
                          name={`equipment.${groupIndex}.item.type`}
                          multiSelect={true}
                          label='Item Type'
                          value={groupItem.item?.type}
                          options={(items as unknown as DropdownOption[])?.filter(
                            (type) =>
                              groupItem.category?._id &&
                              groupItem.category?._id === type.category?._id &&
                              (!groupItem.property?.type ||
                                groupItem.property?.type?.length === 0 ||
                                (groupItem.property?.type?.length > 0 &&
                                  type.property?.length > 0 &&
                                  type.property.some((propertyItem: any) =>
                                    groupItem.property?.type?.some((equipmentProperty: any) => equipmentProperty.name === propertyItem.name)
                                  )))
                          )}
                          onChange={setFormState}
                        />
                        {multipleOptions ? (
                          <Input
                            validation='num'
                            name={`equipment.${groupIndex}.selectionCount`}
                            label='# of Selections'
                            autoComplete='off'
                            value={groupItem.selectionCount}
                            errorMsg='Must contain only numbers'
                            required={true}
                            onChange={setFormState}
                          />
                        ) : (
                          <Input
                            validation='num'
                            name={`equipment.${groupIndex}.quantity`}
                            label='Quantity'
                            autoComplete='off'
                            value={groupItem.quantity}
                            errorMsg='Must contain only numbers'
                            required={true}
                            onChange={setFormState}
                          />
                        )}
                      </>
                    )}
                    {groupItem.category?.some((categoryItem: any) => categoryItem.name === 'currency') && (
                      <>
                        <Input
                          validation='num'
                          name={`equipment.${groupIndex}.copper`}
                          label='CP'
                          autoComplete='off'
                          value={groupItem.copper}
                          errorMsg='Must contain only numbers'
                          onChange={setFormState}
                        />
                        <Input
                          validation='num'
                          name={`equipment.${groupIndex}.silver`}
                          label='SP'
                          autoComplete='off'
                          value={groupItem.silver}
                          errorMsg='Must contain only numbers'
                          onChange={setFormState}
                        />
                        <Input
                          validation='num'
                          name={`equipment.${groupIndex}.electrum`}
                          label='EP'
                          autoComplete='off'
                          value={groupItem.electrum}
                          errorMsg='Must contain only numbers'
                          onChange={setFormState}
                        />
                        <Input
                          validation='num'
                          name={`equipment.${groupIndex}.gold`}
                          label='GP'
                          autoComplete='off'
                          value={groupItem.gold}
                          errorMsg='Must contain only numbers'
                          onChange={setFormState}
                        />
                        <Input
                          validation='num'
                          name={`equipment.${groupIndex}.platinum`}
                          label='PP'
                          autoComplete='off'
                          value={groupItem.platinum}
                          errorMsg='Must contain only numbers'
                          onChange={setFormState}
                        />
                      </>
                    )}
                  </Grid>
                )
              })
            ) : (
              <Accordion dataArray={formState.equipment} name='equipment' setState={setFormState}>
                {formState.equipment?.map((equipmentItem: any, equipmentIndex: number) => {
                  return (
                    <Accordion.Container key={equipmentIndex} itemId={String(equipmentIndex)}>
                      <Accordion.Header
                        handleClick={() => toggle(equipmentIndex)}
                        handleRemove={() =>
                          setFormState({
                            type: 'removed',
                            target: { name: `equipment.${equipmentIndex}` },
                          })
                        }
                        active={activequipmentIndex === equipmentIndex}
                        key={equipmentIndex}
                      >
                        {`Equipment Group ${equipmentIndex + 1}`}
                      </Accordion.Header>
                      <Accordion.Content active={activequipmentIndex === equipmentIndex}>
                        <Group className={sprinkles({ mb: 'size-3' })}>
                          <Button
                            variant='primary_outline'
                            onClick={() => {
                              const optionIndex = equipmentItem.option?.length
                              setFormState({
                                type: 'added',
                                target: {
                                  name: `equipment.${equipmentIndex}.option.${optionIndex}.group`,
                                },
                              })
                            }}
                          >
                            Add Option
                          </Button>
                        </Group>
                        {equipmentItem.option?.length > 0 &&
                          equipmentItem.option?.map((optionItem: any, optionIndex: number) => (
                            <Fragment key={optionIndex}>
                              <>
                                {optionItem.group?.map((groupItem: any, groupIndex: number) => {
                                  const multipleOptions = groupItem.attribute?.some(
                                    (attributequipmentItem: any) => attributequipmentItem.name === 'providesOptions'
                                  )
                                  return (
                                    <Group key={groupIndex} className={equipment_form_sub_group}>
                                      <Grid
                                        className={clsx({
                                          [sprinkles({ mb: 'size-3' })]: optionItem.group.length > 1,
                                        })}
                                        cols={{
                                          lg: groupItem.category?.name === 'currency' ? 7 : 5,
                                        }}
                                      >
                                        <Dropdown
                                          name={`equipment.${equipmentIndex}.option.${optionIndex}.group.${groupIndex}.attribute`}
                                          multiSelect={true}
                                          options={builders.section.item.attribute}
                                          label='Equipment Attributes'
                                          value={groupItem.attribute}
                                          onChange={setFormState}
                                        />
                                        <Dropdown
                                          name={`equipment.${equipmentIndex}.option.${optionIndex}.group.${groupIndex}.category`}
                                          label='Item Category'
                                          value={groupItem.category}
                                          options={builders.item.category}
                                          onChange={setFormState}
                                        />
                                        {groupItem.category?.name !== 'currency' && (
                                          <>
                                            <Dropdown
                                              name={`equipment.${equipmentIndex}.option.${optionIndex}.group.${groupIndex}.property.type`}
                                              multiSelect={true}
                                              label='Item Property'
                                              value={groupItem.property?.type}
                                              options={builders.item.category
                                                .filter((categoryItem: any) => categoryItem._id === groupItem.category?._id)
                                                .flatMap((categoryItem: any) => categoryItem.property?.type)}
                                              onChange={setFormState}
                                            />
                                            <Dropdown
                                              name={`equipment.${equipmentIndex}.option.${optionIndex}.group.${groupIndex}.item.type`}
                                              multiSelect={true}
                                              label='Item Type'
                                              value={groupItem.item?.type}
                                              options={(items as unknown as DropdownOption[])
                                                ?.filter((item: any) => (groupItem.category?._id ? item.category._id === groupItem.category?._id : item))
                                                .filter((item: any) =>
                                                  groupItem.property?.type?.length > 0
                                                    ? item.property?.type?.length > 0 &&
                                                      groupItem.property?.type?.every((groupProperty: any) =>
                                                        item.property?.type?.some((itemProperty: any) => itemProperty._id === groupProperty._id)
                                                      )
                                                    : item
                                                )}
                                              onChange={setFormState}
                                            />
                                            {multipleOptions ? (
                                              <Input
                                                validation='num'
                                                name={`equipment.${equipmentIndex}.option.${optionIndex}.group.${groupIndex}.selectionCount`}
                                                label='# of Selections'
                                                autoComplete='off'
                                                value={groupItem.selectionCount}
                                                errorMsg='Must contain only numbers'
                                                required={true}
                                                onChange={setFormState}
                                              />
                                            ) : (
                                              <Input
                                                validation='num'
                                                name={`equipment.${equipmentIndex}.option.${optionIndex}.group.${groupIndex}.quantity`}
                                                label='Quantity'
                                                autoComplete='off'
                                                value={groupItem.quantity}
                                                errorMsg='Must contain only numbers'
                                                required={true}
                                                onChange={setFormState}
                                              />
                                            )}
                                          </>
                                        )}
                                        {groupItem.category?.name === 'currency' && (
                                          <>
                                            <Input
                                              validation='num'
                                              name={`equipment.${equipmentIndex}.option.${optionIndex}.group.${groupIndex}.copper`}
                                              label='CP'
                                              autoComplete='off'
                                              value={groupItem.copper}
                                              errorMsg='Must contain only numbers'
                                              onChange={setFormState}
                                            />
                                            <Input
                                              validation='num'
                                              name={`equipment.${equipmentIndex}.option.${optionIndex}.group.${groupIndex}.silver`}
                                              label='SP'
                                              autoComplete='off'
                                              value={groupItem.silver}
                                              errorMsg='Must contain only numbers'
                                              onChange={setFormState}
                                            />
                                            <Input
                                              validation='num'
                                              name={`equipment.${equipmentIndex}.option.${optionIndex}.group.${groupIndex}.electrum`}
                                              label='EP'
                                              autoComplete='off'
                                              value={groupItem.electrum}
                                              errorMsg='Must contain only numbers'
                                              onChange={setFormState}
                                            />
                                            <Input
                                              validation='num'
                                              name={`equipment.${equipmentIndex}.option.${optionIndex}.group.${groupIndex}.gold`}
                                              label='GP'
                                              autoComplete='off'
                                              value={groupItem.gold}
                                              errorMsg='Must contain only numbers'
                                              onChange={setFormState}
                                            />
                                            <Input
                                              validation='num'
                                              name={`equipment.${equipmentIndex}.option.${optionIndex}.group.${groupIndex}.platinum`}
                                              label='PP'
                                              autoComplete='off'
                                              value={groupItem.platinum}
                                              errorMsg='Must contain only numbers'
                                              onChange={setFormState}
                                            />
                                          </>
                                        )}
                                      </Grid>
                                      <Button
                                        variant='unstyled'
                                        className={clsx(form_remove_button, equipment_sub_group_button)}
                                        onClick={() => {
                                          if (optionItem.equipment?.length === 1) {
                                            if (equipmentItem.option.length === 1) {
                                              setFormState({
                                                type: 'removed',
                                                target: {
                                                  name: `equipment.${equipmentIndex}`,
                                                },
                                              })
                                            } else {
                                              setFormState({
                                                type: 'removed',
                                                target: {
                                                  name: `equipment.${equipmentIndex}.option.${optionIndex}`,
                                                },
                                              })
                                            }
                                          } else {
                                            setFormState({
                                              type: 'removed',
                                              target: {
                                                name: `equipment.${equipmentIndex}.option.${optionIndex}.group.${groupIndex}`,
                                              },
                                            })
                                          }
                                        }}
                                      >
                                        <TbX />
                                      </Button>
                                      <Button
                                        variant='unstyled'
                                        className={clsx(form_add_button, equipment_sub_group_button)}
                                        onClick={() =>
                                          setFormState({
                                            type: 'added',
                                            target: {
                                              name: `equipment.${equipmentIndex}.option.${optionIndex}.group`,
                                            },
                                          })
                                        }
                                      >
                                        <TbPlus />
                                      </Button>
                                    </Group>
                                  )
                                })}
                              </>
                              {optionIndex !== equipmentItem.option?.length - 1 && <Divider label={'OR'} />}
                            </Fragment>
                          ))}
                      </Accordion.Content>
                    </Accordion.Container>
                  )
                })}
              </Accordion>
            )}
          </>
        )}
      </ScrollArea>
    </>
  )
}

export default EquipmentForm
