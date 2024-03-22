import { Fragment, useEffect, useState } from 'react'
import Grid from '../Grid/Grid'
import Button from '../Button/Button'
import Dropdown from '../Dropdown/Dropdown'
import { useGetBuildersQuery } from '../../features/builder/builderApiSlice'
import {
  selectAllItems,
  useGetItemsQuery,
} from '../../features/item/itemApiSlice'
import Input from '../Input/Input'
import useIsLoading from '../../hooks/useIsLoading'
import {
  DropdownOption,
  FormContext,
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
import Accordion from '../Accordion/Accordion'

interface EquipmentProps {
  formState: any
  context: FormContext
  setFormState: (arg: ReducerActionType) => void
}

const EquipmentForm = ({
  formState,
  context,
  setFormState,
}: EquipmentProps) => {
  const isLoading = useIsLoading()

  const [activeIndex, setActiveIndex] = useState<number | null>(
    context.type !== 'new' ? null : 0
  )

  const { data: builders } = useGetBuildersQuery(undefined)

  const { items } = useGetItemsQuery(undefined, {
    selectFromResult: ({ data }) => ({
      items: data && selectAllItems(data),
    }),
  })

  const toggle = (index: number) => {
    if (activeIndex === index) {
      return setActiveIndex(null)
    }
    setActiveIndex(index)
  }

  useEffect(() => {
    if (formState.equipment?.length > 0) {
      const groupIndex = formState.equipment.length - 1
      if (groupIndex >= 0) {
        const optionIndex = formState.equipment[groupIndex].option?.length - 1
        if (optionIndex >= 0) {
          if (
            !(
              formState.equipment[groupIndex].option[optionIndex].equipment
                ?.length > 0
            )
          ) {
            setFormState({
              type: 'added',
              target: {
                name: `equipment.${groupIndex}.option.${optionIndex}.equipment`,
              },
            })
          }
        } else {
          setFormState({
            type: 'added',
            target: {
              name: `equipment.${groupIndex}.option`,
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
                setActiveIndex(formState?.equipment?.length)
              } else {
                setActiveIndex(0)
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
              formState.equipment?.map(
                (equipmentItem: any, equipmentIndex: number) => {
                  const multipleOptions = equipmentItem.attribute?.some(
                    (attributeItem: any) =>
                      attributeItem.name === 'providesOptions'
                  )
                  return (
                    <Grid
                      className={clsx({
                        [sprinkles({ mb: 'size-3' })]:
                          formState.equipment.length > 1,
                      })}
                      cols={{
                        lg: equipmentItem.category?.some(
                          (categoryItem: any) =>
                            categoryItem.name === 'currency'
                        )
                          ? 7
                          : 5,
                      }}
                      key={equipmentIndex}
                    >
                      <Dropdown
                        name={`equipment.${equipmentIndex}.attribute`}
                        multiSelect={true}
                        options={builders.section.item.attribute}
                        label='Equipment Attributes'
                        value={equipmentItem.attribute}
                        onChange={setFormState}
                      />
                      <Dropdown
                        name={`equipment.${equipmentIndex}.category`}
                        multiSelect={true}
                        label='Item Category'
                        value={equipmentItem.category}
                        options={builders.item.category}
                        onChange={setFormState}
                      />
                      {!equipmentItem.category?.some(
                        (categoryItem: any) => categoryItem.name === 'currency'
                      ) && (
                        <>
                          <Dropdown
                            name={`equipment.${equipmentIndex}.property`}
                            multiSelect={true}
                            label='Item Property'
                            value={equipmentItem.property}
                            options={builders.item.category
                              .filter((bCategoryItem: any) =>
                                equipmentItem.category?.length > 0
                                  ? equipmentItem.category?.some(
                                      (categoryItem: any) =>
                                        categoryItem.name === bCategoryItem.name
                                    )
                                  : bCategoryItem
                              )
                              .flatMap(
                                (categoryItem: any) => categoryItem.property
                              )}
                            onChange={setFormState}
                          />
                          <Dropdown
                            name={`equipment.${equipmentIndex}.type`}
                            multiSelect={true}
                            label='Item Type'
                            value={equipmentItem.type}
                            options={(
                              items as unknown as DropdownOption[]
                            )?.filter(
                              (type) =>
                                (!equipmentItem.category ||
                                  equipmentItem.category.length === 0 ||
                                  (equipmentItem.category?.length > 0 &&
                                    equipmentItem.category.some(
                                      (categoryItem: any) =>
                                        categoryItem.name ===
                                        type.category?.name
                                    ))) &&
                                (!equipmentItem.property ||
                                  equipmentItem.property.length === 0 ||
                                  (equipmentItem.property?.length > 0 &&
                                    type.property?.length > 0 &&
                                    type.property.some((propertyItem: any) =>
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
                              name={`equipment.${equipmentIndex}.selectionCount`}
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
                              name={`equipment.${equipmentIndex}.quantity`}
                              label='Quantity'
                              autoComplete='off'
                              value={equipmentItem.quantity}
                              errorMsg='Must contain only numbers'
                              required={true}
                              onChange={setFormState}
                            />
                          )}
                        </>
                      )}
                      {equipmentItem.category?.some(
                        (categoryItem: any) => categoryItem.name === 'currency'
                      ) && (
                        <>
                          <Input
                            validation='num'
                            name={`equipment.${equipmentIndex}.copper`}
                            label='CP'
                            autoComplete='off'
                            value={equipmentItem.copper}
                            errorMsg='Must contain only numbers'
                            onChange={setFormState}
                          />
                          <Input
                            validation='num'
                            name={`equipment.${equipmentIndex}.silver`}
                            label='SP'
                            autoComplete='off'
                            value={equipmentItem.silver}
                            errorMsg='Must contain only numbers'
                            onChange={setFormState}
                          />
                          <Input
                            validation='num'
                            name={`equipment.${equipmentIndex}.electrum`}
                            label='EP'
                            autoComplete='off'
                            value={equipmentItem.electrum}
                            errorMsg='Must contain only numbers'
                            onChange={setFormState}
                          />
                          <Input
                            validation='num'
                            name={`equipment.${equipmentIndex}.gold`}
                            label='GP'
                            autoComplete='off'
                            value={equipmentItem.gold}
                            errorMsg='Must contain only numbers'
                            onChange={setFormState}
                          />
                          <Input
                            validation='num'
                            name={`equipment.${equipmentIndex}.platinum`}
                            label='PP'
                            autoComplete='off'
                            value={equipmentItem.platinum}
                            errorMsg='Must contain only numbers'
                            onChange={setFormState}
                          />
                        </>
                      )}
                    </Grid>
                  )
                }
              )
            ) : (
              <Accordion
                dataArray={formState.equipment}
                name='equipment'
                setState={setFormState}
              >
                {formState.equipment?.map(
                  (groupItem: any, groupIndex: number) => {
                    return (
                      <Accordion.Container
                        key={groupIndex}
                        itemId={String(groupIndex)}
                      >
                        <Accordion.Header
                          handleClick={() => toggle(groupIndex)}
                          handleRemove={() =>
                            setFormState({
                              type: 'removed',
                              target: { name: `equipment.${groupIndex}` },
                            })
                          }
                          active={activeIndex === groupIndex}
                          key={groupIndex}
                        >
                          {`Equipment Group ${groupIndex + 1}`}
                        </Accordion.Header>
                        <Accordion.Content active={activeIndex === groupIndex}>
                          <Group className={sprinkles({ mb: 'size-3' })}>
                            <Button
                              variant='primary_outline'
                              onClick={() =>
                                setFormState({
                                  type: 'added',
                                  target: {
                                    name: `equipment.${groupIndex}.option`,
                                  },
                                })
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
                                      (
                                        equipmentItem: any,
                                        equipmentIndex: number
                                      ) => {
                                        const multipleOptions =
                                          equipmentItem.attribute?.some(
                                            (attributeItem: any) =>
                                              attributeItem.name ===
                                              'providesOptions'
                                          )
                                        return (
                                          <Group
                                            key={equipmentIndex}
                                            className={equipment_form_sub_group}
                                          >
                                            <Grid
                                              className={clsx({
                                                [sprinkles({ mb: 'size-3' })]:
                                                  optionItem.equipment.length >
                                                  1,
                                              })}
                                              cols={{
                                                lg: equipmentItem.category?.some(
                                                  (categoryItem: any) =>
                                                    categoryItem.name ===
                                                    'currency'
                                                )
                                                  ? 7
                                                  : 5,
                                              }}
                                            >
                                              <Dropdown
                                                name={`equipment.${groupIndex}.option.${optionIndex}.equipment.${equipmentIndex}.attribute`}
                                                multiSelect={true}
                                                options={
                                                  builders.section.item
                                                    .attribute
                                                }
                                                label='Equipment Attributes'
                                                value={equipmentItem.attribute}
                                                onChange={setFormState}
                                              />
                                              <Dropdown
                                                name={`equipment.${groupIndex}.option.${optionIndex}.equipment.${equipmentIndex}.category`}
                                                multiSelect={true}
                                                label='Item Category'
                                                value={equipmentItem.category}
                                                options={builders.item.category}
                                                onChange={setFormState}
                                              />
                                              {!equipmentItem.category?.some(
                                                (categoryItem: any) =>
                                                  categoryItem.name ===
                                                  'currency'
                                              ) && (
                                                <>
                                                  <Dropdown
                                                    name={`equipment.${groupIndex}.option.${optionIndex}.equipment.${equipmentIndex}.property`}
                                                    multiSelect={true}
                                                    label='Item Property'
                                                    value={
                                                      equipmentItem.property
                                                    }
                                                    options={builders.item.category
                                                      .filter(
                                                        (bCategoryItem: any) =>
                                                          equipmentItem.category
                                                            ?.length > 0
                                                            ? equipmentItem.category?.some(
                                                                (
                                                                  categoryItem: any
                                                                ) =>
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
                                                    name={`equipment.${groupIndex}.option.${optionIndex}.equipment.${equipmentIndex}.type`}
                                                    multiSelect={true}
                                                    label='Item Type'
                                                    value={equipmentItem.type}
                                                    options={(
                                                      items as unknown as DropdownOption[]
                                                    )?.filter(
                                                      (type) =>
                                                        (!equipmentItem.category ||
                                                          equipmentItem.category
                                                            .length === 0 ||
                                                          (equipmentItem
                                                            .category?.length >
                                                            0 &&
                                                            equipmentItem.category.some(
                                                              (
                                                                categoryItem: any
                                                              ) =>
                                                                categoryItem.name ===
                                                                type.category
                                                                  ?.name
                                                            ))) &&
                                                        (!equipmentItem.property ||
                                                          equipmentItem.property
                                                            .length === 0 ||
                                                          (equipmentItem
                                                            .property?.length >
                                                            0 &&
                                                            type.property
                                                              ?.length > 0 &&
                                                            type.property.some(
                                                              (
                                                                propertyItem: any
                                                              ) =>
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
                                                      name={`equipment.${groupIndex}.option.${optionIndex}.equipment.${equipmentIndex}.selectionCount`}
                                                      label='# of Selections'
                                                      autoComplete='off'
                                                      value={
                                                        equipmentItem.selectionCount
                                                      }
                                                      errorMsg='Must contain only numbers'
                                                      required={true}
                                                      onChange={setFormState}
                                                    />
                                                  ) : (
                                                    <Input
                                                      validation='num'
                                                      name={`equipment.${groupIndex}.option.${optionIndex}.equipment.${equipmentIndex}.quantity`}
                                                      label='Quantity'
                                                      autoComplete='off'
                                                      value={
                                                        equipmentItem.quantity
                                                      }
                                                      errorMsg='Must contain only numbers'
                                                      required={true}
                                                      onChange={setFormState}
                                                    />
                                                  )}
                                                </>
                                              )}
                                              {equipmentItem.category?.some(
                                                (categoryItem: any) =>
                                                  categoryItem.name ===
                                                  'currency'
                                              ) && (
                                                <>
                                                  <Input
                                                    validation='num'
                                                    name={`equipment.${groupIndex}.option.${optionIndex}.equipment.${equipmentIndex}.copper`}
                                                    label='CP'
                                                    autoComplete='off'
                                                    value={equipmentItem.copper}
                                                    errorMsg='Must contain only numbers'
                                                    onChange={setFormState}
                                                  />
                                                  <Input
                                                    validation='num'
                                                    name={`equipment.${groupIndex}.option.${optionIndex}.equipment.${equipmentIndex}.silver`}
                                                    label='SP'
                                                    autoComplete='off'
                                                    value={equipmentItem.silver}
                                                    errorMsg='Must contain only numbers'
                                                    onChange={setFormState}
                                                  />
                                                  <Input
                                                    validation='num'
                                                    name={`equipment.${groupIndex}.option.${optionIndex}.equipment.${equipmentIndex}.electrum`}
                                                    label='EP'
                                                    autoComplete='off'
                                                    value={
                                                      equipmentItem.electrum
                                                    }
                                                    errorMsg='Must contain only numbers'
                                                    onChange={setFormState}
                                                  />
                                                  <Input
                                                    validation='num'
                                                    name={`equipment.${groupIndex}.option.${optionIndex}.equipment.${equipmentIndex}.gold`}
                                                    label='GP'
                                                    autoComplete='off'
                                                    value={equipmentItem.gold}
                                                    errorMsg='Must contain only numbers'
                                                    onChange={setFormState}
                                                  />
                                                  <Input
                                                    validation='num'
                                                    name={`equipment.${groupIndex}.option.${optionIndex}.equipment.${equipmentIndex}.platinum`}
                                                    label='PP'
                                                    autoComplete='off'
                                                    value={
                                                      equipmentItem.platinum
                                                    }
                                                    errorMsg='Must contain only numbers'
                                                    onChange={setFormState}
                                                  />
                                                </>
                                              )}
                                            </Grid>
                                            <Button
                                              variant='unstyled'
                                              className={clsx(
                                                form_remove_button,
                                                equipment_sub_group_button
                                              )}
                                              onClick={() => {
                                                if (
                                                  optionItem.equipment
                                                    .length === 1
                                                ) {
                                                  if (
                                                    groupItem.option.length ===
                                                    1
                                                  ) {
                                                    setFormState({
                                                      type: 'removed',
                                                      target: {
                                                        name: `equipment.${groupIndex}`,
                                                      },
                                                    })
                                                  } else {
                                                    setFormState({
                                                      type: 'removed',
                                                      target: {
                                                        name: `equipment.${groupIndex}.option.${optionIndex}`,
                                                      },
                                                    })
                                                  }
                                                } else {
                                                  setFormState({
                                                    type: 'removed',
                                                    target: {
                                                      name: `equipment.${groupIndex}.option.${optionIndex}.equipment.${equipmentIndex}`,
                                                    },
                                                  })
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
                                                setFormState({
                                                  type: 'added',
                                                  target: {
                                                    name: `equipment.${groupIndex}.option.${optionIndex}.equipment`,
                                                  },
                                                })
                                              }
                                            >
                                              <TbPlus />
                                            </Button>
                                          </Group>
                                        )
                                      }
                                    )}
                                  </>
                                  {optionIndex !==
                                    groupItem.option?.length - 1 && (
                                    <Divider label={'OR'} />
                                  )}
                                </Fragment>
                              )
                            )}
                        </Accordion.Content>
                      </Accordion.Container>
                    )
                  }
                )}
              </Accordion>
            )}
          </>
        )}
      </ScrollArea>
    </>
  )
}

export default EquipmentForm
