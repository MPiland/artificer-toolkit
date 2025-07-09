import Collapsible from '@/components/Collapsible'
import { Grid } from '@mantine/core'
import { useFieldUpdates, useSystemData } from '@/hooks'
import { withFieldGroup } from '@/components/Form'
import type { MulticlassInput } from 'gql/types'

const Multiclass = withFieldGroup({
  defaultValues: {} as MulticlassInput,
  props: {
    primaryAbility: false,
    secondaryAbility: false,
    optionalAbility: false,
  },
  render: function Render({ group, primaryAbility, secondaryAbility, optionalAbility }) {
    const { AppField, Subscribe } = group

    const { fieldListeners, fieldValidators } = useFieldUpdates({ data: 'form', path: 'multiclass' })

    const { abilities } = useSystemData()

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
                        validators={fieldValidators({
                          onBlur: 'Select the type of action',
                        })}
                        listeners={fieldListeners}
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
                        validators={fieldValidators({
                          onBlur: 'Please set a score requirement',
                          onChange: { type: 'integer', min: 1, name: 'Primary Score' },
                        })}
                        listeners={fieldListeners}
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
                        validators={fieldValidators({
                          onBlur: 'Select the type of action',
                        })}
                        listeners={fieldListeners}
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
                        validators={fieldValidators({
                          onBlur: 'Please set a score requirement',
                          onChange: { type: 'integer', min: 1, name: 'Secondary Score' },
                        })}
                        listeners={fieldListeners}
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
                        validators={fieldValidators({
                          onBlur: 'Select the type of action',
                        })}
                        listeners={fieldListeners}
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
                        validators={fieldValidators({
                          onBlur: 'Please set a minimum score requirement',
                          onChange: { type: 'integer', min: 1, name: 'Optional Score' },
                        })}
                        listeners={fieldListeners}
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
