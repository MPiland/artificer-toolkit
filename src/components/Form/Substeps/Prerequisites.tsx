import { z } from 'zod/v4'
import { sprinkles } from '@/css/sprinkles.css'
import { row_button } from '../Form.css'
import { TbPlus, TbX } from 'react-icons/tb'
import { useEffect, useMemo } from 'react'
import Collapsible from '@/components/Collapsible'
import { Grid, Group, Divider, UnstyledButton } from '@mantine/core'
import { useSystemData, useSpellData, useEquipmentData, useEnumChecks } from '@/hooks'
import { Features } from '@/enums'
import { PrerequisiteInputSchema, EquipPrerequisiteInputSchema } from '@/schemas'
import { withFieldGroup } from '../utils/factory'
import { useStore } from '@tanstack/react-form'

const defaultValues: z.input<typeof PrerequisiteInputSchema> = PrerequisiteInputSchema.parse({})

const Prerequisites = withFieldGroup({
  defaultValues,
  props: {
    __kind: '' as
      | 'FeatureSpellInput'
      | 'FeatureSenseInput'
      | 'FeatureModifierInput'
      | 'FeatureExpertiseInput'
      | 'FeatureProficiencyInput'
      | 'FeatureFeatInput'
      | 'FeatInput'
      | 'FeatureInput'
      | 'AncestryFeatureInput'
      | 'FeatureOptionInput',
    features: [] as string[],
  },
  render: function Render({ group, __kind, features }) {
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

    const { AppField, Subscribe } = group

    const {
      abilities,
      prerequisites,
      skills,
      equipment: { categories: equipmentCategories, properties: equipmentProperties },
    } = useSystemData()
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
        group.setFieldValue('equipmentProficiencies[0]', EquipPrerequisiteInputSchema.parse({}))
      }

      if (equippedPrereq && !equipped?.length) {
        group.setFieldValue('equipped[0]', EquipPrerequisiteInputSchema.parse({}))
      }

      if (notEquippedPrereq && !notEquipped?.length) {
        group.setFieldValue('notEquipped[0]', EquipPrerequisiteInputSchema.parse({}))
      }
    }, [equipmentProficiency, equipped, notEquipped, notEquippedPrereq, equippedPrereq, equipmentProficiencies, group])

    // TODO: Figure out how to map feature data from main data (ex: Class, Race, etc) to features constant

    const featuresObtainedOptions = useMemo(() => {
      const mappedFeatures = features?.map((feature) => {
        if (feature.label != null && feature.value != null) {
          return {
            ...feature,
            label: feature.label,
            value: feature.value,
            id: feature.id,
          }
        }
        return null
      })

      return mappedFeatures?.filter((feature) => feature != null) || []
    }, [features])

    const optionsObtainedOptions = useMemo(() => {
      const mappedOptions = featuresObtained?.flatMap((feature) =>
        featuresObtainedOptions
          .filter(Boolean)
          ?.find((sFeature) => sFeature?.id === feature)
          ?.options?.map((option) => {
            if (option.label != null && option.value != null) {
              return {
                ...option,
                label: option.label,
                value: option.value,
                id: option.id,
              }
            }
            return null
          })
      )

      return mappedOptions?.filter((option) => option != null) || []
    }, [featuresObtainedOptions, featuresObtained])

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
                          validators={{
                            onSubmit: ({ value }) => !value && 'Please select at least one option',
                          }}
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
                            validators={{
                              onSubmit: ({ value }) => !value?.length && 'Please select at least one spell',
                            }}
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
                            validators={{
                              onSubmit: ({ value }) => !value?.length && 'Please select at least one feature',
                            }}
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
                              validators={{
                                onSubmit: ({ value }) => !value?.length && 'Please select at least one feature option',
                              }}
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
                            validators={{
                              onSubmit: ({ value }) => !value?.length && 'Please select at least one skill',
                            }}
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
                              validators={{
                                onSubmit: ({ value }) => !value?.length && 'Please select at least one ability',
                              }}
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
                              validators={{
                                onSubmit: ({ value }) => !value && 'Please enter an ability score requirement',
                                onChange: z.int('Score must be a whole number').gte(1, 'Score must be greater than 0'),
                              }}
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
                                <AppField name={`equipmentProficiencies[${i}].category`}>
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
                                <AppField name={`equipmentProficiencies[${i}].properties`}>
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
                                  validators={{
                                    onSubmit: ({ value }) => !value?.length && 'Please select an equipment',
                                  }}
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
                                      onClick={() => field.pushValue(EquipPrerequisiteInputSchema.parse({}))}
                                    >
                                      <TbPlus />
                                    </UnstyledButton>
                                    {i !== 0 && (
                                      <UnstyledButton className={row_button} onClick={() => field.removeValue(i)}>
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
                                <AppField name={`equipped[${i}].category`}>
                                  {({ DropdownField }) => (
                                    <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                                      <DropdownField
                                        label='Equipment Category'
                                        options={equipmentCategories.filterByProperties(equipPrerequisite?.properties)}
                                      />
                                    </Grid.Col>
                                  )}
                                </AppField>
                                <AppField name={`equipped[${i}].properties`}>
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
                                  validators={{
                                    onSubmit: ({ value }) => !value?.length && 'Please select an equipment',
                                  }}
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
                                  validators={{
                                    onSubmit: ({ value }) => !value && 'Please select an equipment',
                                    onChange: z
                                      .int('Number equipped must be a whole number')
                                      .gte(1, 'Number equipped must be greater than 0'),
                                  }}
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
                                      onClick={() => field.pushValue(EquipPrerequisiteInputSchema.parse({}))}
                                    >
                                      <TbPlus />
                                    </UnstyledButton>
                                    {i !== 0 && (
                                      <UnstyledButton className={row_button} onClick={() => field.removeValue(i)}>
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
                                <AppField name={`notEquipped[${i}].category`}>
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
                                <AppField name={`notEquipped[${i}].properties`}>
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
                                  validators={{
                                    onSubmit: ({ value }) => !value?.length && 'Please select at least one equipment',
                                  }}
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
                                      onClick={() => field.pushValue(EquipPrerequisiteInputSchema.parse({}))}
                                    >
                                      <TbPlus />
                                    </UnstyledButton>
                                    {i !== 0 && (
                                      <UnstyledButton
                                        className={row_button}
                                        onClick={() => {
                                          field.removeValue(i)
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
