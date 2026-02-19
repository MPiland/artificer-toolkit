import { useFieldUpdates, useSystemData } from '@hooks'
import { useOptimizedSelector, useTypedFormStore } from '@store'
import { Grid } from '@mantine/core'
import { Prerequisites, Damage, LimitUse } from '@components/Form'
import { FormDataType, CharacterInput, SpellInput } from '@types'
import { sprinkles } from '@css/sprinkles.css'
import Collapse from '@components/Collapse'
import { Categories, Ranges, Shapes, Features, Attributes } from '@enums'
import SectionsList from './SectionsList'
import type { UnionToIntersection, SetOptional } from 'type-fest'
import { useFormField } from '@hooks'
import { useMemo, useCallback } from 'react'

type FeaturePath
  = | `ancestry.options[${number}].features[${number}].options[${number}]`
    | `features[${number}].options[${number}]`

type StoreType = UnionToIntersection<SetOptional<Exclude<FormDataType, CharacterInput | SpellInput>, '__kind'>>

const Options = () => {
  const store = useTypedFormStore<StoreType>()

  const { AppField } = useFormField({ store })

  const { stateKind, formAttributes, category, shape, range, featureTitle, meta } = useOptimizedSelector(
    store,
    (state) => {
      const { ancestryOptionIndex, featureIndex, optionIndex } = state.meta.editing

      const feature
        = featureIndex !== null
          ? ancestryOptionIndex !== null && state.current?.__kind === 'RaceInput'
            ? state.current?.ancestry?.options?.[ancestryOptionIndex]?.features?.[featureIndex]
            : state.current?.features?.[featureIndex]
          : undefined

      const option = feature && (optionIndex !== null ? feature?.options?.[optionIndex] : undefined)

      const stateFeature = option ? option : feature

      return {
        stateKind: state.current?.__kind as
        | 'ClassInput'
        | 'RaceInput'
        | 'EquipmentInput'
        | 'BackgroundInput'
        | 'FeatInput'
        | undefined,
        formAttributes: stateFeature?.attributes,
        category: stateFeature?.category,
        shape: stateFeature?.shape,
        range: stateFeature?.range,
        featureTitle: stateFeature?.label,
        meta: state.meta
      }
    }
  )

  const computePath = useCallback(() => {
    const segments: string[] = []

    if (meta.editing.ancestryOptionIndex && stateKind === 'RaceInput') {
      segments.push(`ancestry.options[${meta.editing.ancestryOptionIndex}]`)
    }

    segments.push(`features[${meta.editing.featureIndex || 0}]`)
    segments.push(`options[${meta.editing.optionIndex || 0}]`)

    return segments.join('.') + '.'
  }, [meta, stateKind])

  const formPath = useMemo(() => {
    return computePath()
  }, [computePath]) as FeaturePath

  const { fieldListeners, fieldValidators } = useFieldUpdates()

  const { attributes, abilities, categories, spells, actions, rules } = useSystemData()

  return (
    <Grid>
      <Grid.Col span={{ base: 8 }}>
        <Grid>
          <Grid.Col>
            <h2 className={sprinkles({ mb: 'space-2' })}>{featureTitle}</h2>
          </Grid.Col>
          <Grid>
            <AppField
              name={`${formPath}.label`}
              validators={fieldValidators({
                onBlur: 'Enter a name for this feature'
              })}
            >
              {({ TextField }) => {
                return (
                  <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                    <TextField label='Option Name' required={true} />
                  </Grid.Col>
                )
              }}
            </AppField>
            <AppField
              name={`${formPath}.category`}
              validators={fieldValidators({
                onBlur: 'Select a category'
              })}
              listeners={fieldListeners}
            >
              {({ DropdownField }) => (
                <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                  <DropdownField
                    label='Option Category'
                    options={categories.filter((category) => category.features)}
                    required={true}
                  />
                </Grid.Col>
              )}
            </AppField>
            <AppField name={`${formPath}.detail`} listeners={fieldListeners}>
              {({ RichTextField }) => (
                <Grid.Col>
                  <RichTextField label='Option Detail' />
                </Grid.Col>
              )}
            </AppField>
            <AppField name={`${formPath}.description`} listeners={fieldListeners}>
              {({ RichTextField }) => (
                <Grid.Col>
                  <RichTextField label='Option Description' />
                </Grid.Col>
              )}
            </AppField>
            <Grid.Col>
              <Grid>
                {stateKind !== 'EquipmentInput' && stateKind !== 'BackgroundInput' && (
                  <AppField
                    name={`${formPath}.levelAvailable`}
                    validators={fieldValidators({
                      onBlur: 'Enter a level',
                      condition: stateKind !== 'RaceInput'
                    })}
                    listeners={fieldListeners}
                  >
                    {({ TextField }) => (
                      <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                        <TextField label='Level(s) Available' required={stateKind === 'RaceInput' ? false : true} />
                      </Grid.Col>
                    )}
                  </AppField>
                )}
                {category !== Categories.SUBCLASS && (
                  <AppField name={`${formPath}.attributes`} listeners={fieldListeners}>
                    {({ DropdownField }) => (
                      <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                        <DropdownField
                          label='Option Attribute'
                          multiselect={true}
                          options={attributes.filter(
                            (attribute) => (attribute?.features?.length && attribute?.features?.includes(Features.OPTION))
                              || attribute?.features?.includes(Features.ALL)
                          )}
                        />
                      </Grid.Col>
                    )}
                  </AppField>
                )}
                {formAttributes?.some((attribute) => attribute === Attributes.IS_ACTION) && (
                  <AppField
                    name={`${formPath}.actions.primary.id`}
                    validators={fieldValidators({
                      onBlur: 'Select an action type'
                    })}
                    listeners={fieldListeners}
                  >
                    {({ DropdownField }) => (
                      <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                        <DropdownField label='Option Action' options={actions} required={true} />
                      </Grid.Col>
                    )}
                  </AppField>
                )}
              </Grid>
            </Grid.Col>
            {formAttributes?.some((attribute) => attribute === Attributes.HAS_RANGE) && (
              <Grid.Col>
                <Grid>
                  <AppField
                    name={`${formPath}.range.id`}
                    validators={fieldValidators({
                      onBlur: 'Select a range type'
                    })}
                    listeners={fieldListeners}
                  >
                    {({ DropdownField }) => (
                      <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                        <DropdownField label='Range' options={spells.ranges} required={true} />
                      </Grid.Col>
                    )}
                  </AppField>
                  {range?.id !== Ranges.TOUCH && range?.id !== Ranges.SIGHT && range?.id !== Ranges.UNLIMITED && (
                    <>
                      {range?.id !== Ranges.SELF && (
                        <AppField
                          name={`${formPath}.range.minRange`}
                          validators={fieldValidators({
                            onBlur: range?.id === Ranges.DISTANCE ? 'Enter a minimum range amount' : undefined,
                            onChange: { type: 'number', min: 0, name: 'Min. Range' }
                          })}
                          listeners={fieldListeners}
                        >
                          {({ TextField }) => (
                            <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                              <TextField label='Min. Range' required={range?.id === Ranges.DISTANCE || false} />
                            </Grid.Col>
                          )}
                        </AppField>
                      )}
                      <AppField
                        name={`${formPath}.range.maxRange`}
                        validators={fieldValidators({
                          onBlur: range?.id === Ranges.DISTANCE ? 'Enter a maximum range amount' : undefined,
                          onChange: { type: 'number', min: 1, name: 'Max. Range' }
                        })}
                        listeners={fieldListeners}
                      >
                        {({ TextField }) => (
                          <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                            <TextField label='Max Range' required={range?.id === Ranges.DISTANCE || false} />
                          </Grid.Col>
                        )}
                      </AppField>
                      <AppField
                        name={`${formPath}.range.unit`}
                        validators={fieldValidators({
                          onBlur: range?.id === Ranges.DISTANCE ? 'Select a range unit of measurement' : undefined
                        })}
                        listeners={fieldListeners}
                      >
                        {({ DropdownField }) => (
                          <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                            <DropdownField
                              label='UoM'
                              options={rules.measurements.imperial.length}
                              required={range?.id === Ranges.DISTANCE || false}
                            />
                          </Grid.Col>
                        )}
                      </AppField>
                    </>
                  )}
                  {formAttributes?.some((attribute) => attribute === Attributes.LIMIT_TARGETS) && (
                    <AppField
                      name={`${formPath}.targets`}
                      validators={fieldValidators({
                        onChange: { type: 'number', min: 1, name: 'Target' }
                      })}
                      listeners={fieldListeners}
                    >
                      {({ TextField }) => (
                        <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                          <TextField label='No. of Targets' required={range?.id === Ranges.DISTANCE || false} />
                        </Grid.Col>
                      )}
                    </AppField>
                  )}
                </Grid>
                <Grid>
                  <AppField
                    name={`${formPath}.shape.id`}
                    validators={fieldValidators({
                      onBlur: 'Select a shape type'
                    })}
                    listeners={fieldListeners}
                  >
                    {({ DropdownField }) => (
                      <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                        <DropdownField label='Shape' options={spells.shapes} required={true} />
                      </Grid.Col>
                    )}
                  </AppField>
                  {shape?.id !== Shapes.NONE && shape?.id !== Shapes.WEAPON && shape?.id !== Shapes.CONE && (
                    <>
                      <AppField
                        name={`${formPath}.shape.size`}
                        validators={fieldValidators({
                          onChange: { type: 'number', min: 1, name: 'Shape' }
                        })}
                        listeners={fieldListeners}
                      >
                        {({ TextField }) => (
                          <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                            <TextField label='Shape Size' required={true} />
                          </Grid.Col>
                        )}
                      </AppField>
                      <AppField
                        name={`${formPath}.shape.unit`}
                        validators={fieldValidators({
                          onBlur: 'Select a shape size unit of measurement'
                        })}
                        listeners={fieldListeners}
                      >
                        {({ DropdownField }) => (
                          <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                            <DropdownField label='UoM' options={rules.measurements.imperial.length} required={true} />
                          </Grid.Col>
                        )}
                      </AppField>
                    </>
                  )}
                </Grid>
              </Grid.Col>
            )}
            {formAttributes?.some((attribute) => attribute === Attributes.REQUIRES_SAVE) && (
              <Grid.Col>
                <Grid>
                  <AppField name={`${formPath}.saveAbility.attributes`} listeners={fieldListeners}>
                    {({ DropdownField }) => (
                      <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                        <DropdownField
                          label='Save Attribute'
                          multiselect={true}
                          options={attributes.filter(
                            (attribute) => attribute?.features?.length && attribute?.features?.includes(Features.SAVE_ABILITY)
                          )}
                        />
                      </Grid.Col>
                    )}
                  </AppField>
                  <AppField
                    name={`${formPath}.saveAbility.id`}
                    validators={fieldValidators({
                      onBlur: 'Select a save ability'
                    })}
                    listeners={fieldListeners}
                  >
                    {({ DropdownField }) => (
                      <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                        <DropdownField label='DC Ability' options={abilities} required={true} />
                      </Grid.Col>
                    )}
                  </AppField>
                  {formAttributes?.some((attribute) => attribute === Attributes.ADD_ABILITY_MODIFIER) && (
                    <AppField
                      name={`${formPath}.saveAbility.abilityModifier`}
                      validators={fieldValidators({
                        onBlur: 'Select a modifier ability'
                      })}
                      listeners={fieldListeners}
                    >
                      {({ DropdownField }) => (
                        <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                          <DropdownField label='Modifier Ability' options={abilities} required={true} />
                        </Grid.Col>
                      )}
                    </AppField>
                  )}
                  <AppField
                    name={`${formPath}.saveAbility.minAmount`}
                    validators={fieldValidators({
                      onBlur: stateKind !== 'ClassInput' ? 'Enter a min amount' : undefined,
                      onChange: { type: 'number', min: 1, name: 'Min amount' }
                    })}
                    listeners={fieldListeners}
                  >
                    {({ TextField }) => (
                      <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                        <TextField label='Min amount' required={stateKind !== 'ClassInput'} />
                      </Grid.Col>
                    )}
                  </AppField>
                </Grid>
              </Grid.Col>
            )}
            {formAttributes?.some((attribute) => attribute === Attributes.PREREQUISITES) && <Prerequisites />}
            {formAttributes?.some((attribute) => attribute === Attributes.LIMIT_USE) && <LimitUse />}
            {formAttributes?.some((attribute) => attribute === Attributes.DOES_DAMAGE) && <Damage />}
            {formAttributes?.some((attribute) => attribute === Attributes.OPTIONS_BY_LEVEL) && (
              <Grid.Col>
                <Collapse
                  props={{
                    trigger: {
                      title: 'Select Options By Level'
                    }
                  }}
                >
                  <Grid>
                    <Grid.Col>
                      <Grid>
                        <Grid.Col>Level</Grid.Col>
                        <Grid.Col>Count</Grid.Col>
                        {formAttributes.some((attribute) => attribute === Attributes.REPLACE_AT_LEVEL) && (
                          <Grid.Col>Replace Count</Grid.Col>
                        )}
                      </Grid>
                    </Grid.Col>
                  </Grid>
                </Collapse>
              </Grid.Col>
            )}
          </Grid>
        </Grid>
      </Grid.Col>
      <Grid.Col span={{ base: 4 }}>
        <SectionsList />
      </Grid.Col>
    </Grid>
  )
}

export default Options
