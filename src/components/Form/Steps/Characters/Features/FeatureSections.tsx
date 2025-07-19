import { useMemo, type ReactNode } from 'react'
import type {
  CharacterModifierInput,
  CharacterExpertiseInput,
  CharacterProficiencyInput,
  CharacterSenseInput,
  CharacterFeatInput,
  CharacterSpellcastingInput,
  CharacterFeatureInput,
  CharacterInput,
} from '@/types'
import { useGetSections, useFieldUpdates, useGetFeatures, useFeatureData } from '@/hooks'
import { Grid, Group } from '@mantine/core'
import { proficiencyKey, kind } from '@/utils'
import { getKeyFromId, option_dropdown, withFieldGroup, SECTION_STEPS } from '@/components/Form'
import { Attributes, ProfCats } from '@/enums'
import type { CamelCase } from 'type-fest'
import { useFormStore } from '@/store'

type FeatureOptionProps = {
  featureIndex: number
  classId?: string
  raceId?: string
  backgroundId?: string
  equipmentId?: string
  featId?: string
  optionId?: string
}

const FeatureSections = withFieldGroup({
  defaultValues: {
    features: [] as CharacterFeatureInput[] | null | undefined,
    modifiers: [] as CharacterModifierInput[] | null | undefined,
    expertise: [] as CharacterExpertiseInput[] | null | undefined,
    proficiencies: [] as CharacterProficiencyInput[] | null | undefined,
    senses: [] as CharacterSenseInput[] | null | undefined,
    feats: [] as CharacterFeatInput[] | null | undefined,
    spellcasting: {} as CharacterSpellcastingInput | null | undefined,
  },
  props: {
    classId: undefined,
    raceId: undefined,
    backgroundId: undefined,
    equipmentId: undefined,
    featId: undefined,
    optionId: undefined,
    featureIndex: 0,
  } as FeatureOptionProps,
  render: function Render({ group, featureIndex, classId, raceId, backgroundId, equipmentId, featId, optionId }) {
    const { AppField } = group

    const formStore = useFormStore()
    const { featureOptions } = useFeatureData()
    const { createFeatures } = useGetFeatures()
    const { getSectionOptions, sectionTypeMap } = useGetSections()

    const { fieldListeners } = useFieldUpdates({ data: 'form' })
    const factoryFeatures = createFeatures({ data: formStore.current as CharacterInput })

    const values = useMemo(
      () => ({
        modifiers: (formStore.current as CharacterInput)?.modifiers || [],
        expertise: (formStore.current as CharacterInput)?.expertise || [],
        proficiencies: (formStore.current as CharacterInput)?.proficiencies || [],
        senses: (formStore.current as CharacterInput)?.senses || [],
        feats: (formStore.current as CharacterInput)?.feats || [],
        spellcasting: (formStore.current as CharacterInput)?.spellcasting || { __kind: 'CharacterSpellcastingInput' },
        features: (formStore.current as CharacterInput)?.features || [],
      }),
      [formStore]
    )

    const dropdowns = useMemo(() => {
      const option = optionId != null ? featureOptions.find((f) => f.id === optionId) : undefined
      const feature = factoryFeatures?.find(
        (f) => f.id === (formStore.current as CharacterInput)?.features?.[featureIndex]?.id
      )
      if (!feature) return
      const elements: ReactNode[] = []

      SECTION_STEPS.map(
        (sectionStep: (typeof SECTION_STEPS)[number]) =>
          feature?.[sectionStep]?.length &&
          feature?.[sectionStep].map((sectionId, sIndex) => {
            const sectionMap = sectionTypeMap(sectionStep)
            const section = sectionMap.schema.parse(sectionMap.get(sectionId))
            if (
              section?.attributes?.some((attribute) => attribute === Attributes.PROVIDES_OPTIONS) &&
              section?.__kind !== 'FeatureOptionInput'
            ) {
              // Check if selectionCount exists and is greater than 0
              const selectionCount = section?.selectionCount || 1

              for (let index = 0; index < selectionCount; index++) {
                const optionIndex = `${section?.__kind}-${featureIndex}-${sIndex}-${index}`

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
                            if (featId) valueObject.featId = featId
                            if (equipmentId) valueObject.equipmentId = equipmentId

                            // Add category-specific properties for proficiencies and expertise
                            if (
                              section.__kind === 'FeatureProficiencyInput' ||
                              section.__kind === 'FeatureExpertiseInput'
                            ) {
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
            }
          })
      )

      if (option) {
        SECTION_STEPS.map(
          (sectionStep: (typeof SECTION_STEPS)[number]) =>
            option?.[sectionStep]?.length &&
            option?.[sectionStep].map((sectionId, sIndex) => {
              const sectionMap = sectionTypeMap(sectionStep)
              const section = sectionMap.schema.parse(sectionMap.get(sectionId))
              if (
                section?.attributes?.some((attribute) => attribute === Attributes.PROVIDES_OPTIONS) &&
                section?.__kind !== 'FeatureOptionInput'
              ) {
                // Check if selectionCount exists and is greater than 0
                const selectionCount = section?.selectionCount || 1

                for (let index = 0; index < selectionCount; index++) {
                  const optionIndex = `${section?.__kind}-${featureIndex}-${sIndex}-${index}-${classId || raceId || backgroundId || featId || equipmentId}`

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
                                optionId: option.id,
                                featureId: feature.id!,
                                __kind: kind(
                                  sectionStep as Exclude<(typeof SECTION_STEPS)[number], 'spells'>,
                                  '__kind'
                                ),
                              }

                              // Add prop properties
                              if (classId) valueObject.classId = classId
                              if (raceId) valueObject.raceId = raceId
                              if (backgroundId) valueObject.backgroundId = backgroundId
                              if (featId) valueObject.featId = featId
                              if (equipmentId) valueObject.equipmentId = equipmentId

                              // Add category-specific properties for proficiencies and expertise
                              if (
                                section.__kind === 'FeatureProficiencyInput' ||
                                section.__kind === 'FeatureExpertiseInput'
                              ) {
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
              }
            })
        )
      }

      return elements
    }, [
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
      fieldListeners,
      formStore,
      factoryFeatures,
      sectionTypeMap,
      featureOptions,
    ])

    return <>{dropdowns}</>
  },
})
export default FeatureSections
