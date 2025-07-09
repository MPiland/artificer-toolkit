import { sprinkles } from '@/css/sprinkles.css'
import { TbPlus, TbX } from 'react-icons/tb'
import { useEffect, useMemo } from 'react'
import Collapsible from '@/components/Collapsible'
import { Grid, Group, Divider, UnstyledButton } from '@mantine/core'
import { useSystemData, useSpellData, useEquipmentData, useEnumChecks, useFieldUpdates } from '@/hooks'
import { Features } from '@/enums'
import { EquipPrerequisiteInputSchema } from '@/schemas'
import { withFieldGroup, row_button } from '@/components/Form'
import { useStore } from '@tanstack/react-form'
import useFeatureData from 'src/hooks/useFeatureData'
import type { PrerequisiteInput } from 'gql/types'

type PrerequisitesProps = {
  __kind:
    | 'FeatureSpellInput'
    | 'FeatureSenseInput'
    | 'FeatureModifierInput'
    | 'FeatureExpertiseInput'
    | 'FeatureProficiencyInput'
    | 'FeatureFeatInput'
    | 'FeatInput'
    | 'FeatureInput'
    | 'AncestryFeatureInput'
    | 'FeatureOptionInput'
  features?: string[] | undefined
  removeFn: (arg: { path: string }) => void
  updateFn: (arg: { path: string; value: unknown }) => void
}

