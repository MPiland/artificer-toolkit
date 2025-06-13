import { z } from 'zod/v4'
import Collapsible from '@/components/Collapsible'
import { Attributes, Measurements, Classes } from '@/enums'
import { Grid } from '@mantine/core'
import { useSystemData } from '@/hooks'
import { withFieldGroup } from '../../utils/factory'
import { SpellcastingInputSchema } from '@/schemas'

const defaultValues: z.input<typeof SpellcastingInputSchema> = SpellcastingInputSchema.parse({})

const Spellcasting = withFieldGroup({
  defaultValues,
  props: {
    magicName: false,
    preparesSpells: false,
  },
  render: function Render({ group, magicName, preparesSpells }) {
    const { charges, abilities, rules, attributes } = useSystemData()

    const { AppField, Subscribe } = group

    return (
      <Grid.Col>
        <Collapsible>
          <Collapsible.Trigger title={'Spellcaster Attributes'} />
          <Collapsible.Content>
            <Grid>
              <AppField
                name='ability'
                validators={{
                  onSubmit: ({ value }) => !value && 'Select the ability for spellcasting',
                }}
              >
                {({ DropdownField }) => (
                  <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                    <DropdownField label='Spellcasting Ability' required={true} options={abilities} />
                  </Grid.Col>
                )}
              </AppField>
              <AppField name='attributes'>
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
                  validators={{
                    onSubmit: ({ value }) => !value && 'Enter a magic name',
                  }}
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
                  <AppField name='prepareLimit.methods'>
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
                  <Subscribe selector={(state) => state.values.prepareLimit}>
                    {(prepareLimit) =>
                      prepareLimit?.methods?.some((method) => method === Attributes.CLASS_LEVEL) && (
                        <>
                          <AppField
                            name='prepareLimit.level.measurement'
                            validators={{
                              onSubmit: ({ value }) => !value && 'Select the level measurement',
                            }}
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
                            <AppField name='prepareLimit.level.rounding'>
                              {({ DropdownField }) => (
                                <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                                  <DropdownField label='Level Rounding' options={rules.measurements.rounding} />
                                </Grid.Col>
                              )}
                            </AppField>
                          )}
                        </>
                      )
                    }
                  </Subscribe>
                </>
              )}
              <AppField
                name='maxSpellLevel'
                validators={{
                  onSubmit: ({ value }) => !value && 'Enter the highest spell level',
                  onChange: z.int('Spell level must be a whole number').gte(1, 'Spell level must be greater than 0'),
                }}
              >
                {({ TextField }) => (
                  <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                    <TextField label='Max Spell Level' required={true} />
                  </Grid.Col>
                )}
              </AppField>
              <AppField
                name='prepareLimit.methods'
                validators={{
                  onSubmit: ({ value }) => !value && 'Select the prepare limit method',
                }}
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
          </Collapsible.Content>
        </Collapsible>
      </Grid.Col>
    )
  },
})

export default Spellcasting
