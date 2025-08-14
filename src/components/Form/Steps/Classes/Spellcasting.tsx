import Collapsible from '~/components/Collapse'
import { Attributes, Measurements, Classes } from '~/enums'
import { Grid } from '@mantine/core'
import { useEnumChecks, useFieldUpdates, useFormField, useSystemData } from '~/hooks'
import type { ClassInput } from '~/types'
import { useOptimizedSelector, useTypedFormStore } from '~/store'

const Spellcasting = () => {
  const store = useTypedFormStore<ClassInput>()

  const { AppField } = useFormField({ store })

  const { prepareLimit, formAttributes } = useOptimizedSelector(store, (state) => ({
    prepareLimit: state.current?.spellcasting?.prepareLimit,
    formAttributes: state.current?.attributes,
  }))

  const { fieldListeners, fieldValidators } = useFieldUpdates()

  const { charges, abilities, rules, attributes } = useSystemData()

  const { getAttributes } = useEnumChecks()

  const { magicName, preparesSpells } = getAttributes({ attributes: formAttributes || undefined })

  return (
    <Grid.Col>
      <Collapsible
        props={{
          trigger: {
            title: 'Spellcaster Attributes',
          },
        }}
      >
        <Grid>
          <AppField
            name='spellcasting.ability'
            validators={fieldValidators({
              onBlur: 'Select the ability for spellcasting',
            })}
            listeners={fieldListeners}
          >
            {({ DropdownField }) => (
              <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                <DropdownField label='Spellcasting Ability' required={true} options={abilities} />
              </Grid.Col>
            )}
          </AppField>
          <AppField name='spellcasting.attributes' listeners={fieldListeners}>
            {({ DropdownField }) => (
              <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                <DropdownField
                  label='Spellcasting Attributes'
                  multiselect={true}
                  options={attributes.filter((attributes) => attributes?.classes?.includes(Classes.SPELLCASTER))}
                />
              </Grid.Col>
            )}
          </AppField>
          {magicName && (
            <AppField
              name='spellcasting.magicName'
              validators={fieldValidators({
                onBlur: 'Enter a magic name',
              })}
              listeners={fieldListeners}
            >
              {({ TextField }) => (
                <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                  <TextField label='Magic Type Name' required={true} />
                </Grid.Col>
              )}
            </AppField>
          )}
          {preparesSpells && (
            <>
              <AppField name='spellcasting.prepareLimit.methods' listeners={fieldListeners}>
                {({ DropdownField }) => (
                  <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                    <DropdownField
                      label='Prepare Limit Method'
                      multiselect={true}
                      options={attributes.filter(
                        (attributes) =>
                          attributes?.classes?.length && attributes?.classes?.includes(Classes.PREPARE_LIMIT)
                      )}
                    />
                  </Grid.Col>
                )}
              </AppField>
              {prepareLimit?.methods?.some((method) => method === Attributes.CLASS_LEVEL) && (
                <>
                  <AppField
                    name='spellcasting.prepareLimit.level.measurement'
                    validators={fieldValidators({
                      onBlur: 'Select the level measurement',
                    })}
                    listeners={fieldListeners}
                  >
                    {({ DropdownField }) => (
                      <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                        <DropdownField label='Level Measurement' options={rules.measurements.amount} required={true} />
                      </Grid.Col>
                    )}
                  </AppField>
                  {prepareLimit?.level?.measurement === Measurements.HALF && (
                    <AppField name='spellcasting.prepareLimit.level.rounding' listeners={fieldListeners}>
                      {({ DropdownField }) => (
                        <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                          <DropdownField label='Level Rounding' options={rules.measurements.rounding} />
                        </Grid.Col>
                      )}
                    </AppField>
                  )}
                </>
              )}
            </>
          )}
          <AppField
            name='spellcasting.maxSpellLevel'
            validators={fieldValidators({
              onBlur: 'Enter the highest spell level',
              onChange: { type: 'integer', min: 1, name: 'Spell Level' },
            })}
            listeners={fieldListeners}
          >
            {({ TextField }) => (
              <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                <TextField label='Max Spell Level' required={true} />
              </Grid.Col>
            )}
          </AppField>
          <AppField
            name='spellcasting.prepareLimit.methods'
            validators={fieldValidators({
              onBlur: 'Select the prepare limit method',
            })}
            listeners={fieldListeners}
          >
            {({ DropdownField }) => (
              <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                <DropdownField
                  label='Prepare Limit Method'
                  required={true}
                  options={charges.resets.filter(
                    (reset) => reset?.classes?.length && reset?.classes?.includes(Classes.SPELLCASTER)
                  )}
                />
              </Grid.Col>
            )}
          </AppField>
        </Grid>
      </Collapsible>
    </Grid.Col>
  )
}

export default Spellcasting
