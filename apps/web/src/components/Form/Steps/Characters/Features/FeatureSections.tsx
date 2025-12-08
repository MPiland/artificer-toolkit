import { useMemo } from 'react'
import type {
  FeatureModifier,
  FeatureFeat,
  FeatureSense,
  FeatureSpell,
  FeatureProficiency,
  FeatureExpertise,
  FeatureModifierInput,
  FeatureExpertiseInput,
  FeatureProficiencyInput,
  FeatureSenseInput,
  FeatureFeatInput,
  FeatureSpellInput,
  CharacterInput,
  CharacterExpertiseInput,
  CharacterProficiencyInput,
  CharacterFeatInput,
  CharacterSpellInput,
  CharacterSenseInput,
  CharacterModifierInput,
} from '~types'
import { useFieldUpdates, useCharacterFeatureSectionOptions, useFormField } from '~hooks'
import { Grid, Group } from '@mantine/core'
import { proficiencyKey, kind, convertTypenameToKindInput } from '~utils'
import { getKeyFromId, option_dropdown, SECTION_STEPS } from '~components/Form'
import { ProfCats } from '~enums'
import type { CamelCase } from 'type-fest'
import { useGetFeature, useGetFeatureOption } from '~apis'
import { useOptimizedSelector, useTypedFormStore } from '~store'

const FeatureSections = ({
  featureId,
  classId,
  raceId,
  backgroundId,
  equipmentId,
  featId,
  optionId,
  ancestryId,
}: {
  featureId: string
  classId?: string
  raceId?: string
  backgroundId?: string
  equipmentId?: string
  featId?: string
  optionId?: string
  ancestryId?: string
}) => {
  const store = useTypedFormStore<CharacterInput>()

  const { AppField } = useFormField({ store })

  const { updateField, characterFeature } = useOptimizedSelector(store, (state) => ({
    updateField: state.updateField,
    characterFeature: state.current?.features?.find((f) => f.id === featureId),
  }))

  const { data: option } = useGetFeatureOption(optionId || '')
  const { data: feature } = useGetFeature(featureId || '')!

  const data = !option ? feature : option

  const { fieldListeners } = useFieldUpdates()

  const SectionWrapper = () => {
    return SECTION_STEPS.map(
      (sectionStep: (typeof SECTION_STEPS)[number]) =>
        data?.[sectionStep]?.length &&
        data?.[sectionStep].map((section, sIndex) => {
          return <SectionOption key={section.id} section={section} sIndex={sIndex} sectionStep={sectionStep} />
        })
    )
  }

  const SectionOption = ({
    section,
    sIndex,
    sectionStep,
  }: {
    section: FeatureModifier | FeatureFeat | FeatureSense | FeatureSpell | FeatureProficiency | FeatureExpertise
    sIndex: number
    sectionStep: (typeof SECTION_STEPS)[number]
  }) => {
    const optionIndices = useMemo(() => {
      return Array.from({ length: section?.selectionCount || 1 }, (_, index) => ({
        index,
        optionIndex: `${section?.__typename}-${optionId || featureId}-${sIndex}-${index}`,
      }))
    }, [sIndex, section])

    const sectionInput = convertTypenameToKindInput(section) as
      | FeatureModifierInput
      | FeatureFeatInput
      | FeatureSenseInput
      | FeatureSpellInput
      | FeatureProficiencyInput
      | FeatureExpertiseInput

    return (
      <>
        {optionIndices.map(({ optionIndex }) => {
          return (
            <SectionOptionField
              key={optionIndex}
              section={sectionInput}
              sectionStep={sectionStep}
              optionIndex={optionIndex}
            />
          )
        })}
      </>
    )
  }

  const SectionOptionField = ({
    section,
    sectionStep,
    optionIndex,
  }: {
    section:
      | FeatureModifierInput
      | FeatureFeatInput
      | FeatureSenseInput
      | FeatureSpellInput
      | FeatureProficiencyInput
      | FeatureExpertiseInput
    sectionStep: (typeof SECTION_STEPS)[number]
    optionIndex: string
  }) => {
    const { options, label, path, exist } = useCharacterFeatureSectionOptions({
      section,
      sectionStep,
      optionIndex,
    })
    return (
      <Grid.Col>
        <Group justify='center'>
          <AppField
            name={path}
            listeners={{
              ...fieldListeners,
              onChange: ({ value }) => {
                if (value == null || typeof value === 'boolean') return updateField({ path, value: undefined })
                const valueObject:
                  | CharacterExpertiseInput
                  | CharacterModifierInput
                  | CharacterProficiencyInput
                  | CharacterFeatInput
                  | CharacterSpellInput
                  | CharacterSenseInput = {
                  id: value as string,
                  optionIndex,
                  featureId: feature?.id,
                  __kind: kind(sectionStep as Exclude<(typeof SECTION_STEPS)[number], 'spells'>, '__kind'),
                }

                // Add prop properties
                if (characterFeature?.level && characterFeature.level >= 1) {
                  valueObject.featureLevel = characterFeature.level
                }
                if (classId) valueObject.classId = classId
                if (raceId) valueObject.raceId = raceId
                if (backgroundId) valueObject.backgroundId = backgroundId
                if (featId) valueObject.featId = featId
                if (equipmentId) valueObject.equipmentId = equipmentId
                if (ancestryId) valueObject.ancestryId = ancestryId

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

                return updateField({ path, value: valueObject })
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

  return <SectionWrapper />
}
export default FeatureSections