const Prerequisites = withFieldGroup({
  defaultValues: {} as PrerequisiteInput,
  props: {
    __kind: 'FeatureInput',
    features: undefined,
    removeFn: (() => undefined) as () => void,
    updateFn: (() => undefined) as () => void,
    getFn: (() => undefined) as () => void,
  } as PrerequisitesProps,
  render: function Render({ group, __kind, features: featureIds, removeFn, updateFn }) {
    const { AppField, Subscribe } = group

    const dataType = () => {
      switch (__kind) {
        case 'FeatureSpellInput':
          return 'spell'
        case 'FeatureSenseInput':
          return 'sense'
        case 'FeatureModifierInput':
          return 'modifier'
        case 'FeatureExpertiseInput':
          return 'expertise'
        case 'FeatureProficiencyInput':
          return 'proficiency'
        case 'FeatureFeatInput':
          return 'feat'
        case 'AncestryFeatureInput':
        case 'FeatureInput':
          return 'feature'
        case 'FeatureOptionInput':
          return 'option'
        default:
          return 'form'
      }
    }

    const { fieldListeners, fieldValidators } = useFieldUpdates({
      data: dataType(),
      path: 'prerequisites',
    })

    const { options, equipmentProficiencies, equipped, notEquipped, featuresObtained } = useStore(
      group.store,
      (state) => ({
        options: state.values.options,
        equipmentProficiencies: state.values.equipmentProficiencies,
        equipped: state.values.equipped,
        notEquipped: state.values.notEquipped,
        featuresObtained: state.values.featuresObtained,
      })
    )

    const {
      abilities,
      prerequisites,
      skills,
      equipment: { categories: equipmentCategories, properties: equipmentProperties },
    } = useSystemData()

    const { features, featureOptions } = useFeatureData()
    const { spells } = useSpellData()
    const { equipment } = useEquipmentData()
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
        const proficiencyInputObj = EquipPrerequisiteInputSchema.parse({})
        group.setFieldValue('equipmentProficiencies[0]', proficiencyInputObj)
        updateFn({ path: 'prerequisites.equipmentProficiencies[0]', value: [proficiencyInputObj] })
      }

      if (equippedPrereq && !equipped?.length) {
        const equippedInputObj = EquipPrerequisiteInputSchema.parse({})
        group.setFieldValue('equipped[0]', equippedInputObj)
        updateFn({ path: 'prerequisites.equipped[0]', value: [equippedInputObj] })
      }

      if (notEquippedPrereq && !notEquipped?.length) {
        const notEquippedInputObj = EquipPrerequisiteInputSchema.parse({})
        group.setFieldValue('notEquipped[0]', notEquippedInputObj)
        updateFn({ path: 'prerequisites.notEquipped[0]', value: [notEquippedInputObj] })
      }
    }, [
      equipmentProficiency,
      equipped,
      notEquipped,
      notEquippedPrereq,
      equippedPrereq,
      equipmentProficiencies,
      group,
      updateFn,
    ])

    // TODO: Figure out how to map feature data from main data (ex: Class, Race, etc) to features constant

    const featuresObtainedOptions = useMemo(() => {
      const mappedFeatures = features
        .filter((feature) => featureIds?.includes(feature.id))
        ?.map((feature) => {
          if (feature.label != null) {
            return {
              ...feature,
              label: feature.label,
              id: feature.id,
            }
          }
          return null
        })

      return mappedFeatures?.filter((feature) => feature != null) || []
    }, [features, featureIds])

    const optionsObtainedOptions = useMemo(() => {
      const mappedOptions = featuresObtained?.flatMap((feature) =>
        featuresObtainedOptions
          .filter(Boolean)
          ?.find((sFeature) => sFeature?.id === feature)
          ?.options?.map((optionId) => {
            const option = featureOptions?.findFeatureOption(optionId)
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
    }, [featuresObtainedOptions, featuresObtained, featureOptions])

    return (
      <Grid.Col>
        <Collapsible>
          <Collapsible.Trigger title='Prerequisites' />
          <Collapsible.Content>
            <Grid>
              <Subscribe
                selector={(state) => ({
                  optionsObtained: state.values.optionsObtained,
                })}
              >
                {({ optionsObtained }) => (
                  <>
                    <Grid.Col>
                      <Grid>
                        <AppField
                          name='options'
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
                                      (__kind === 'FeatureOptionInput' &&
                                        prerequisite?.features.includes(Features.OPTION)))
                                )}
                                required={true}
                              />
                            </Grid.Col>
                          )}
                        </AppField>
                        {spellsObtainedPrereq && (
                          <AppField
                            name='spellsObtained'
                            validators={fieldValidators({
                              onBlur: 'Please select at least one spell',
                            })}
                            listeners={fieldListeners}
                          >
                            {({ DropdownField }) => (
                              <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                                <DropdownField multiselect={true} label='Spell(s)' options={spells} required={true} />
                              </Grid.Col>
                            )}
                          </AppField>
                        )}
                        {featuresObtainedPrereq && (
                          <AppField
                            name='featuresObtained'
                            validators={fieldValidators({
                              onBlur: 'Please select at least one feature',
                            })}
                            listeners={fieldListeners}
                          >
                            {({ DropdownField }) => (
                              <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                                <DropdownField
                                  multiselect={true}
                                  label='Feature(s)'
                                  options={featuresObtainedOptions}
                                  required={true}
                                />
                              </Grid.Col>
                            )}
                          </AppField>
                        )}
                        {optionsObtainedPrereq &&
                          optionsObtained?.some(
                            (feature) =>
                              featuresObtainedOptions.filter(Boolean)?.find((sFeature) => sFeature?.id === feature)
                                ?.options?.length
                          ) && (
                            <AppField
                              name='optionsObtained'
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
                            name='skillProficiencies'
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
                              name='abilityScore.abilities'
                              validators={fieldValidators({
                                onBlur: 'Please select at least one ability',
                              })}
                              listeners={fieldListeners}
                            >
                              {({ DropdownField }) => (
                                <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                                  <DropdownField
                                    multiselect={true}
                                    label='Abilities'
                                    options={abilities}
                                    required={true}
                                  />
                                </Grid.Col>
                              )}
                            </AppField>
                            <AppField
                              name='abilityScore.score'
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
                        <AppField name='equipmentProficiencies' mode='array'>
                          {(field) =>
                            field.state.value?.map((equipmentProficieny, i) => (
                              <Grid key={`${i}-equipmentProficiencies`}>
                                <AppField name={`equipmentProficiencies[${i}].category`} listeners={fieldListeners}>
                                  {({ DropdownField }) => (
                                    <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                                      <DropdownField
                                        label='Equipment Category'
                                        options={equipmentCategories.filterByProperties(
                                          equipmentProficieny?.properties
                                        )}
                                      />
                                    </Grid.Col>
                                  )}
                                </AppField>
                                <AppField name={`equipmentProficiencies[${i}].properties`} listeners={fieldListeners}>
                                  {({ DropdownField }) => (
                                    <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                                      <DropdownField
                                        multiselect={true}
                                        label='Equipment Category'
                                        options={equipmentCategories.filterByProperties(
                                          equipmentProficieny?.properties
                                        )}
                                      />
                                    </Grid.Col>
                                  )}
                                </AppField>
                                <AppField
                                  name={`equipmentProficiencies[${i}].equipment`}
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
                                          .filterByCategory(equipmentProficieny?.category)
                                          .filterByProperties(equipmentProficieny?.properties)}
                                        required={true}
                                      />
                                    </Grid.Col>
                                  )}
                                </AppField>
                                <Grid.Col
                                  span={{ base: 6, md: 4, lg: 2 }}
                                  className={sprinkles({ alignContent: 'center' })}
                                >
                                  <Group
                                    className={sprinkles({ height: 'size-full' })}
                                    align='center'
                                    justify='flex-start'
                                  >
                                    <UnstyledButton
                                      className={row_button}
                                      onClick={() => {
                                        const equipPrerequisiteObject = EquipPrerequisiteInputSchema.parse({})
                                        field.pushValue(equipPrerequisiteObject)
                                        updateFn({ path: 'equipmentProficiencies', value: equipPrerequisiteObject })
                                      }}
                                    >
                                      <TbPlus />
                                    </UnstyledButton>
                                    {i !== 0 && (
                                      <UnstyledButton
                                        className={row_button}
                                        onClick={() => {
                                          field.removeValue(i)
                                          removeFn({ path: `equipmentProficiencies[${i}]` })
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
                        <AppField name='equipped' mode='array'>
                          {(field) =>
                            field.state.value?.map((equipPrerequisite, i) => (
                              <Grid key={`${i}-equipped`}>
                                <AppField name={`equipped[${i}].category`} listeners={fieldListeners}>
                                  {({ DropdownField }) => (
                                    <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                                      <DropdownField
                                        label='Equipment Category'
                                        options={equipmentCategories.filterByProperties(equipPrerequisite?.properties)}
                                      />
                                    </Grid.Col>
                                  )}
                                </AppField>
                                <AppField name={`equipped[${i}].properties`} listeners={fieldListeners}>
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
                                  name={`equipped[${i}].equipment`}
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
                                          .filterByCategory(equipPrerequisite?.category)
                                          .filterByProperties(equipPrerequisite?.properties)}
                                        required={true}
                                      />
                                    </Grid.Col>
                                  )}
                                </AppField>
                                <AppField
                                  name={`equipped[${i}].numberEquipped`}
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
                                <Grid.Col
                                  span={{ base: 6, md: 4, lg: 2 }}
                                  className={sprinkles({ alignContent: 'center' })}
                                >
                                  <Group
                                    className={sprinkles({ height: 'size-full' })}
                                    align='center'
                                    justify='flex-start'
                                  >
                                    <UnstyledButton
                                      className={row_button}
                                      onClick={() => {
                                        const equipPrerequisiteObject = EquipPrerequisiteInputSchema.parse({})
                                        field.pushValue(equipPrerequisiteObject)
                                        updateFn({ path: 'prerequisites.equipped', value: equipPrerequisiteObject })
                                      }}
                                    >
                                      <TbPlus />
                                    </UnstyledButton>
                                    {i !== 0 && (
                                      <UnstyledButton
                                        className={row_button}
                                        onClick={() => {
                                          field.removeValue(i)
                                          removeFn({ path: `prerequisites.equipped[${i}]` })
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
                        <AppField name='notEquipped' mode='array'>
                          {(field) =>
                            field.state.value?.map((notEquipPrerequisite, i) => (
                              <Grid key={`${i}-notEquipped`}>
                                <AppField name={`notEquipped[${i}].category`} listeners={fieldListeners}>
                                  {({ DropdownField }) => (
                                    <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                                      <DropdownField
                                        label='Equipment Category'
                                        options={equipmentCategories.filterByProperties(
                                          notEquipPrerequisite?.properties
                                        )}
                                      />
                                    </Grid.Col>
                                  )}
                                </AppField>
                                <AppField name={`notEquipped[${i}].properties`} listeners={fieldListeners}>
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
                                  name={`notEquipped[${i}].equipment`}
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
                                          .filterByCategory(notEquipPrerequisite?.category)
                                          .filterByProperties(notEquipPrerequisite?.properties)}
                                        required={true}
                                      />
                                    </Grid.Col>
                                  )}
                                </AppField>
                                <Grid.Col
                                  span={{ base: 6, md: 4, lg: 2 }}
                                  className={sprinkles({ alignContent: 'center' })}
                                >
                                  <Group
                                    className={sprinkles({ height: 'size-full' })}
                                    align='center'
                                    justify='flex-start'
                                  >
                                    <UnstyledButton
                                      className={row_button}
                                      onClick={() => {
                                        const equipPrerequisiteObject = EquipPrerequisiteInputSchema.parse({})
                                        field.pushValue(equipPrerequisiteObject)
                                        updateFn({ path: 'prerequisites.notEquipped', value: equipPrerequisiteObject })
                                      }}
                                    >
                                      <TbPlus />
                                    </UnstyledButton>
                                    {i !== 0 && (
                                      <UnstyledButton
                                        className={row_button}
                                        onClick={() => {
                                          field.removeValue(i)
                                          removeFn({ path: `prerequisites.notEquipped[${i}]` })
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
                )}
              </Subscribe>
            </Grid>
          </Collapsible.Content>
        </Collapsible>
      </Grid.Col>
    )
  },
})

export default Prerequisites
