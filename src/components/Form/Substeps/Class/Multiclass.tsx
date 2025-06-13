import { z } from 'zod/v4'
import Collapsible from '@/components/Collapsible'
import { Grid } from '@mantine/core'
import { useSystemData } from '@/hooks'
import { withFieldGroup } from '../../utils/factory'
import { MulticlassInputSchema } from '@/schemas'

const defaultValues: z.input<typeof MulticlassInputSchema> = MulticlassInputSchema.parse({})

const Multiclass = withFieldGroup({
  defaultValues,
  props: {
    primaryAbility: false,
    secondaryAbility: false,
    optionalAbility: false,
  },
  render: function Render({ group, primaryAbility, secondaryAbility, optionalAbility }) {
    const { abilities } = useSystemData()

    const { AppField, Subscribe } = group

    return (
      <Grid.Col>
        <Collapsible>
          <Collapsible.Trigger title={'Multiclass Ability Requirements'} />
          <Collapsible.Content>
            <Subscribe
              selector={(state) => ({
                primaryId: state.values.primaryAbility?.id,
                secondaryId: state.values.secondaryAbility?.id,
                optionalId: state.values.optionalAbility?.id,
              })}
            >
              {({ primaryId, secondaryId, optionalId }) => (
                <Grid>
                  {primaryAbility && (
                    <>
                      <AppField
                        name='primaryAbility.id'
                        validators={{
                          onSubmit: ({ value }) => !value && 'Select the type of action',
                        }}
                      >
                        {({ DropdownField }) => (
                          <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                            <DropdownField
                              required={true}
                              label='Primary Ability'
                              options={abilities
                                .filter((ability) => ability.id !== secondaryId)
                                .filter((ability) => ability.id !== optionalId)}
                            />
                          </Grid.Col>
                        )}
                      </AppField>
                      <AppField
                        name='primaryAbility.minAmount'
                        validators={{
                          onSubmit: ({ value }) => !value && 'Please set a score requirement',
                          onChange: z.int('Score must be a whole number').gte(1, 'Score must greater than 0'),
                        }}
                      >
                        {({ TextField }) => (
                          <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                            <TextField required={true} label='Primary Score' />
                          </Grid.Col>
                        )}
                      </AppField>
                    </>
                  )}
                  {secondaryAbility && (
                    <>
                      <AppField
                        name='secondaryAbility.id'
                        validators={{
                          onSubmit: ({ value }) => !value && 'Select the type of action',
                        }}
                      >
                        {({ DropdownField }) => (
                          <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                            <DropdownField
                              required={true}
                              label='Secondary Ability'
                              options={abilities
                                .filter((ability) => ability.id !== optionalId)
                                .filter((ability) => ability.id !== primaryId)}
                            />
                          </Grid.Col>
                        )}
                      </AppField>
                      <AppField
                        name='secondaryAbility.minAmount'
                        validators={{
                          onSubmit: ({ value }) => !value && 'Please set a score requirement',
                          onChange: z.int('Score must be a whole number').gte(1, 'Score must greater than 0'),
                        }}
                      >
                        {({ TextField }) => (
                          <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                            <TextField required={true} label='Secondary Score' />
                          </Grid.Col>
                        )}
                      </AppField>
                    </>
                  )}
                  {optionalAbility && (
                    <>
                      <AppField
                        name='optionalAbility.id'
                        validators={{
                          onSubmit: ({ value }) => !value && 'Select the type of action',
                        }}
                      >
                        {({ DropdownField }) => (
                          <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                            <DropdownField
                              required={true}
                              label='Optional Ability'
                              options={abilities
                                .filter((ability) => ability.id !== secondaryId)
                                .filter((ability) => ability.id !== primaryId)}
                            />
                          </Grid.Col>
                        )}
                      </AppField>
                      <AppField
                        name='optionalAbility.minAmount'
                        validators={{
                          onSubmit: ({ value }) => !value && 'Please set a score requirement',
                          onChange: z.int('Score must be a whole number').gte(1, 'Score must greater than 0'),
                        }}
                      >
                        {({ TextField }) => (
                          <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                            <TextField required={true} label='Optional Score' />
                          </Grid.Col>
                        )}
                      </AppField>
                    </>
                  )}
                </Grid>
              )}
            </Subscribe>
          </Collapsible.Content>
        </Collapsible>
      </Grid.Col>
    )
  },
})

export default Multiclass
