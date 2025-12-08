import { useEffect, use, useMemo, useCallback } from 'react'
import { Categories, Ranges, Shapes, Features, Attributes } from '~enums'
import { useEnumChecks, useFieldUpdates, useSystemData, useSystemPref, useFormField } from '~hooks'
import { useOptimizedSelector, useTypedFormStore } from '~store'
import OptionsByLevel from './OptionsByLevel'
import { Grid, Card, Stack, SimpleGrid, Group, ActionIcon, Button, ThemeIcon, Badge, Text } from '@mantine/core'
import Collapsible from '~components/Collapse'
import { SectionsList, Prerequisites, Damage, LimitUse, Options, add_option_card, option_card } from '~components/Form'
import { OptionsByLevelInputSchema, FeatureOptionInputSchema } from '~schemas'
import type { FormDataType, CharacterInput, SpellInput } from '~types'
import { sprinkles } from '~css/sprinkles.css'
import { PlusIcon, Trash2, ArrowRight } from 'lucide-react'
import parse from 'html-react-parser'
import { v4 as uuidv4 } from 'uuid'
import { AuthContext } from '../../../auth/AuthProvider'
import type { UnionToIntersection, SetOptional } from 'type-fest'

type FeaturePath = `ancestry.options[${number}].features[${number}]` | `features[${number}]`

type StoreType = UnionToIntersection<SetOptional<Exclude<FormDataType, CharacterInput | SpellInput>, '__kind'>>

