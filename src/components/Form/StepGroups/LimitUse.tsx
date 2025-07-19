import { useEffect } from 'react'
import Collapsible from '@/components/Collapse'
import { ChargesLimits, Features, Feats } from '@/enums'
import { Grid } from '@mantine/core'
import { useFieldUpdates, useSystemData } from '@/hooks'
import { UsesPerLevelInputSchema } from '@/schemas'
import { withFieldGroup } from '@/components/Form'
import { useStore } from '@tanstack/react-form'
import type { ChargeInput } from 'gql/types'

type LimitUseProps = {
  __kind: 'FeatureSpellInput' | 'FeatInput' | 'FeatureInput' | 'AncestryFeatureInput' | 'FeatureOptionInput'
  removeFn: (arg: { path: string }) => void
  updateFn: (arg: { path: string; value: unknown }) => void
}

const LimitUse = withFieldGroup({
  defaultValues: {} as ChargeInput,
  props: {
    __kind: 'FeatureSpellInput',
    removeFn: (() => undefined) as () => void,
    updateFn: (() => undefined) as () => void,
    getFn: (() => undefined) as () => void,
  } as LimitUseProps,
  render: function Render({ group, __kind, removeFn, updateFn }) {
    const { AppField } = group

    const { fieldListeners, fieldValidators } = useFieldUpdates({
      data:
        __kind === 'FeatInput' ? 'form'
        : __kind === 'FeatureOptionInput' ? 'option'
        : 'feature',
      path: 'charges',
    })

    const { usesPerLevel, limit } = useStore(group.store, (state) => ({
      usesPerLevel: state.values.usesPerLevel,
      limit: state.values.limit,
    }))

    const { charges, abilities, skills } = useSystemData()
    //Add/remove Limit Use table
    useEffect(() => {
      if (!usesPerLevel?.length && limit === ChargesLimits.USES_PER_LEVEL) {
        const usesPerLevelInputObject = UsesPerLevelInputSchema.parse({})
        group.setFieldValue(`usesPerLevel[0]`, usesPerLevelInputObject)
        updateFn({ path: 'charges.usesPerLevel[0]', value: usesPerLevelInputObject })
      }
      if (limit !== ChargesLimits.USES_PER_LEVEL && usesPerLevel?.length) {
        group.setFieldValue('usesPerLevel', undefined)
        removeFn({ path: 'charges.usesPerLevel' })
      }
    }, [usesPerLevel, limit, group, updateFn, removeFn])

    return (
      <>
        <Grid.Col>
          <Grid>
            <AppField
              name='limit'
              validators={fieldValidators({
                onBlur: 'Choose a limit option',
              })}
              listeners={fieldListeners}
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
                validators={fieldValidators({
                  onBlur: 'Choose a charge ability',
                })}
                listeners={fieldListeners}
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
                validators={fieldValidators({
                  onBlur: 'Choose a charge skill',
                })}
                listeners={fieldListeners}
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
                validators={fieldValidators({
                  onBlur: 'Enter an amount of use charges',
                  onChange: { type: 'number', min: 1, name: 'Use amount' },
                })}
                listeners={fieldListeners}
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
                  validators={fieldValidators({
                    onBlur: 'Enter an amount of use charges',
                    onChange: { type: 'number', min: 1, name: 'Resource points' },
                  })}
                  listeners={fieldListeners}
                >
                  {({ TextField }) => (
                    <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                      <TextField label='Resource Points' required={true} />
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
                    validators={fieldValidators({
                      onChange: { type: 'number', min: 1, name: 'Multiplier' },
                    })}
                    listeners={fieldListeners}
                  >
                    {({ TextField }) => (
                      <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                        <TextField label='Multiplier' />
                      </Grid.Col>
                    )}
                  </AppField>
                  <AppField
                    name='addAmount'
                    validators={fieldValidators({
                      onChange: { type: 'number', min: 1, name: 'Additional amount' },
                    })}
                    listeners={fieldListeners}
                  >
                    {({ TextField }) => (
                      <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                        <TextField label='Additional Amount' />
                      </Grid.Col>
                    )}
                  </AppField>
                  <AppField
                    name='minAmount'
                    validators={fieldValidators({
                      onChange: { type: 'number', min: 1, name: 'Min. amount' },
                    })}
                    listeners={fieldListeners}
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
                validators={fieldValidators({
                  onBlur: 'Choose a reset method',
                })}
                listeners={fieldListeners}
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
            <Collapsible
              props={{
                trigger: {
                  title: 'Limit Use Table',
                },
              }}
            >
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
                            validators={fieldValidators({
                              onBlur: 'Enter a level',
                              onChange: { type: 'number', min: 1, name: 'Level' },
                            })}
                            listeners={fieldListeners}
                          >
                            {({ TextField }) => (
                              <Grid.Col>
                                <TextField required={true} />
                              </Grid.Col>
                            )}
                          </AppField>
                          <AppField
                            name={`usesPerLevel[${i}].uses`}
                            validators={fieldValidators({
                              onBlur: 'Enter a number of uses',
                              onChange: { type: 'number', min: 1, name: 'Uses' },
                            })}
                            listeners={fieldListeners}
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
            </Collapsible>
          </Grid.Col>
        )}
      </>
    )
  },
})

export default LimitUse
