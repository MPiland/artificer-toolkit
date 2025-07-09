import { Fragment } from 'react'
import { TbPlus, TbX } from 'react-icons/tb'
import { Grid, UnstyledButton } from '@mantine/core'
import { row_button } from '@/components/Form/Form.css'
import { Attributes, Equipments } from '@/enums'
import { useSystemData, useEquipmentData, useFieldUpdates } from '@/hooks'
import { withFieldGroup } from '@/components/Form'
import { useStore } from '@tanstack/react-form'
import type { EquipmentOptionItemInput } from 'gql/types'

const EquipmentOptionItem = withFieldGroup({
  defaultValues: {} as EquipmentOptionItemInput,
  props: {
    __kind: '' as 'ClassInput' | 'BackgroundInput',
    updateFn: (() => undefined) as () => void,
    removeFn: (() => undefined) as () => void,
  },
  render: function Render({ group, __kind, updateFn, removeFn }) {
    const { attributes, equipment, currencies } = useSystemData()
    const {
      equipment: { filterByCategory },
    } = useEquipmentData()

    const { AppField, Subscribe } = group

    const { fieldListeners, fieldValidators } = useFieldUpdates({
      data: 'form',
    })

    const formAttributes = useStore(group.store, (state) => state.values.attributes)

    const multipleOptions = formAttributes?.some((attribute) => attribute === Attributes.PROVIDES_OPTIONS)

    const renderCurrencyInputs = () => {
      return (
        <Grid.Col>
          <Grid>
            {currencies.map((c, i) => (
              <AppField
                name={`currencies[${i}].amount`}
                listeners={fieldListeners}
                validators={fieldValidators({
                  onChange: { type: 'number', min: 0, name: c.label },
                })}
              >
                {({ TextField }) => (
                  <Grid.Col key={`${i}-equipment-group-item-currency`} span={{ sm: 6, md: 4, lg: 'auto' }}>
                    <TextField label={c.label} />
                  </Grid.Col>
                )}
              </AppField>
            ))}
          </Grid>
        </Grid.Col>
      )
    }

    const renderEquipmentInputs = () => (
      <Subscribe selector={(state) => ({ category: state.values.category, properties: state.values.properties })}>
        {({ category, properties }) => (
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
            {multipleOptions ?
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
        )}
      </Subscribe>
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
                    options={attributes.filter(
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
                  <DropdownField label='Equipment Category' multiselect={true} options={equipment.categories} />
                </Grid.Col>
              )}
            </AppField>
            {renderEquipmentInputs()}
            <Subscribe selector={(state) => ({ attributes: state.values.attributes })}>
              {({ attributes }) =>
                attributes?.some((attribute) => attribute === Attributes?.CONTAINS_CURRENCY) && renderCurrencyInputs()
              }
            </Subscribe>
          </Grid>
        </Grid.Col>
        <Grid.Col>
          <UnstyledButton className={row_button} onClick={() => updateFn()}>
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
