import { sprinkles } from '~/css/sprinkles.css'
import { TbPlus, TbX } from 'react-icons/tb'
import { useEffect, useMemo, useCallback } from 'react'
import Collapsible from '~/components/Collapse'
import { Grid, Group, Divider, UnstyledButton } from '@mantine/core'
import { useSystemData, useEnumChecks, useFieldUpdates, useFormField } from '~/hooks'
import { Features } from '~/enums'
import { EquipPrerequisiteInputSchema } from '~/schemas'
import { row_button, SECTION_STEPS } from '~/components/Form'
import type {
  CharacterInput,
  FeatureInput,
  FormDataType,
  FeatureOptionInput,
  SectionFormDataType,
  SpellInput,
} from '~/types'
import { useOptimizedSelector, useTypedFormStore } from '~/store'
import { useListEquipment, useListSpells } from '~/apis'
import type { UnionToIntersection, SetOptional } from 'type-fest'

type FeaturePath =
  | `ancestry.options[${number}].features[${number}].prerequisites`
  | `ancestry.options[${number}].features[${number}].${NonNullable<(typeof SECTION_STEPS)[number]>}[${number}].prerequisites`
  | `ancestry.options[${number}].features[${number}].options[${number}].prerequisites`
  | `ancestry.options[${number}].features[${number}].options[${number}].${NonNullable<(typeof SECTION_STEPS)[number]>}[${number}].prerequisites`
  | `features[${number}].prerequisites`
  | `features[${number}].${NonNullable<(typeof SECTION_STEPS)[number]>}[${number}].prerequisites`
  | `features[${number}].options[${number}].prerequisites`
  | `features[${number}].options[${number}].${NonNullable<(typeof SECTION_STEPS)[number]>}[${number}].prerequisites`

type StoreType = UnionToIntersection<SetOptional<Exclude<FormDataType, CharacterInput | SpellInput>, '__kind'>>

