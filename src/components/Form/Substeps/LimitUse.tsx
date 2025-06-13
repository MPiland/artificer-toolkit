import { z } from 'zod/v4'
import { useEffect } from 'react'
import Collapsible from '@/components/Collapsible'
import { ChargesLimits, Features, Feats } from '@/enums'
import { Grid } from '@mantine/core'
import { useSystemData } from '@/hooks'
import { ChargeInputSchema, UsesPerLevelInputSchema } from '@/schemas'
import { withFieldGroup } from '../utils/factory'
import { useStore } from '@tanstack/react-form'

const defaultValues: z.input<typeof ChargeInputSchema> = ChargeInputSchema.parse({})

const LimitUse = withFieldGroup({
  defaultValues,
  props: {
    __kind: '' as 'FeatureSpellInput' | 'FeatInput' | 'FeatureInput' | 'AncestryFeatureInput' | 'FeatureOptionInput',
  },
  render: function Render({ group, __kind }) {
    const { usesPerLevel, limit } = useStore(group.store, (state) => ({
      usesPerLevel: state.values.usesPerLevel,
      limit: state.values.limit,
    }))

    const { AppField } = group

    const { charges, abilities, skills } = useSystemData()

    //Add/remove Limit Use table
    useEffect(() => {
      if (!usesPerLevel?.length && limit === ChargesLimits.USES_PER_LEVEL) {
        group.setFieldValue(`usesPerLevel[0]`, UsesPerLevelInputSchema.parse({}))
      }
      if (limit !== ChargesLimits.USES_PER_LEVEL && usesPerLevel?.length) {
        group.setFieldValue('usesPerLevel', undefined)
      }
    }, [usesPerLevel, limit, group])

    return (
      <>
        <Grid.Col>
          <Grid>
            <AppField
              name='limit'
              validators={{
                onSubmit: ({ value }) => !value && 'Choose a limit option',
              }}
            >
              {({ DropdownField }) => (
                <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                  <DropdownField
                    label='Limit Option'
                    required={true}
                    options={charges.limits.filter((limit) => {
                      if (__kind === 'FeatInput') {
                        return limit?.feats?.length && limit?.feats?.includes(Feats.ALL)
                      }
                      return limit?.features?.length && limit?.features?.includes(Features.ALL)
                    })}
                  />
                </Grid.Col>
              )}
            </AppField>
            {limit === ChargesLimits.ABILITY ?
              <AppField
                name='ability'
                validators={{
                  onSubmit: ({ value }) => !value && 'Choose a charge ability',
                }}
              >
                {({ DropdownField }) => (
                  <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                    <DropdownField label='Ability' required={true} options={abilities} />
                  </Grid.Col>
                )}
              </AppField>
            : limit === ChargesLimits.SKILL ?
              <AppField
                name='skill'
                validators={{
                  onSubmit: ({ value }) => !value && 'Choose a charge skill',
                }}
              >
                {({ DropdownField }) => (
                  <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                    <DropdownField label='Ability' required={true} options={skills} />
                  </Grid.Col>
                )}
              </AppField>
            : limit === ChargesLimits.SET_AMOUNT ?
              <AppField
                name='setAmount'
                validators={{
                  onSubmit: ({ value }) => !value && 'Enter an amount of use charges',
                  onChange: z.int('Use amount must be a whole number').gte(1, 'Use amount must be greater than 0'),
                }}
              >
                {({ TextField }) => (
                  <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                    <TextField label='Use Amount' required={true} />
                  </Grid.Col>
                )}
              </AppField>
            : limit === ChargesLimits.RESOURCE_POINTS && (
                <AppField
                  name='resourcePoints'
                  validators={{
                    onSubmit: ({ value }) => !value && 'Enter an amount of use charges',
                    onChange: z.int('Use amount must be a whole number').gte(1, 'Use amount must be greater than 0'),
                  }}
                >
                  {({ TextField }) => (
                    <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                      <TextField label='Use Amount' required={true} />
                    </Grid.Col>
                  )}
                </AppField>
              )
            }
            {limit != null &&
              limit !== ChargesLimits.SET_AMOUNT &&
              limit !== ChargesLimits.USES_PER_LEVEL &&
              limit !== ChargesLimits.RESOURCE_POINTS && (
                <>
                  <AppField
                    name='multiplier'
                    validators={{
                      onChange: z.int('Multiplier must be a whole number').gte(1, 'Multiplier must be greater than 0'),
                    }}
                  >
                    {({ TextField }) => (
                      <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                        <TextField label='Multiplier' />
                      </Grid.Col>
                    )}
                  </AppField>
                  <AppField
                    name='addAmount'
                    validators={{
                      onChange: z
                        .int('Additional amount must be a whole number')
                        .gte(1, 'Additional amount must be greater than 0'),
                    }}
                  >
                    {({ TextField }) => (
                      <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                        <TextField label='Additional Amount' />
                      </Grid.Col>
                    )}
                  </AppField>
                  <AppField
                    name='minAmount'
                    validators={{
                      onChange: z
                        .int('Min. amount must be a whole number')
                        .gte(1, 'Min. amount must be greater than 0'),
                    }}
                  >
                    {({ TextField }) => (
                      <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                        <TextField label='Min. Amount' />
                      </Grid.Col>
                    )}
                  </AppField>
                </>
              )}
            {limit !== ChargesLimits.RESOURCE_POINTS && (
              <AppField
                name='reset'
                validators={{
                  onSubmit: ({ value }) => !value && 'Choose a reset method',
                }}
              >
                {({ DropdownField }) => (
                  <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                    <DropdownField
                      label='Reset Option'
                      required={true}
                      options={charges.resets.filter(
                        (reset) => reset?.features?.length && reset?.features?.includes(Features.ALL)
                      )}
                    />
                  </Grid.Col>
                )}
              </AppField>
            )}
          </Grid>
        </Grid.Col>
        {limit === ChargesLimits.USES_PER_LEVEL && (
          <Grid.Col>
            <Collapsible>
              <Collapsible.Trigger title={'Limit Use Table'} />
              <Collapsible.Content>
                <Grid>
                  <Grid.Col>
                    <Grid>
                      <Grid.Col>Level</Grid.Col>
                      <Grid.Col>Uses</Grid.Col>
                    </Grid>
                  </Grid.Col>
                  <AppField name='usesPerLevel' mode='array'>
                    {(field) =>
                      field.state.value?.map((_, i) => (
                        <Grid.Col key={`${i}-usesPerLevel`}>
                          <Grid>
                            <AppField
                              name={`usesPerLevel[${i}].level`}
                              validators={{
                                onSubmit: ({ value }) => !value && 'Enter a level',
                                onChange: z.int('Level must be a whole number').gte(1, 'Level must be greater than 0'),
                              }}
                            >
                              {({ TextField }) => (
                                <Grid.Col>
                                  <TextField required={true} />
                                </Grid.Col>
                              )}
                            </AppField>
                            <AppField
                              name={`usesPerLevel[${i}].uses`}
                              validators={{
                                onSubmit: ({ value }) => !value && 'Enter a number of uses',
                                onChange: z.int('Level must be a whole number').gte(1, 'Level must be greater than 0'),
                              }}
                            >
                              {({ TextField }) => (
                                <Grid.Col>
                                  <TextField required={true} />
                                </Grid.Col>
                              )}
                            </AppField>
                          </Grid>
                        </Grid.Col>
                      ))
                    }
                  </AppField>
                </Grid>
              </Collapsible.Content>
            </Collapsible>
          </Grid.Col>
        )}
      </>
    )
  },
})

export default LimitUse
