import Collapsible from '@/components/Collapse'
import { Attributes, Measurements, Classes } from '@/enums'
import { Grid } from '@mantine/core'
import { useFieldUpdates, useSystemData } from '@/hooks'
import { withFieldGroup } from '@/components/Form'
import type { ClassInput, SpellcastingInput } from '@/types'
import { useTypedFormStore } from '@/store'

const Spellcasting = withFieldGroup({
  defaultValues: {} as SpellcastingInput,
  props: {
    magicName: false,
    preparesSpells: false,
  },
  render: function Render({ group, magicName, preparesSpells }) {
    const store = useTypedFormStore<ClassInput>()
    const prepareLimit = store((state) => state.current?.spellcasting?.prepareLimit)
    const { AppField } = group

    const { fieldListeners, fieldValidators } = useFieldUpdates({ data: 'form', path: 'spellcasting' })

    const { charges, abilities, rules, attributes } = useSystemData()
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
              name='ability'
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
            <AppField name='attributes' listeners={fieldListeners}>
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
                name='magicName'
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
                <AppField name='prepareLimit.methods' listeners={fieldListeners}>
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
                      name='prepareLimit.level.measurement'
                      validators={{
                        onBlur: ({ value }) => !value && 'Select the level measurement',
                      }}
                      listeners={fieldListeners}
                    >
                      {({ DropdownField }) => (
                        <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                          <DropdownField
                            label='Level Measurement'
                            options={rules.measurements.amount}
                            required={true}
                          />
                        </Grid.Col>
                      )}
                    </AppField>
                    {prepareLimit?.level?.measurement === Measurements.HALF && (
                      <AppField name='prepareLimit.level.rounding' listeners={fieldListeners}>
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
              name='maxSpellLevel'
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
              name='prepareLimit.methods'
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
  },
})

export default Spellcasting