const Feature = () => {
  const { user } = use(AuthContext)
  const [systemPref] = useSystemPref()

  const store = useTypedFormStore<StoreType>()

  const { AppField } = useFormField({ store })

  const {
    updateField,
    stateKind,
    setEditing,
    optionIndex,
    category,
    formAttributes,
    shape,
    range,
    formOptionsByLevel,
    options,
    featureTitle,
    meta,
  } = useOptimizedSelector(store, (state) => {
    const { ancestryOptionIndex, featureIndex } = state.meta.editing

    const feature =
      featureIndex !== null ?
        ancestryOptionIndex !== null && state.current?.__kind === 'RaceInput' ?
          state.current?.ancestry?.options?.[ancestryOptionIndex]?.features?.[featureIndex]
        : state.current?.features?.[featureIndex]
      : undefined

    return {
      updateField: state.updateField,
      stateKind: state.current?.__kind as
        | 'ClassInput'
        | 'RaceInput'
        | 'EquipmentInput'
        | 'BackgroundInput'
        | 'FeatInput'
        | undefined,
      optionIndex: state.meta.editing.optionIndex || 0,
      setEditing: state.setEditing,
      category: feature?.category,
      formAttributes: feature?.attributes,
      shape: feature?.shape,
      range: feature?.range,
      formOptionsByLevel: feature?.optionsByLevel,
      options: feature?.options,
      featureTitle: feature?.label,
      meta: state.meta,
    }
  })

  const computePath = useCallback(() => {
    const segments: string[] = []

    if (meta.editing.ancestryOptionIndex && stateKind === 'RaceInput') {
      segments.push(`ancestry.options[${meta.editing.ancestryOptionIndex}]`)
    }

    segments.push(`features[${meta.editing.featureIndex || 0}]`)

    return segments.join('.') + '.'
  }, [meta, stateKind])

  const formPath = useMemo(() => {
    return computePath()
  }, [computePath]) as FeaturePath

  const { fieldListeners, fieldValidators } = useFieldUpdates()

  const { getAttributes } = useEnumChecks()

  const { optionsByLevel } = getAttributes({
    attributes: formAttributes || [],
  })

  useEffect(() => {
    if (optionsByLevel && !formOptionsByLevel?.length) {
      const optionsByLevelInputObj = OptionsByLevelInputSchema.parse({
        __kind: 'OptionsByLevelInput',
      })
      updateField({ path: `${formPath}.optionsByLevel`, value: [optionsByLevelInputObj] })
    }
    if (!optionsByLevel && formOptionsByLevel?.length) {
      updateField({ path: `${formPath}.optionsByLevel`, value: undefined })
    }
  })

  const { attributes, abilities, categories, spells, actions, rules } = useSystemData()

  return (
    <>
      {optionIndex === null ?
        <Grid>
          <Grid.Col span={{ base: 8 }}>
            <Grid>
              <Grid.Col>
                <h2 className={sprinkles({ mb: 'space-2' })}>{featureTitle}</h2>
              </Grid.Col>
              <AppField
                name={`${formPath}.label`}
                validators={fieldValidators({
                  onBlur: 'Enter a name for this feature',
                })}
              >
                {({ TextField }) => {
                  return (
                    <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                      <TextField label='Feature Name' required={true} />
                    </Grid.Col>
                  )
                }}
              </AppField>
              <AppField
                name={`${formPath}.category`}
                validators={fieldValidators({
                  onBlur: 'Select a category',
                })}
                listeners={fieldListeners}
              >
                {({ DropdownField }) => (
                  <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                    <DropdownField
                      label='Feature Category'
                      options={categories.filter((category) => category.features)}
                      required={true}
                    />
                  </Grid.Col>
                )}
              </AppField>
              <AppField name={`${formPath}.detail`} listeners={fieldListeners}>
                {({ RichTextField }) => (
                  <Grid.Col>
                    <RichTextField label='Feature Detail' />
                  </Grid.Col>
                )}
              </AppField>
              <AppField name={`${formPath}.desc`} listeners={fieldListeners}>
                {({ RichTextField }) => (
                  <Grid.Col>
                    <RichTextField label='Feature Description' />
                  </Grid.Col>
                )}
              </AppField>
              <Grid.Col>
                {stateKind !== 'EquipmentInput' && stateKind !== 'BackgroundInput' && !optionsByLevel && (
                  <AppField
                    name={`${formPath}.levelAvailable`}
                    validators={fieldValidators({
                      onBlur: 'Enter a level',
                      condition: stateKind !== 'RaceInput',
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
                          label='Feature Attribute'
                          multiselect={true}
                          options={attributes.filter(
                            (attribute) =>
                              (attribute?.features?.length &&
                                stateKind === 'EquipmentInput' &&
                                attribute?.features?.includes(Features.EQUIPMENT)) ||
                              attribute?.features?.includes(Features.ALL)
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
                      onBlur: 'Select an action type',
                    })}
                    listeners={fieldListeners}
                  >
                    {({ DropdownField }) => (
                      <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                        <DropdownField label='Action' options={actions} required={true} />
                      </Grid.Col>
                    )}
                  </AppField>
                )}
              </Grid.Col>
              {formAttributes?.some((attribute) => attribute === Attributes.HAS_RANGE) && (
                <Grid.Col>
                  <Grid>
                    <AppField
                      name={`${formPath}.range.id`}
                      validators={fieldValidators({
                        onBlur: 'Select a range type',
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
                              onBlur: 'Enter a minimum range amount',
                              onChange: { type: 'number', min: 0, name: 'Min. Range' },
                              condition: range?.id === Ranges.DISTANCE,
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
                            onBlur: 'Enter a maximum range amount',
                            onChange: { type: 'number', min: 1, name: 'Max. Range' },
                            condition: range?.id === Ranges.DISTANCE,
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
                            onBlur: range?.id === Ranges.DISTANCE ? 'Select a range unit of measurement' : undefined,
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
                          onChange: { type: 'integer', name: 'Target count', min: 1 },
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
                        onBlur: 'Select a shape type',
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
                            onChange: { type: 'number', min: 1, name: 'Shape' },
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
                            onBlur: 'Select a shape size unit of measurement',
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
                              (attribute) =>
                                attribute?.features?.length && attribute?.features?.includes(Features.SAVE_ABILITY)
                            )}
                          />
                        </Grid.Col>
                      )}
                    </AppField>
                    <AppField
                      name={`${formPath}.saveAbility.id`}
                      validators={fieldValidators({
                        onBlur: 'Select a save ability',
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
                          onBlur: 'Select a modifier ability',
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
                        onChange: { type: 'number', min: 1, name: 'Min amount' },
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
                  <Collapsible
                    props={{
                      trigger: {
                        title: 'Select Options By Level',
                      },
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
                      <AppField name={`${formPath}.optionsByLevel`} mode='array'>
                        {(optionsByLevel) =>
                          optionsByLevel.state.value?.map((_, i) => (
                            <OptionsByLevel
                              index={i}
                              replaceAtLevel={formAttributes.some(
                                (attribute) => attribute === Attributes.REPLACE_AT_LEVEL
                              )}
                            />
                          ))
                        }
                      </AppField>
                    </Grid>
                  </Collapsible>
                </Grid.Col>
              )}
              // In your Feature component
              <Grid.Col>
                <Group justify='space-between' mb='md'>
                  <Text size='lg' fw={500}>
                    Feature Options
                  </Text>
                  <Text size='sm' c='dimmed'>
                    {options?.length || 0} options
                  </Text>
                </Group>

                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing='md'>
                  <AppField name={`${formPath}.options`} mode='array'>
                    {(optionsArray) => (
                      <>
                        {optionsArray.state.value?.map((option, i) => (
                          <Card
                            key={i}
                            shadow='sm'
                            padding='lg'
                            radius='md'
                            withBorder
                            className={option_card} // Hover effects
                            onClick={() => setEditing({ optionIndex: i })}
                          >
                            <Stack gap='sm'>
                              <Group justify='space-between'>
                                <Text fw={600} size='md'>
                                  {option.label || `Option ${i + 1}`}
                                </Text>
                                <ActionIcon
                                  variant='subtle'
                                  size='sm'
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    optionsArray.removeValue(i)
                                    updateField({ path: `${formPath}.options[${i}]`, value: undefined })
                                  }}
                                >
                                  <Trash2 />
                                </ActionIcon>
                              </Group>

                              {option.category && (
                                <Badge variant='light' size='sm'>
                                  {option.category}
                                </Badge>
                              )}

                              {option.desc && (
                                <Text size='sm' c='dimmed' lineClamp={3}>
                                  {parse(option.desc)}
                                </Text>
                              )}

                              <Button
                                variant='light'
                                size='xs'
                                rightSection={<ArrowRight />}
                                mt='sm'
                                onClick={() => setEditing({ optionIndex: i })}
                              >
                                Edit Option
                              </Button>
                            </Stack>
                          </Card>
                        ))}
                        <Card
                          shadow='sm'
                          padding='lg'
                          radius='md'
                          withBorder
                          className={add_option_card}
                          onClick={() => {
                            const newIndex = optionsArray.state.value?.length || 0
                            const optionInputObj = FeatureOptionInputSchema.parse({
                              __kind: 'FeatureOptionInput',
                              id: uuidv4(),
                              ownerId: user?.userId,
                              systemId: systemPref,
                              masterId: undefined,
                            })
                            optionsArray.pushValue(optionInputObj)
                            updateField({
                              path: `${formPath}.options[${newIndex}]`,
                              value: optionInputObj,
                            })
                          }}
                        >
                          <Stack align='center' justify='center' h='100%' gap='sm'>
                            <ThemeIcon size='xl' variant='light' radius='xl'>
                              <PlusIcon />
                            </ThemeIcon>
                            <Text fw={500} ta='center'>
                              Add New Option
                            </Text>
                            <Text size='sm' c='dimmed' ta='center'>
                              Create additional choices for this feature
                            </Text>
                          </Stack>
                        </Card>
                      </>
                    )}
                  </AppField>
                </SimpleGrid>
              </Grid.Col>
            </Grid>
          </Grid.Col>
          <Grid.Col span={{ base: 4 }}>
            <SectionsList />
          </Grid.Col>
        </Grid>
      : <Options />}
    </>
  )
}

export default Feature
