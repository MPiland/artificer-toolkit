import { Fragment } from 'react'
import { TbPlus, TbX } from 'react-icons/tb'
import { Grid, UnstyledButton } from '@mantine/core'
import { row_button } from '@/components/Form/Form.css'
import { Attributes, Equipments } from '@/enums'
import { useSystemData, useEquipmentData, useFieldUpdates } from '@/hooks'
import { withFieldGroup } from '@/components/Form'
import type { ClassInput, BackgroundInput, EquipmentOptionItemInput } from 'gql/types'
import { useTypedFormStore } from '@/store'

const EquipmentOptionItem = withFieldGroup({
  defaultValues: {
    currencies: [] as EquipmentOptionItemInput['currencies'] | null,
    equipment: [] as EquipmentOptionItemInput['equipment'] | null,
    equipmentOptionItem: {} as EquipmentOptionItemInput | null | undefined,
    properties: [] as EquipmentOptionItemInput['properties'] | null,
    selectionCount: 0 as EquipmentOptionItemInput['selectionCount'] | null,
    attributes: [] as EquipmentOptionItemInput['attributes'] | null,
    quantity: 0 as EquipmentOptionItemInput['quantity'] | null,
    category: '' as EquipmentOptionItemInput['category'] | null,
  },
  props: {
    __kind: '' as 'ClassInput' | 'BackgroundInput',
    index: 0 as number,
    optionIndex: 0 as number,
    groupIndex: 0 as number,
    addFn: (() => {}) as () => void,
    removeFn: (() => {}) as () => void,
  },
  render: function Render({ group, __kind, addFn, removeFn, index, optionIndex, groupIndex }) {
    const store = useTypedFormStore<ClassInput | BackgroundInput>()
    const category = store((state) => state.current?.equipment?.[groupIndex]?.[optionIndex]?.[index]?.category)
    const properties = store((state) => state?.current?.equipment?.[groupIndex]?.[optionIndex]?.[index]?.properties)
    const attributes = store((state) => state?.current?.equipment?.[groupIndex]?.[optionIndex]?.[index]?.attributes)
    const stepIndex = store((state) => state.stepIndex)

    const { attributes: systemAttributes, equipment, currencies: systemCurrencies } = useSystemData()

    const {
      equipment: { filterByCategory },
    } = useEquipmentData()

    const { AppField } = group

    const { fieldListeners, fieldValidators } = useFieldUpdates({
      data: 'form',
      stepIndex,
    })

    const renderCurrencyInputs = () => {
      return (
        <Grid.Col>
          <Grid>
            <AppField name='currencies' mode='array'>
              {(currencies) =>
                currencies.state.value?.length &&
                currencies.state.value.map((_, i) => (
                  <AppField
                    name={`currencies[${i}].amount`}
                    key={`equipmentOptionItem-currency-${i}`}
                    listeners={fieldListeners}
                    validators={fieldValidators({
                      onChange: { type: 'number', min: 0, name: systemCurrencies[i].label },
                    })}
                  >
                    {({ TextField }) => (
                      <Grid.Col key={`${i}-equipment-group-item-currency`} span={{ sm: 6, md: 4, lg: 'auto' }}>
                        <TextField label={systemCurrencies[i].label} />
                      </Grid.Col>
                    )}
                  </AppField>
                ))
              }
            </AppField>
          </Grid>
        </Grid.Col>
      )
    }

    const renderEquipmentInputs = () => (
      <>
        <AppField name='properties' listeners={fieldListeners}>
          {({ DropdownField }) => (
            <Grid.Col span={{ sm: 6, md: 4, lg: 'auto' }}>
              <DropdownField
                multiselect={true}
                label='Equipment Properties'
                options={equipment.properties.filterByCategory(category)}
              />
            </Grid.Col>
          )}
        </AppField>
        <AppField name='equipment' listeners={fieldListeners}>
          {({ DropdownField }) => (
            <Grid.Col span={{ sm: 6, md: 4, lg: 'auto' }}>
              <DropdownField
                multiselect={true}
                label='Equipment'
                options={filterByCategory(category).filterByEveryProperty(properties)}
              />
            </Grid.Col>
          )}
        </AppField>
        {attributes?.some((attribute) => attribute === Attributes.PROVIDES_OPTIONS) ?
          <AppField
            name='selectionCount'
            validators={fieldValidators({
              onChange: { type: 'integer', min: 1, name: 'Selection count' },
              onBlur: 'Please enter a selection amount',
            })}
            listeners={fieldListeners}
          >
            {({ TextField }) => (
              <Grid.Col span={{ sm: 6, md: 4, lg: 'auto' }}>
                <TextField label='# of Selections' required={true} />
              </Grid.Col>
            )}
          </AppField>
        : <AppField
            name='quantity'
            validators={fieldValidators({
              onChange: { type: 'integer', min: 1, name: 'Quantity' },
              onBlur: 'Please enter a quantity amount',
            })}
            listeners={fieldListeners}
          >
            {({ TextField }) => (
              <Grid.Col span={{ sm: 6, md: 4, lg: 'auto' }}>
                <TextField label='Quantity' required={true} />
              </Grid.Col>
            )}
          </AppField>
        }
      </>
    )

    return (
      <Fragment>
        <Grid.Col span={11}>
          <Grid>
            <AppField name='attributes' listeners={fieldListeners}>
              {({ DropdownField }) => (
                <Grid.Col span={{ sm: 6, md: 4, lg: 'auto' }}>
                  <DropdownField
                    label='Equipment Attributes'
                    multiselect={true}
                    options={systemAttributes.filter(
                      (attribute) =>
                        attribute?.equipment?.length &&
                        ((__kind === 'ClassInput' && attribute?.equipment?.includes(Equipments.CLASS)) ||
                          (__kind === 'BackgroundInput' && attribute?.equipment?.includes(Equipments.BACKGROUND)))
                    )}
                  />
                </Grid.Col>
              )}
            </AppField>
            <AppField name='category' listeners={fieldListeners}>
              {({ DropdownField }) => (
                <Grid.Col span={{ sm: 6, md: 4, lg: 'auto' }}>
                  <DropdownField label='Equipment Category' options={equipment.categories} />
                </Grid.Col>
              )}
            </AppField>
            {renderEquipmentInputs()}
            {attributes?.some((attribute) => attribute === Attributes?.CONTAINS_CURRENCY) && renderCurrencyInputs()}
          </Grid>
        </Grid.Col>
        <Grid.Col span={'auto'}>
          <UnstyledButton className={row_button} onClick={() => addFn()}>
            <TbPlus />
          </UnstyledButton>
          <UnstyledButton className={row_button} onClick={() => removeFn()}>
            <TbX />
          </UnstyledButton>
        </Grid.Col>
      </Fragment>
    )
  },
})

export default EquipmentOptionItem
