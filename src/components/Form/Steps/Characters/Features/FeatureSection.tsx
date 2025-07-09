import { useMemo } from 'react'
import type {
  SectionFormDataType,
  CharacterModifierInput,
  CharacterExpertiseInput,
  CharacterProficiencyInput,
  CharacterSenseInput,
  CharacterFeatInput,
  CharacterSpellcastingInput,
  CharacterFeatureInput,
} from '@/types'
import { useGetSections, useFieldUpdates } from '@/hooks'
import { Grid, Group } from '@mantine/core'
import { proficiencyKey, kind } from '@/utils'
import { getKeyFromId, option_dropdown, withFieldGroup, SECTION_STEPS } from '@/components/Form'
import { ProfCats } from '@/enums'
import type { CamelCase } from 'type-fest'
import { useStore } from '@tanstack/react-form'
import { useFormStore } from '@/store'

const defaultValues: {
  modifiers?: CharacterModifierInput[]
  expertise?: CharacterExpertiseInput[]
  proficiencies?: CharacterProficiencyInput[]
  senses?: CharacterSenseInput[]
  feats?: CharacterFeatInput[]
  spellcasting?: CharacterSpellcastingInput
  features?: CharacterFeatureInput[]
} = {
  modifiers: [],
  expertise: [],
  proficiencies: [],
  senses: [],
  feats: [],
  spellcasting: undefined,
  features: [],
}

type FeatureOptionProps = {
  section?: SectionFormDataType
  sectionStep?: (typeof SECTION_STEPS)[number]
  featureIndex: number
  classIndex?: number
  classId?: string
  raceId?: string
  backgroundId?: string
  equipmentId?: string
  featId?: string
  optionId?: string
  feature: CharacterFeatureInput
}

const FeatureSection = withFieldGroup({
  defaultValues,
  props: {
    section: undefined,
    sectionStep: undefined,
    classIndex: undefined,
    classId: undefined,
    raceId: undefined,
    backgroundId: undefined,
    equipmentId: undefined,
    featId: undefined,
    optionId: undefined,
  } as FeatureOptionProps,
  render: function Render({
    group,
    section,
    sectionStep,
    featureIndex,
    classIndex,
    classId,
    raceId,
    backgroundId,
    equipmentId,
    featId,
    optionId,
    feature,
  }) {
    const { AppField } = group

    const formStore = useFormStore()

    const { fieldListeners } = useFieldUpdates({ data: 'form' })

    const { getSectionOptions } = useGetSections()

    const valuesStore = useStore(group.store, (state) => state.values)

    const values = useMemo(
      () => ({
        modifiers: valuesStore.modifiers || [],
        expertise: valuesStore.expertise || [],
        proficiencies: valuesStore.proficiencies || [],
        senses: valuesStore.senses || [],
        feats: valuesStore.feats || [],
        spellcasting: valuesStore.spellcasting || { __kind: 'CharacterSpellcastingInput' },
        features: valuesStore.features || [],
      }),
      [valuesStore]
    )

    // Check if selectionCount exists and is greater than 0
    const selectionCount = section?.selectionCount || 1

    const dropdowns = useMemo(() => {
      if (!section || !sectionStep) return
      const elements = []

      for (let index = 0; index < selectionCount; index++) {
        const optionIndex = `${index}${featureIndex}${classIndex || 0}`

        const { options, label, path, exist } = getSectionOptions({
          data: values,
          section,
          sectionStep,
          optionIndex,
        })

        elements.push(
          <Grid.Col key={path + optionIndex}>
            <Group justify='center'>
              <AppField
                name={path}
                listeners={{
                  ...fieldListeners,
                  onChange: ({ value }) => {
                    if (value == null || typeof value === 'boolean') return formStore.removeField({ path })
                    const valueObject: {
                      id: string
                      optionIndex: string
                      featureId?: string
                      featureLevel?: number
                      classId?: string
                      raceId?: string
                      backgroundId?: string
                      featId?: string
                      equipmentId?: string
                      optionId?: string
                      equipment?: string
                      skill?: string
                      property?: string
                      language?: string
                      saveAbility?: string
                      __kind:
                        | 'CharacterExpertiseInput'
                        | 'CharacterProficiencyInput'
                        | 'CharacterModifierInput'
                        | 'CharacterSenseInput'
                        | 'CharacterSpellInput'
                        | 'CharacterFeatInput'
                    } = {
                      id: value as string,
                      optionIndex,
                      featureId: feature.id!,
                      __kind: kind(sectionStep as Exclude<(typeof SECTION_STEPS)[number], 'spells'>, '__kind'),
                    }

                    // Add prop properties
                    if (feature.level && feature.level >= 1) {
                      valueObject.featureLevel = feature.level
                    }
                    if (classId) valueObject.classId = classId
                    if (raceId) valueObject.raceId = raceId
                    if (backgroundId) valueObject.backgroundId = backgroundId
                    if (optionId) valueObject.optionId = optionId
                    if (featId) valueObject.featId = featId
                    if (equipmentId) valueObject.equipmentId = equipmentId

                    // Add category-specific properties for proficiencies and expertise
                    if (section.__kind === 'FeatureProficiencyInput' || section.__kind === 'FeatureExpertiseInput') {
                      const categoryId = section.category
                      const categoryName = getKeyFromId(categoryId, ProfCats)

                      // If we have a valid category, add the appropriate property
                      if (categoryName && categoryName !== 'initiative') {
                        // Use the proficiencyKey helper to get the correct property name
                        const propertyName = proficiencyKey(
                          categoryName as Exclude<CamelCase<keyof typeof ProfCats>, 'initiative'>
                        )
                        if (propertyName) {
                          // Set the property using the selected value
                          valueObject[propertyName] = value as string
                        }
                      }
                    }

                    return formStore.updateField({ path, value: valueObject })
                  },
                }}
              >
                {({ DropdownField }) => (
                  <DropdownField label={label} options={options} className={option_dropdown} exist={exist} />
                )}
              </AppField>
            </Group>
          </Grid.Col>
        )
      }

      return elements
    }, [
      selectionCount,
      section,
      sectionStep,
      classIndex,
      featureIndex,
      getSectionOptions,
      values,
      AppField,
      backgroundId,
      classId,
      raceId,
      featId,
      optionId,
      equipmentId,
      feature,
      fieldListeners,
      formStore,
    ])

    return <>{dropdowns}</>
  },
})
export default FeatureSection
