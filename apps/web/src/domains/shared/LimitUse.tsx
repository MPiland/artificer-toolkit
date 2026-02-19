import { useEffect, useMemo, useCallback } from 'react'
import Collapsible from '@components/Collapse'
import { ChargesLimits, Features, Feats } from '@enums'
import { Grid } from '@mantine/core'
import { useFieldUpdates, useSystemData, useFormField } from '@hooks'
import { UsesPerLevelInputSchema } from '@artificer-toolkit/shared/schemas'
import { UnionToIntersection, type SetOptional } from 'type-fest'
import { useOptimizedSelector, useTypedFormStore } from '@store'
import type {
  CharacterInput,
  FeatureInput,
  FormDataType,
  FeatureOptionInput,
  SpellInput,
  FeatureSpellInput,
  FeatureModifierInput
} from '@types'

type FeaturePath
  = | `ancestry.options[${number}].features[${number}].charges`
    | `ancestry.options[${number}].features[${number}].${'modifiers' | 'spells'}[${number}].charges`
    | `ancestry.options[${number}].features[${number}].options[${number}].charges`
    | `ancestry.options[${number}].features[${number}].options[${number}].${'modifiers' | 'spells'}[${number}].charges`
    | `features[${number}].charges`
    | `features[${number}].${'modifiers' | 'spells'}[${number}].charges`
    | `features[${number}].options[${number}].charges`
    | `features[${number}].options[${number}].${'modifiers' | 'spells'}[${number}].charges`

type StoreType = UnionToIntersection<SetOptional<Exclude<FormDataType, CharacterInput | SpellInput>, '__kind'>>

