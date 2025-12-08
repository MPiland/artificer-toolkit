import { Fragment } from 'react'
import { TbPlus, TbX } from 'react-icons/tb'
import { Grid, UnstyledButton } from '@mantine/core'
import { row_button } from '~components/Form/Form.css'
import { Attributes, Equipments } from '~enums'
import { useSystemData, useFieldUpdates, useFormField } from '~hooks'
import type { ClassInput, BackgroundInput } from 'gql/types'
import { useOptimizedSelector, useTypedFormStore } from '~store'
import { useListEquipment } from '~apis'

const EquipmentOptionItem = ({
  index,
  optionIndex,
  groupIndex,
  addFn,
  removeFn,
}: {
  index: number
  optionIndex: number
  groupIndex: number
  addFn: () => void
  removeFn: () => void
}) => {
  const store = useTypedFormStore<ClassInput | BackgroundInput>()

  const { AppField } = useFormField({ store })

  const { category, properties, attributes, __kind } = useOptimizedSelector(store, (state) => ({
    __kind: state.current?.__kind,
    category: state.current?.equipment?.[groupIndex]?.[optionIndex]?.[index]?.category,
    properties: state.current?.equipment?.[groupIndex]?.[optionIndex]?.[index]?.properties,
    attributes: state.current?.equipment?.[groupIndex]?.[optionIndex]?.[index]?.attributes,
  }))

  const {
    data: { equipment, metaData },
  } = useListEquipment()

  const { attributes: systemAttributes, equipment: systemEquipment, currencies: systemCurrencies } = useSystemData()

  const { fieldListeners, fieldValidators } = useFieldUpdates()

  const renderCurrencyInputs = () => {
    return (
      <Grid.Col>
        <Grid>
          <AppField name={`equipment[${groupIndex}][${optionIndex}][${index}].currencies`} mode='array'>
            {(currencies) =>
              currencies.state.value?.length &&
              currencies.state.value.map((_, i) => (
                <AppField
                  name={`equipment[${groupIndex}][${optionIndex}][${index}].currencies[${i}].amount`}
                  key={`equipmentOptionItem-currency-${i}`}
                  listeners={fieldListeners}
                  validators={fieldValidators({
                    onChange: { type: 'number', min: 0, name: systemCurrencies[i].label },
                  })}
                >
                  {({ TextField }) => (
                    <Grid.Col key={`equipment-group-item-currency-${i}`} span={{ sm: 6, md: 4, lg: 'auto' }}>
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
      <AppField name={`equipment[${groupIndex}][${optionIndex}][${index}].properties`} listeners={fieldListeners}>
        {({ DropdownField }) => (
          <Grid.Col span={{ sm: 6, md: 4, lg: 'auto' }}>
            <DropdownField
              multiselect={true}
              label='Equipment Properties'
              options={systemEquipment.properties.filterByCategory(category)}
            />
          </Grid.Col>
        )}
      </AppField>
      <AppField name={`equipment[${groupIndex}][${optionIndex}][${index}].equipment`} listeners={fieldListeners}>
        {({ DropdownField }) => (
          <Grid.Col span={{ sm: 6, md: 4, lg: 'auto' }}>
            <DropdownField
              multiselect={true}
              label='Equipment'
              options={equipment
                ?.filter((e) => metaData.categories.find((c) => c.id === category)?.equipmentIds.includes(e.id))
                .filter((e) =>
                  metaData.properties.some((p) => properties?.includes(p.id) && p.equipmentIds.includes(e.id))
                )}
            />
          </Grid.Col>
        )}
      </AppField>
      {attributes?.some((attribute) => attribute === Attributes.PROVIDES_OPTIONS) ?
        <AppField
          name={`equipment[${groupIndex}][${optionIndex}][${index}].selectionCount`}
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
          name={`equipment[${groupIndex}][${optionIndex}][${index}].quantity`}
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
                <DropdownField label='Equipment Category' options={systemEquipment.categories} />
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
}

export default EquipmentOptionItem