const Prerequisites = () => {
  const store = useTypedFormStore<StoreType>()

  const {
    __kind,
    options,
    equipmentProficiencies,
    equipped,
    notEquipped,
    featuresObtained,
    features,
    updateField,
    meta,
    stateKind,
  } = useOptimizedSelector(store, (state) => {
    let targetFeature: FeatureInput | FeatureOptionInput | SectionFormDataType | undefined = undefined

    if (state.meta.editing) {
      const { ancestryOptionIndex, featureIndex, optionIndex, sectionIndex, sectionType } = state.meta.editing

      const feature =
        featureIndex !== null ?
          ancestryOptionIndex !== null && state.current?.__kind === 'RaceInput' ?
            state.current?.ancestry?.options?.[ancestryOptionIndex]?.features?.[featureIndex]
          : state.current?.features?.[featureIndex]
        : undefined

      const option = feature && (optionIndex !== null ? feature?.options?.[optionIndex] : undefined)

      if (sectionType && sectionIndex !== null) {
        targetFeature =
          option ? option?.[sectionType]?.[sectionIndex]
          : feature ? feature?.[sectionType]?.[sectionIndex]
          : undefined
      } else {
        targetFeature =
          option ? option
          : feature ? feature
          : undefined
      }
    }

    return {
      options: targetFeature?.prerequisites?.options,
      equipmentProficiencies: targetFeature?.prerequisites?.equipmentProficiencies,
      equipped: targetFeature?.prerequisites?.equipped,
      notEquipped: targetFeature?.prerequisites?.notEquipped,
      featuresObtained: targetFeature?.prerequisites?.featuresObtained,
      features: state.current?.features,
      __kind: targetFeature?.__kind,
      updateField: state.updateField,
      meta: state.meta,
      stateKind: state.current?.__kind,
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
    return computePath() + 'prerequisites'
  }, [computePath]) as FeaturePath

  const { AppField } = useFormField({ store })

  const { fieldListeners, fieldValidators } = useFieldUpdates()

  const {
    abilities,
    prerequisites,
    skills,
    equipment: { categories: equipmentCategories, properties: equipmentProperties },
  } = useSystemData()

  const {
    data: { spells },
  } = useListSpells()

  const {
    data: { equipment, metaData },
  } = useListEquipment()

  const { getPrerequisites } = useEnumChecks()
  const {
    equipmentProficiency,
    equipped: equippedPrereq,
    notEquipped: notEquippedPrereq,
    spellsObtained: spellsObtainedPrereq,
    featuresObtained: featuresObtainedPrereq,
    optionsObtained: optionsObtainedPrereq,
    skillProficiency: skillProficiencyPrereq,
    abilityScore: abilityScorePrereq,
  } = getPrerequisites({ options: options ?? [] })

  // Add/Remove prerequisites array
  useEffect(() => {
    if (equipmentProficiency && !equipmentProficiencies?.length) {
      const proficiencyInputObj = EquipPrerequisiteInputSchema.parse({ __kind: 'EquipPrerequisiteInput' })
      updateField({ path: `${path}.prerequisites.equipmentProficiencies[0]`, value: [proficiencyInputObj] })
    }

    if (equippedPrereq && !equipped?.length) {
      const equippedInputObj = EquipPrerequisiteInputSchema.parse({ __kind: 'EquipPrerequisiteInput' })
      updateField({ path: `${path}.prerequisites.equipped[0]`, value: [equippedInputObj] })
    }

    if (notEquippedPrereq && !notEquipped?.length) {
      const notEquippedInputObj = EquipPrerequisiteInputSchema.parse({ __kind: 'EquipPrerequisiteInput' })
      updateField({ path: `${path}.prerequisites.notEquipped[0]`, value: [notEquippedInputObj] })
    }
  }, [
    equipmentProficiency,
    equipped,
    notEquipped,
    notEquippedPrereq,
    equippedPrereq,
    equipmentProficiencies,
    path,
    updateField,
  ])

  // TODO: Figure out how to map feature data from main data (ex: Class, Race, etc) to features constant

  const optionsObtainedOptions = useMemo(() => {
    const mappedOptions = featuresObtained?.flatMap((featureId) =>
      features
        ?.filter(Boolean)
        ?.find((sFeature) => sFeature?.id === featureId)
        ?.options?.map((option) => {
          if (option?.label != null) {
            return {
              ...option,
              label: option.label,
              id: option.id,
            }
          }
          return null
        })
    )

    return mappedOptions?.filter((option) => option != null) || []
  }, [features, featuresObtained])

  return (
    <Grid.Col>
      <Collapsible
        props={{
          trigger: {
            title: 'Prerequisites',
          },
        }}
      >
        <Grid>
          <>
            <Grid.Col>
              <Grid>
                <AppField
                  name={`${path}.options`}
                  validators={fieldValidators({
                    onBlur: 'Please select at least one option',
                  })}
                  listeners={fieldListeners}
                >
                  {({ DropdownField }) => (
                    <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                      <DropdownField
                        multiselect={true}
                        label='Prerequisite(s)'
                        options={prerequisites.filter(
                          (prerequisite) =>
                            prerequisite?.features?.length &&
                            (prerequisite?.features?.includes(Features.ALL) ||
                              (__kind === 'FeatureOptionInput' && prerequisite?.features.includes(Features.OPTION)))
                        )}
                        required={true}
                      />
                    </Grid.Col>
                  )}
                </AppField>
                {spellsObtainedPrereq && (
                  <AppField
                    name={`${path}.spellsObtained`}
                    validators={fieldValidators({
                      onBlur: 'Please select at least one spell',
                    })}
                    listeners={fieldListeners}
                  >
                    {({ DropdownField }) => (
                      <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                        <DropdownField multiselect={true} label='Spell(s)' options={spells || []} required={true} />
                      </Grid.Col>
                    )}
                  </AppField>
                )}
                {featuresObtainedPrereq && (
                  <AppField
                    name={`${path}.featuresObtained`}
                    validators={fieldValidators({
                      onBlur: 'Please select at least one feature',
                    })}
                    listeners={fieldListeners}
                  >
                    {({ DropdownField }) => (
                      <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                        <DropdownField multiselect={true} label='Feature(s)' options={features || []} required={true} />
                      </Grid.Col>
                    )}
                  </AppField>
                )}
                {optionsObtainedPrereq &&
                  featuresObtained?.some(
                    (feature) =>
                      features?.filter(Boolean)?.find((sFeature) => sFeature?.id === feature)?.options?.length
                  ) && (
                    <AppField
                      name={`${path}.optionsObtained`}
                      validators={fieldValidators({
                        onBlur: 'Please select at least one feature option',
                      })}
                      listeners={fieldListeners}
                    >
                      {({ DropdownField }) => (
                        <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                          <DropdownField
                            multiselect={true}
                            label='Option(s)'
                            options={optionsObtainedOptions.filter(Boolean)}
                            required={true}
                          />
                        </Grid.Col>
                      )}
                    </AppField>
                  )}
                {skillProficiencyPrereq && (
                  <AppField
                    name={`${path}.skillProficiencies`}
                    validators={fieldValidators({
                      onBlur: 'Please select at least one skill',
                    })}
                    listeners={fieldListeners}
                  >
                    {({ DropdownField }) => (
                      <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                        <DropdownField multiselect={true} label='Skill(s)' options={skills} required={true} />
                      </Grid.Col>
                    )}
                  </AppField>
                )}
                {abilityScorePrereq && (
                  <>
                    <AppField
                      name={`${path}.abilityScore.abilities`}
                      validators={fieldValidators({
                        onBlur: 'Please select at least one ability',
                      })}
                      listeners={fieldListeners}
                    >
                      {({ DropdownField }) => (
                        <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                          <DropdownField multiselect={true} label='Abilities' options={abilities} required={true} />
                        </Grid.Col>
                      )}
                    </AppField>
                    <AppField
                      name={`${path}.abilityScore.score`}
                      validators={fieldValidators({
                        onBlur: 'Please enter an ability score requirement',
                        onChange: { type: 'integer', min: 1, name: 'Ability score' },
                      })}
                      listeners={fieldListeners}
                    >
                      {({ TextField }) => (
                        <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                          <TextField label='Ability Score' required={true} />
                        </Grid.Col>
                      )}
                    </AppField>
                  </>
                )}
              </Grid>
            </Grid.Col>
            {equipmentProficiency && (
              <Grid.Col>
                <Divider label='Equipment Proficiency' />
                <AppField name={`${path}.equipmentProficiencies`} mode='array'>
                  {(field) =>
                    field.state.value?.map((equipmentProficieny, i) => (
                      <Grid key={`equipmentProficiencies-${i}`}>
                        <AppField name={`${path}.equipmentProficiencies[${i}].category`} listeners={fieldListeners}>
                          {({ DropdownField }) => (
                            <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                              <DropdownField
                                label='Equipment Category'
                                options={equipmentCategories.filterByProperties(equipmentProficieny?.properties)}
                              />
                            </Grid.Col>
                          )}
                        </AppField>
                        <AppField name={`${path}.equipmentProficiencies[${i}].properties`} listeners={fieldListeners}>
                          {({ DropdownField }) => (
                            <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                              <DropdownField
                                multiselect={true}
                                label='Equipment Category'
                                options={equipmentCategories.filterByProperties(equipmentProficieny?.properties)}
                              />
                            </Grid.Col>
                          )}
                        </AppField>
                        <AppField
                          name={`${path}.equipmentProficiencies[${i}].equipment`}
                          validators={fieldValidators({
                            onBlur: 'Please select an equipment',
                          })}
                          listeners={fieldListeners}
                        >
                          {({ DropdownField }) => (
                            <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                              <DropdownField
                                multiselect={true}
                                label='Equipment'
                                options={equipment
                                  .filter((e) =>
                                    metaData.categories?.find(
                                      (c) => c.id === equipmentProficieny?.category && c.equipmentIds.includes(e.id)
                                    )
                                  )
                                  .filter((e) =>
                                    metaData.properties?.some(
                                      (c) =>
                                        equipmentProficieny?.properties?.includes(c.id) && c.equipmentIds.includes(e.id)
                                    )
                                  )}
                                required={true}
                              />
                            </Grid.Col>
                          )}
                        </AppField>
                        <Grid.Col span={{ base: 6, md: 4, lg: 2 }} className={sprinkles({ alignContent: 'center' })}>
                          <Group className={sprinkles({ height: 'size-full' })} align='center' justify='flex-start'>
                            <UnstyledButton
                              className={row_button}
                              onClick={() => {
                                const equipPrerequisiteObject = EquipPrerequisiteInputSchema.parse({
                                  __kind: 'EquipPrerequisiteInput',
                                })
                                field.pushValue(equipPrerequisiteObject)
                                updateField({ path: `${path}.equipmentProficiencies`, value: equipPrerequisiteObject })
                              }}
                            >
                              <TbPlus />
                            </UnstyledButton>
                            {i !== 0 && (
                              <UnstyledButton
                                className={row_button}
                                onClick={() => {
                                  field.removeValue(i)
                                  updateField({ path: `${path}.equipmentProficiencies[${i}]` })
                                }}
                              >
                                <TbX />
                              </UnstyledButton>
                            )}
                          </Group>
                        </Grid.Col>
                      </Grid>
                    ))
                  }
                </AppField>
              </Grid.Col>
            )}
            {equippedPrereq && (
              <Grid.Col>
                <Divider label='Equipped' />
                <AppField name={`${path}.equipped`} mode='array'>
                  {(field) =>
                    field.state.value?.map((equipPrerequisite, i) => (
                      <Grid key={`equipped-${i}`}>
                        <AppField name={`${path}.equipped[${i}].category`} listeners={fieldListeners}>
                          {({ DropdownField }) => (
                            <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                              <DropdownField
                                label='Equipment Category'
                                options={equipmentCategories.filterByProperties(equipPrerequisite?.properties)}
                              />
                            </Grid.Col>
                          )}
                        </AppField>
                        <AppField name={`${path}.equipped[${i}].properties`} listeners={fieldListeners}>
                          {({ DropdownField }) => (
                            <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                              <DropdownField
                                multiselect={true}
                                label='Equipment Property'
                                options={equipmentProperties.filterByCategory(equipPrerequisite?.category)}
                              />
                            </Grid.Col>
                          )}
                        </AppField>
                        <AppField
                          name={`${path}.equipped[${i}].equipment`}
                          validators={fieldValidators({
                            onBlur: 'Please select an equipment',
                          })}
                          listeners={fieldListeners}
                        >
                          {({ DropdownField }) => (
                            <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                              <DropdownField
                                multiselect={true}
                                label='Equipment'
                                options={equipment
                                  .filter((e) =>
                                    metaData.categories?.find(
                                      (c) => c.id === equipPrerequisite?.category && c.equipmentIds.includes(e.id)
                                    )
                                  )
                                  .filter((e) =>
                                    metaData.properties?.some(
                                      (c) =>
                                        equipPrerequisite?.properties?.includes(c.id) && c.equipmentIds.includes(e.id)
                                    )
                                  )}
                                required={true}
                              />
                            </Grid.Col>
                          )}
                        </AppField>
                        <AppField
                          name={`${path}.equipped[${i}].numberEquipped`}
                          validators={fieldValidators({
                            onBlur: 'Please select an equipment',
                            onChange: { type: 'integer', min: 1, name: 'Number equipped' },
                          })}
                          listeners={fieldListeners}
                        >
                          {({ TextField }) => (
                            <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                              <TextField label='Number Equipped' required={true} />
                            </Grid.Col>
                          )}
                        </AppField>
                        <Grid.Col span={{ base: 6, md: 4, lg: 2 }} className={sprinkles({ alignContent: 'center' })}>
                          <Group className={sprinkles({ height: 'size-full' })} align='center' justify='flex-start'>
                            <UnstyledButton
                              className={row_button}
                              onClick={() => {
                                const equipPrerequisiteObject = EquipPrerequisiteInputSchema.parse({
                                  __kind: 'EquipPrerequisiteInput',
                                })
                                field.pushValue(equipPrerequisiteObject)
                                updateField({ path: `${path}.equipped`, value: equipPrerequisiteObject })
                              }}
                            >
                              <TbPlus />
                            </UnstyledButton>
                            {i !== 0 && (
                              <UnstyledButton
                                className={row_button}
                                onClick={() => {
                                  field.removeValue(i)
                                  updateField({ path: `${path}.equipped[${i}]`, value: undefined })
                                }}
                              >
                                <TbX />
                              </UnstyledButton>
                            )}
                          </Group>
                        </Grid.Col>
                      </Grid>
                    ))
                  }
                </AppField>
              </Grid.Col>
            )}
            {notEquippedPrereq && (
              <Grid.Col>
                <Divider label={'Not Equipped'} />
                <AppField name={`${path}.notEquipped`} mode='array'>
                  {(field) =>
                    field.state.value?.map((notEquipPrerequisite, i) => (
                      <Grid key={`notEquipped-${i}-`}>
                        <AppField name={`${path}.notEquipped[${i}].category`} listeners={fieldListeners}>
                          {({ DropdownField }) => (
                            <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                              <DropdownField
                                label='Equipment Category'
                                options={equipmentCategories.filterByProperties(notEquipPrerequisite?.properties)}
                              />
                            </Grid.Col>
                          )}
                        </AppField>
                        <AppField name={`${path}.notEquipped[${i}].properties`} listeners={fieldListeners}>
                          {({ DropdownField }) => (
                            <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                              <DropdownField
                                label='Equipment Properties'
                                multiselect={true}
                                options={equipmentProperties.filterByCategory(notEquipPrerequisite?.category)}
                              />
                            </Grid.Col>
                          )}
                        </AppField>
                        <AppField
                          name={`${path}.notEquipped[${i}].equipment`}
                          validators={fieldValidators({
                            onBlur: 'Please select at least one equipment',
                          })}
                          listeners={fieldListeners}
                        >
                          {({ DropdownField }) => (
                            <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                              <DropdownField
                                multiselect={true}
                                label='Equipment'
                                options={equipment
                                  .filter((e) =>
                                    metaData.categories?.find(
                                      (c) => c.id === notEquipPrerequisite?.category && c.equipmentIds.includes(e.id)
                                    )
                                  )
                                  .filter((e) =>
                                    metaData.properties?.some(
                                      (c) =>
                                        notEquipPrerequisite?.properties?.includes(c.id) &&
                                        c.equipmentIds.includes(e.id)
                                    )
                                  )}
                                required={true}
                              />
                            </Grid.Col>
                          )}
                        </AppField>
                        <Grid.Col span={{ base: 6, md: 4, lg: 2 }} className={sprinkles({ alignContent: 'center' })}>
                          <Group className={sprinkles({ height: 'size-full' })} align='center' justify='flex-start'>
                            <UnstyledButton
                              className={row_button}
                              onClick={() => {
                                const equipPrerequisiteObject = EquipPrerequisiteInputSchema.parse({
                                  __kind: 'EquipPrerequisiteInput',
                                })
                                field.pushValue(equipPrerequisiteObject)
                                updateField({ path: `${path}.notEquipped`, value: equipPrerequisiteObject })
                              }}
                            >
                              <TbPlus />
                            </UnstyledButton>
                            {i !== 0 && (
                              <UnstyledButton
                                className={row_button}
                                onClick={() => {
                                  field.removeValue(i)
                                  updateField({ path: `${path}.notEquipped[${i}]`, value: undefined })
                                }}
                              >
                                <TbX />
                              </UnstyledButton>
                            )}
                          </Group>
                        </Grid.Col>
                      </Grid>
                    ))
                  }
                </AppField>
              </Grid.Col>
            )}
          </>
        </Grid>
      </Collapsible>
    </Grid.Col>
  )
}
export default Prerequisites