const LimitUse = () => {
  const store = useTypedFormStore<StoreType>()
  const { usesPerLevel, limit, updateField, meta, stateKind } = useOptimizedSelector(store, (state) => {
    let targetFeature: FeatureInput | FeatureOptionInput | FeatureSpellInput | FeatureModifierInput | undefined
      = undefined

    if (state.meta.editing) {
      const { ancestryOptionIndex, featureIndex, optionIndex, sectionIndex, sectionType } = state.meta.editing

      const feature
        = featureIndex !== null
          ? ancestryOptionIndex !== null && state.current?.__kind === 'RaceInput'
            ? state.current?.ancestry?.options?.[ancestryOptionIndex]?.features?.[featureIndex]
            : state.current?.features?.[featureIndex]
          : undefined

      const option = feature && (optionIndex !== null ? feature?.options?.[optionIndex] : undefined)

      if ((sectionType === 'modifiers' || sectionType === 'spells') && sectionIndex !== null) {
        targetFeature
          = option
            ? option?.[sectionType]?.[sectionIndex]
            : feature
              ? feature?.[sectionType]?.[sectionIndex]
              : undefined
      } else {
        targetFeature
          = option
            ? option
            : feature
              ? feature
              : undefined
      }
    }

    return {
      usesPerLevel: targetFeature?.charges?.usesPerLevel,
      limit: targetFeature?.charges?.limit,
      updateField: state.updateField,
      meta: state.meta,
      stateKind: state.current?.__kind
    }
  })

  const computePath = useCallback(() => {
    const segments: string[] = []

    if (meta.editing.ancestryOptionIndex && stateKind === 'RaceInput') {
      segments.push(`ancestry.options[${meta.editing.ancestryOptionIndex}]`)
    }

    if (meta.editing.featureIndex !== undefined) {
      segments.push(`features[${meta.editing.featureIndex}]`)
    }

    if (meta.editing.optionIndex !== undefined) {
      segments.push(`options[${meta.editing.optionIndex}]`)
    }

    if (meta.editing.sectionType && meta.editing.sectionIndex !== undefined) {
      segments.push(`${meta.editing.sectionType}[${meta.editing.sectionIndex}]`)
    }

    return segments.join('.') + '.'
  }, [meta, stateKind])

  const path = useMemo(() => {
    return computePath() + 'charges'
  }, [computePath]) as FeaturePath

  const { AppField } = useFormField({ store })

  const { fieldListeners, fieldValidators } = useFieldUpdates()

  const { charges, abilities, skills } = useSystemData()
  // Add/remove Limit Use table
  useEffect(() => {
    if (!usesPerLevel?.length && limit === ChargesLimits.USES_PER_LEVEL) {
      const usesPerLevelInputObject = UsesPerLevelInputSchema.parse({})
      updateField({ path: `${path}.charges.usesPerLevel[0]`, value: usesPerLevelInputObject })
    }
    if (limit !== ChargesLimits.USES_PER_LEVEL && usesPerLevel?.length) {
      updateField({ path: `${path}.charges.usesPerLevel`, value: undefined })
    }
  }, [
    usesPerLevel, limit, updateField, path
  ])

  return (
    <>
      <Grid.Col>
        <Grid>
          <AppField
            name={`${path}.limit`}
            validators={fieldValidators({
              onBlur: 'Choose a limit option'
            })}
            listeners={fieldListeners}
          >
            {({ DropdownField }) => (
              <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                <DropdownField
                  label="Limit Option"
                  required={true}
                  options={charges.limits.filter((limit) => {
                    if (stateKind === 'FeatInput') {
                      return limit?.feats?.length && limit?.feats?.includes(Feats.ALL)
                    }
                    return limit?.features?.length && limit?.features?.includes(Features.ALL)
                  })}
                />
              </Grid.Col>
            )}
          </AppField>
          {limit === ChargesLimits.ABILITY
            ? (
                <AppField
                  name={`${path}.ability`}
                  validators={fieldValidators({
                    onBlur: 'Choose a charge ability'
                  })}
                  listeners={fieldListeners}
                >
                  {({ DropdownField }) => (
                    <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                      <DropdownField label="Ability" required={true} options={abilities} />
                    </Grid.Col>
                  )}
                </AppField>
              )
            : limit === ChargesLimits.SKILL
              ? (
                  <AppField
                    name={`${path}.skill`}
                    validators={fieldValidators({
                      onBlur: 'Choose a charge skill'
                    })}
                    listeners={fieldListeners}
                  >
                    {({ DropdownField }) => (
                      <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                        <DropdownField label="Ability" required={true} options={skills} />
                      </Grid.Col>
                    )}
                  </AppField>
                )
              : limit === ChargesLimits.SET_AMOUNT
                ? (
                    <AppField
                      name={`${path}.setAmount`}
                      validators={fieldValidators({
                        onBlur: 'Enter an amount of use charges',
                        onChange: { type: 'number', min: 1, name: 'Use amount' }
                      })}
                      listeners={fieldListeners}
                    >
                      {({ TextField }) => (
                        <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                          <TextField label="Use Amount" required={true} />
                        </Grid.Col>
                      )}
                    </AppField>
                  )
                : limit === ChargesLimits.RESOURCE_POINTS && (
                  <AppField
                    name={`${path}.resourcePoints`}
                    validators={fieldValidators({
                      onBlur: 'Enter an amount of use charges',
                      onChange: { type: 'number', min: 1, name: 'Resource points' }
                    })}
                    listeners={fieldListeners}
                  >
                    {({ TextField }) => (
                      <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                        <TextField label="Resource Points" required={true} />
                      </Grid.Col>
                    )}
                  </AppField>
                )}
          {limit != null
            && limit !== ChargesLimits.SET_AMOUNT
            && limit !== ChargesLimits.USES_PER_LEVEL
            && limit !== ChargesLimits.RESOURCE_POINTS && (
            <>
              <AppField
                name={`${path}.multiplier`}
                validators={fieldValidators({
                  onChange: { type: 'number', min: 1, name: 'Multiplier' }
                })}
                listeners={fieldListeners}
              >
                {({ TextField }) => (
                  <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                    <TextField label="Multiplier" />
                  </Grid.Col>
                )}
              </AppField>
              <AppField
                name={`${path}.addAmount`}
                validators={fieldValidators({
                  onChange: { type: 'number', min: 1, name: 'Additional amount' }
                })}
                listeners={fieldListeners}
              >
                {({ TextField }) => (
                  <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                    <TextField label="Additional Amount" />
                  </Grid.Col>
                )}
              </AppField>
              <AppField
                name={`${path}.minAmount`}
                validators={fieldValidators({
                  onChange: { type: 'number', min: 1, name: 'Min. amount' }
                })}
                listeners={fieldListeners}
              >
                {({ TextField }) => (
                  <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                    <TextField label="Min. Amount" />
                  </Grid.Col>
                )}
              </AppField>
            </>
          )}
          {limit !== ChargesLimits.RESOURCE_POINTS && (
            <AppField
              name={`${path}.reset`}
              validators={fieldValidators({
                onBlur: 'Choose a reset method'
              })}
              listeners={fieldListeners}
            >
              {({ DropdownField }) => (
                <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                  <DropdownField
                    label="Reset Option"
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
                title: 'Limit Use Table'
              }
            }}
          >
            <Grid>
              <Grid.Col>
                <Grid>
                  <Grid.Col>Level</Grid.Col>
                  <Grid.Col>Uses</Grid.Col>
                </Grid>
              </Grid.Col>
              <AppField name={`${path}.usesPerLevel`} mode="array">
                {(field) => field.state.value?.map((_, i) => (
                  <Grid.Col key={`usesPerLevel-${i}`}>
                    <Grid>
                      <AppField
                        name={`${path}.usesPerLevel[${i}].level`}
                        validators={fieldValidators({
                          onBlur: 'Enter a level',
                          onChange: { type: 'number', min: 1, name: 'Level' }
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
                        name={`${path}.usesPerLevel[${i}].uses`}
                        validators={fieldValidators({
                          onBlur: 'Enter a number of uses',
                          onChange: { type: 'number', min: 1, name: 'Uses' }
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
                ))}
              </AppField>
            </Grid>
          </Collapsible>
        </Grid.Col>
      )}
    </>
  )
}

export default LimitUse
