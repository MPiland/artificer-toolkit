import { EquipCats, EquipProps } from '@enums'
import { useSystemData, useFieldUpdates, useFormField } from '@hooks'
import { Grid } from '@mantine/core'
import { useOptimizedSelector, useTypedFormStore } from '@store'
import type { EquipmentInput } from '@types'

const DetailsStep = () => {
  const store = useTypedFormStore<EquipmentInput>()
  const { AppField } = useFormField({ store })

  const { category, properties, capacityAmount } = useOptimizedSelector(store, (state) => ({
    category: state.current?.category,
    properties: state.current?.properties,
    capacityAmount: state.current?.capacity?.amount
  }))

  const { fieldListeners, fieldValidators } = useFieldUpdates()

  const { equipment, currencies, rules } = useSystemData()

  return (
    <Grid>
      <AppField
        name='label'
        validators={fieldValidators({
          onBlur: 'Please enter a name'
        })}
        listeners={fieldListeners}
      >
        {({ TextField }) => (
          <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
            <TextField label='Name' required={true} />
          </Grid.Col>
        )}
      </AppField>
      <>
        <AppField
          name='category'
          validators={fieldValidators({
            onBlur: 'Please select a category'
          })}
          listeners={fieldListeners}
        >
          {({ DropdownField }) => (
            <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
              <DropdownField label='Category' options={equipment.categories} required={true} />
            </Grid.Col>
          )}
        </AppField>
        <AppField name='properties' listeners={fieldListeners}>
          {({ DropdownField }) => (
            <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
              <DropdownField
                label='properties'
                options={equipment.properties.filterByCategory(category)}
                multiselect={true}
              />
            </Grid.Col>
          )}
        </AppField>
        <AppField
          name='rarity'
          validators={fieldValidators({
            onBlur: 'Please select a rarity'
          })}
          listeners={fieldListeners}
        >
          {({ DropdownField }) => (
            <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
              <DropdownField label='Rarity' options={equipment.rarities} required={true} />
            </Grid.Col>
          )}
        </AppField>
        <AppField
          name='cost.amount'
          validators={fieldValidators({
            onBlur: 'Please enter a cost amount',
            onChange: { type: 'integer', name: 'Cost', min: 0 }
          })}
          listeners={fieldListeners}
        >
          {({ TextField }) => (
            <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
              <TextField label='Cost' required={true} />
            </Grid.Col>
          )}
        </AppField>
        <AppField
          name='cost.currency'
          validators={fieldValidators({
            onBlur: 'Please select a currency'
          })}
          listeners={fieldListeners}
        >
          {({ DropdownField }) => (
            <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
              <DropdownField label='Currency' options={currencies} required={true} />
            </Grid.Col>
          )}
        </AppField>
        <AppField
          name='weight.amount'
          validators={fieldValidators({
            onBlur: 'Please enter a weight amount',
            onChange: { type: 'number', name: 'Weight', min: 0 }
          })}
          listeners={fieldListeners}
        >
          {({ TextField }) => (
            <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
              <TextField label='Weight' required={true} />
            </Grid.Col>
          )}
        </AppField>
        <AppField
          name='weight.unit'
          validators={fieldValidators({
            onBlur: 'Please select a weight unit of measurement'
          })}
          listeners={fieldListeners}
        >
          {({ DropdownField }) => (
            <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
              <DropdownField label='UoM' options={rules.measurements.imperial.weight} required={true} />
            </Grid.Col>
          )}
        </AppField>
      </>
      {(category === EquipCats.WATER_VEHICLE || category === EquipCats.MOUNT
        ? (
            <>
              <AppField
                name='speed.amount'
                validators={fieldValidators({
                  onBlur: 'Please enter a speed value',
                  onChange: { type: 'integer', name: 'Speed', min: 1 }
                })}
                listeners={fieldListeners}
              >
                {({ TextField }) => (
                  <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                    <TextField label='HP Die Value' />
                  </Grid.Col>
                )}
              </AppField>
              <AppField
                name='speed.unit'
                validators={fieldValidators({
                  onBlur: 'Please select a speed unit of measurement'
                })}
                listeners={fieldListeners}
              >
                {({ DropdownField }) => (
                  <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                    <DropdownField label='UoM' options={rules.measurements.imperial.length} />
                  </Grid.Col>
                )}
              </AppField>
            </>
          )
        : (category === EquipCats.WEAPON || category === EquipCats.ARMOR) && (
            <AppField
              name='rank'
              validators={fieldValidators({
                onChange: { type: 'integer', name: 'Rank', min: 1 }
              })}
              listeners={fieldListeners}
            >
              {({ TextField }) => (
                <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                  <TextField label='Item Rank' />
                </Grid.Col>
              )}
            </AppField>
          ))
          && (properties?.some((property) => property === EquipProps.CONTAINER) || category === EquipCats.MOUNT) && (
        <>
          <AppField
            name='capacity.amount'
            validators={fieldValidators({
              onChange: { type: 'number', name: 'Capacity', min: 1 }
            })}
            listeners={fieldListeners}
          >
            {({ TextField }) => (
              <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                <TextField label='Capacity' />
              </Grid.Col>
            )}
          </AppField>
          <AppField
            name='capacity.unit'
            validators={fieldValidators({
              onBlur: 'Please select a capacity unit of measurement',
              condition: capacityAmount != null
            })}
            listeners={fieldListeners}
          >
            {({ DropdownField }) => (
              <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                <DropdownField
                  label='UoM'
                  options={[...rules.measurements.imperial.volume, ...rules.measurements.imperial.weight]}
                  required={capacityAmount != null}
                />
              </Grid.Col>
            )}
          </AppField>
        </>
      )
      && (category === EquipProps.THROWN || category === EquipProps.RANGED) && (
        <>
          <AppField
            name='range.minRange'
            validators={fieldValidators({
              onBlur: 'Please enter a min range value',
              onChange: { type: 'number', name: 'Min Range', min: 0 }
            })}
            listeners={fieldListeners}
          >
            {({ TextField }) => (
              <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                <TextField label='Min. Range' required={true} />
              </Grid.Col>
            )}
          </AppField>
          <AppField
            name='range.maxRange'
            validators={fieldValidators({
              onBlur: 'Please enter a max range value',
              onChange: { type: 'number', name: 'Max Range', min: 1 }
            })}
            listeners={fieldListeners}
          >
            {({ TextField }) => (
              <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                <TextField label='Max Range' required={true} />
              </Grid.Col>
            )}
          </AppField>
        </>
      )}
      <AppField
        name='quantity'
        validators={fieldValidators({
          onChange: { type: 'integer', name: 'Quantity', min: 1 }
        })}
        listeners={fieldListeners}
      >
        {({ TextField }) => (
          <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
            <TextField label='Quantity' />
          </Grid.Col>
        )}
      </AppField>
      <AppField name='quote' listeners={fieldListeners}>
        {({ RichTextField }) => (
          <Grid.Col>
            <RichTextField label='Quote' />
          </Grid.Col>
        )}
      </AppField>
      <AppField name='description' listeners={fieldListeners}>
        {({ RichTextField }) => (
          <Grid.Col>
            <RichTextField label='Description' />
          </Grid.Col>
        )}
      </AppField>
    </Grid>
  )
}
export default DetailsStep
