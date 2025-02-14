import {
  AncestryFeature,
  AncestryOption,
  Character,
  CharacterExpertise,
  CharacterFeat,
  CharacterFeature,
  CharacterModifier,
  CharacterProficiency,
  CharacterSense,
  Class,
  Feature,
  FeatureExpertise,
  FeatureFeat,
  FeatureModifier,
  FeatureOption,
  FeatureProficiency,
  FeatureSense,
  Race,
  Scores,
  Spell,
} from '../../amplify/gql/types'
import { DeepKeyOf, SectionDataType, SectionName } from '../types/form'
import {
  Attributes,
  ModifierCategories,
  ModifierSpellCategories,
  ProficiencyCategories,
  ModifierTypes,
  ModifierMethods,
} from '../types/enums'
import { useListClassesQuery } from '../features/classes/classesApi'
import { useListEquipmentQuery } from '../features/equipment/equipmentApi'
import { useListSpellsQuery } from '../features/spells/spellsApi'
import { useGetSystemQuery } from '../features/systems/systemsApi'
import { getKeyFromId, getModifierProperties } from '../utils/form'
import { useListRacesQuery } from '../features/races/racesApi'
import { useListFeatsQuery } from '../features/feats/featsApi'
import { useListBackgroundsQuery } from '../features/backgrounds/backgroundsApi'
import { sectionSteps } from '../types/form'

export type ClassProficiency = {
  [key: string]: {
    type: { id: string; label: string; value: string }[]
    property?: any[]
    selectionCount: number | null
    proficiencyId: string
  }
}

const useGetSections = ({ formData }: { formData: Character }) => {
  const { data: classes } = useListClassesQuery()
  const { data: system } = useGetSystemQuery()
  const { data: spells } = useListSpellsQuery()
  const { data: races } = useListRacesQuery()
  const { data: feats } = useListFeatsQuery()
  const { data: equipment } = useListEquipmentQuery()
  const { data: backgrounds } = useListBackgroundsQuery()

  const getStateProficiencies = ({ categoryName }: { categoryName?: keyof typeof ProficiencyCategories }) => {
    const existing: Array<{ index: number; id: string }> = []

    const sections = formData.proficiencies
    sections?.forEach((section) => {
      let fullSections: Array<FeatureProficiency>
      let fullFeature: Feature | FeatureOption | AncestryFeature
      const featureId = section.featureId
      const classId = section.classId
      const raceId = section.raceId
      const backgroundId = section.backgroundId
      const featId = section.featId
      const ancestryId = section.ancestryId
      const proficiencyId = section.proficiencyId
      const equipmentId = section.equipmentId
      const optionId = section.optionId
      const optionIndex = section.optionIndex
      if (optionId) {
        // If the section provided options and they were chosen, add them to the existing ID array first.
        existing.push({ index: optionIndex, id: optionId })
      }
      if (classId) {
        const fullClass = classes.find((uClass) => uClass.id === classId)

        if (!featureId) {
          fullSections = fullClass.proficiencies
        } else {
          fullFeature = fullClass.features.find((feature) => feature.id === featureId)
        }
      }
      if (raceId) {
        const fullRace = races.find((race) => race.id === raceId)
        if (ancestryId) {
          const fullAncestry = fullRace.ancestry?.options?.find((option) => option.id === ancestryId)

          fullFeature = fullAncestry.features.find((feature) => feature.id === featureId)
        } else {
          fullFeature = fullRace.features.find((feature) => feature.id === featureId)
        }
      }
      if (featId) {
        const fullFeat = feats.find((feat) => feat.id === featId)

        fullFeature = fullFeat.features.find((feature) => feature.id === featureId)
      }
      if (backgroundId) {
        const fullBackground = backgrounds.find((background) => background.id === backgroundId)

        fullFeature = fullBackground.features.find((feature) => feature.id === featureId)
      }
      if (equipmentId) {
        const fullEquipment = equipment.find((equipment) => equipment.id === equipmentId)

        fullFeature = fullEquipment.features.find((feature) => feature.id === featureId)
      }
      if (fullSections == null) {
        if ((fullFeature as Feature | AncestryFeature)?.options?.length > 0) {
          fullSections = (fullFeature as Feature | AncestryFeature)?.options?.find(
            (option) => option.id === optionId
          ).proficiencies
        }
      }

      fullSections?.forEach((proficiency) => {
        // If the sections do not provide options, pass the set ids from the category/subcategory
        // The ones that did provides options are already set in the above in if options condition
        if (!proficiency?.attributes?.some((attribute) => attribute === Attributes.providesOptions)) {
          if (proficiency.id === proficiencyId) {
            if (categoryName && categoryName !== 'initiative') {
              if (categoryName === 'equipment') {
                const proficiencyState = proficiency[categoryName]
                for (const id in proficiencyState.ids) {
                  existing.push({ index: optionIndex, id })
                }
              } else if (categoryName === 'properties') {
                const proficiencyState = proficiency[categoryName]
                for (const property in proficiencyState.properties) {
                  existing.push({ index: optionIndex, id: property })
                }
              } else {
                // If the proficiency is skills, saveAbilities, or languages, pass the ids
                for (const id in proficiency[categoryName]) {
                  existing.push({ index: optionIndex, id: id })
                }
              }
            }
          }
        }
      })
    })

    return existing
  }

  const getStateExpertise = ({ categoryName }: { categoryName?: keyof typeof ProficiencyCategories }) => {
    const existing: Array<{ index: number; id: string }> = []

    const sections = formData.expertise
    sections?.forEach((section) => {
      let fullSections: Array<FeatureExpertise>
      let fullFeature: Feature | FeatureOption | AncestryFeature
      const featureId = section.featureId
      const classId = section.classId
      const raceId = section.raceId
      const backgroundId = section.backgroundId
      const featId = section.featId
      const ancestryId = section.ancestryId
      const expertiseId = section.expertiseId
      const equipmentId = section.equipmentId
      const optionId = section.optionId
      const optionIndex = section.optionIndex
      if (optionId) {
        // If the section provided options and they were chosen, add them to the existing ID array first.
        existing.push({ index: optionIndex, id: optionId })
      }
      if (classId) {
        const fullClass = classes.find((uClass) => uClass.id === classId)

        fullFeature = fullClass.features.find((feature) => feature.id === featureId)
      }
      if (raceId) {
        const fullRace = races.find((race) => race.id === raceId)
        if (ancestryId) {
          const fullAncestry = fullRace.ancestry?.options?.find((option) => option.id === ancestryId)

          fullFeature = fullAncestry.features.find((feature) => feature.id === featureId)
        } else {
          fullFeature = fullRace.features.find((feature) => feature.id === featureId)
        }
      }
      if (featId) {
        const fullFeat = feats.find((feat) => feat.id === featId)

        fullFeature = fullFeat.features.find((feature) => feature.id === featureId)
      }
      if (backgroundId) {
        const fullBackground = backgrounds.find((background) => background.id === backgroundId)

        fullFeature = fullBackground.features.find((feature) => feature.id === featureId)
      }
      if (equipmentId) {
        const fullEquipment = equipment.find((equipment) => equipment.id === equipmentId)

        fullFeature = fullEquipment.features.find((feature) => feature.id === featureId)
      }

      if ((fullFeature as Feature | AncestryFeature)?.options.length > 0) {
        fullSections = (fullFeature as Feature | AncestryFeature)?.options.find(
          (option) => option.id === optionId
        ).expertise
      } else {
        fullSections?.forEach((expertise) => {
          // If the sections do not provide options, pass the set ids from the category/subcategory
          // The ones that did provides options are already set in the above in if options condition
          if (!expertise?.attributes?.some((attribute) => attribute === Attributes.providesOptions)) {
            if (expertise.id === expertiseId) {
              if (categoryName && categoryName !== 'initiative') {
                if (categoryName === 'equipment') {
                  const expertiseState = expertise[categoryName]
                  for (const id in expertiseState.ids) {
                    existing.push({ index: optionIndex, id })
                  }
                } else if (categoryName === 'properties') {
                  const expertiseState = expertise[categoryName]
                  for (const property in expertiseState.properties) {
                    existing.push({ index: optionIndex, id: property })
                  }
                } else {
                  // If the expertise is skills, saveAbilities, or languages, pass the ids
                  for (const id in expertise[categoryName]) {
                    existing.push({ index: optionIndex, id: id })
                  }
                }
              }
            }
          }
        })
      }
    })

    return existing
  }

  const getStateFeats = () => {
    const existing: Array<{ index: number; id: string }> = []

    const sections = formData.feats
    sections?.forEach((section) => {
      let fullSections: Array<FeatureFeat>
      let fullFeature: Feature | FeatureOption | AncestryFeature
      const featureId = section.featureId
      const classId = section.classId
      const raceId = section.raceId
      const backgroundId = section.backgroundId
      const featId = section.featId
      const ancestryId = section.ancestryId
      const equipmentId = section.equipmentId
      const optionId = section.optionId
      const optionIndex = section.optionIndex
      if (optionId) {
        // If the section provided options and they were chosen, add them to the existing ID array first.
        existing.push({ index: optionIndex, id: optionId })
      }
      if (classId) {
        const fullClass = classes.find((uClass) => uClass.id === classId)

        fullFeature = fullClass.features.find((feature) => feature.id === featureId)
      }
      if (raceId) {
        const fullRace = races.find((race) => race.id === raceId)
        if (ancestryId) {
          const fullAncestry = fullRace.ancestry?.options?.find((option) => option.id === ancestryId)

          fullFeature = fullAncestry.features.find((feature) => feature.id === featureId)
        }
        fullFeature = fullRace.features.find((feature) => feature.id === featureId)
      }
      if (featId) {
        const fullFeat = feats.find((feat) => feat.id === featId)

        fullFeature = fullFeat.features.find((feature) => feature.id === featureId)
      }
      if (backgroundId) {
        const fullBackground = backgrounds.find((background) => background.id === backgroundId)

        fullFeature = fullBackground.features.find((feature) => feature.id === featureId)
      }
      if (equipmentId) {
        const fullEquipment = equipment.find((equipment) => equipment.id === equipmentId)

        fullFeature = fullEquipment.features.find((feature) => feature.id === featureId)
      }

      if ((fullFeature as Feature | AncestryFeature)?.options.length > 0) {
        fullSections = (fullFeature as Feature | AncestryFeature)?.options.find(
          (option) => option.id === optionId
        ).feats
      } else {
        fullSections?.forEach((feat) => {
          // If the sections do not provide options, pass the set ids from the category/subcategory
          // The ones that did provides options are already set in the above in if options condition
          if (!feat?.attributes?.some((attribute) => attribute === Attributes.providesOptions)) {
            if (feat.id === featId) {
              existing.push({ index: optionIndex, id: feat.id })
            }
          }
        })
      }
    })

    return existing
  }

  const getStateSenses = () => {
    const existing: Array<{ index: number; id: string }> = []

    const sections = formData.senses
    sections?.forEach((section) => {
      let fullSections: Array<FeatureSense>
      let fullFeature: Feature | FeatureOption | AncestryFeature
      const featureId = section.featureId
      const classId = section.classId
      const raceId = section.raceId
      const backgroundId = section.backgroundId
      const featId = section.featId
      const ancestryId = section.ancestryId
      const equipmentId = section.equipmentId
      const optionId = section.optionId
      const optionIndex = section.optionIndex
      const senseId = section.senseId
      if (optionId) {
        // If the section provided options and they were chosen, add them to the existing ID array first.
        existing.push({ index: optionIndex, id: optionId })
      }
      if (classId) {
        const fullClass = classes.find((uClass) => uClass.id === classId)

        fullFeature = fullClass.features.find((feature) => feature.id === featureId)
      }
      if (raceId) {
        const fullRace = races.find((race) => race.id === raceId)

        if (ancestryId) {
          const fullAncestry = fullRace.ancestry?.options?.find((option) => option.id === ancestryId)

          fullFeature = fullAncestry.features.find((feature) => feature.id === featureId)
        }
        fullFeature = fullRace.features.find((feature) => feature.id === featureId)
      }
      if (featId) {
        const fullFeat = feats.find((feat) => feat.id === featId)

        fullFeature = fullFeat.features.find((feature) => feature.id === featureId)
      }
      if (backgroundId) {
        const fullBackground = backgrounds.find((background) => background.id === backgroundId)

        fullFeature = fullBackground.features.find((feature) => feature.id === featureId)
      }
      if (equipmentId) {
        const fullEquipment = equipment.find((equipment) => equipment.id === equipmentId)

        fullFeature = fullEquipment.features.find((feature) => feature.id === featureId)
      }

      if ((fullFeature as Feature | AncestryFeature)?.options.length > 0) {
        fullSections = (fullFeature as Feature | AncestryFeature)?.options.find(
          (option) => option.id === optionId
        ).senses
      } else {
        fullSections?.forEach((sense) => {
          // If the sections do not provide options, pass the set ids from the category/subcategory
          // The ones that did provides options are already set in the above in if options condition
          if (!sense?.attributes?.some((attribute) => attribute === Attributes.providesOptions)) {
            if (sense.id === senseId) {
              existing.push({ index: optionIndex, id: sense.id })
            }
          }
        })
      }
    })

    return existing
  }

  const getSectionOptions = ({
    section,
    sectionStep,
    optionIndex,
  }: {
    section: SectionDataType
    sectionStep: SectionName
    optionIndex: number
  }) => {
    // Initiation state index used to set the state option index selected on the form state

    // Initiate the path name used to set the path to find and set the section option selected by user
    let path: DeepKeyOf<typeof formData>

    // Initiate the options array to be populated the options for dropdown
    let options: Array<{ id: string; label: string; value: string }> = []

    // Initiate the exiting id array
    let existing: Array<{ index: number; id: string }> = []

    let label: string

    let exist: string

    if (
      sectionStep !== 'ancestries' &&
      sectionStep !== 'spells' &&
      sectionStep !== 'options' &&
      sectionStep !== 'subfeatures'
    ) {
      const stateIndex = formData[sectionStep]?.length || 0
      if (
        (section.__typename === 'FeatureProficiency' && sectionStep === 'proficiencies') ||
        (section.__typename === 'FeatureExpertise' && sectionStep === 'expertise')
      ) {
        // Get the category name based on the available enums and the id in the data
        const categoryId = section.category
        const categoryName = getKeyFromId(categoryId, ProficiencyCategories)

        // If the Proficiency options are equipment or properties (equipment properties), these are handled differently due to potential filtering options
        if (categoryName === 'equipment' || categoryName === 'properties') {
          const { properties, ids, category: equipmentCategory } = section[categoryName]

          // If the proficient category is an equipment option
          if (categoryName === 'equipment') {
            if (ids.some((id) => id === 'all')) {
              if (properties?.length > 0) {
                options = equipment.filter((equipment) =>
                  equipment?.category != null
                    ? equipment?.category === equipmentCategory
                    : equipment &&
                      properties?.some((pProperty) =>
                        equipment?.properties?.some((eProperty) => eProperty === pProperty)
                      )
                )
              } else {
                options = equipment
              }
            } else {
              options = equipment.filter((equipment) => ids.includes(equipment.id))
            }

            // Else the proficient category is an equipment property
          } else {
            if (ids.some((id) => id === 'all')) {
              options = system.equipment.properties
            } else {
              options = system.equipment.properties.filter((property) => ids.includes(property.id))
            }
          }
        } else if (categoryName === 'saveAbilities') {
          if (section[categoryName]?.some((saveAbility) => saveAbility === 'all')) {
            options = system.abilities
          } else {
            options = system.abilities.filter((ability) => section[categoryName]?.includes(ability.id))
          }
          // Find all other proficient options that are not initiative
        } else if (categoryName !== 'initiative') {
          if (section[categoryName]?.some((cOption) => cOption === 'all')) {
            options = system[categoryName]
          } else {
            options = system[categoryName]?.filter((ability) => section[categoryName]?.includes(ability.id))
          }
        }
        if (sectionStep === 'proficiencies') {
          existing = getStateProficiencies({ categoryName: categoryName })
        } else {
          // Filter out options that have already been selected
          existing = getStateExpertise({ categoryName: categoryName })
          const existingProficiencies = getStateProficiencies({ categoryName: categoryName })
          options = options?.filter((option) =>
            existingProficiencies.flatMap((existing) => existing.id).includes(option.id)
          )
        }
        label = system.proficiencies.categories.find((sCategory) => sCategory.id === categoryId)?.label
      } else if (sectionStep === 'modifiers' && section.__typename === 'FeatureModifier') {
        // Get category name based on the ID and using the enums to match for a property key
        const categoryId = section.category
        const categoryName = getKeyFromId(categoryId, { ...ModifierCategories, ...ModifierSpellCategories })

        // Match a property name to the category name
        const propertyName = getModifierProperties({ category: categoryName })
        const property = section[propertyName]

        // Focus on the only ones that are arrays and therefore would be options
        if (
          propertyName !== 'spell' &&
          propertyName !== 'range' &&
          propertyName !== 'shape' &&
          propertyName !== 'duration'
        ) {
          if (Array.isArray(property)) {
            if (property.some((property) => property === 'all')) {
              if (propertyName === 'saveAbilities') {
                options = system.abilities
              } else {
                options = system[propertyName]
              }
            } else {
              if (propertyName === 'saveAbilities') {
                options = system.abilities.filter((ability) => section[propertyName]?.includes(ability.id))
              } else {
                options = system[propertyName]?.filter((ability) => section[propertyName]?.includes(ability.id))
              }
            }
          }
        }
        label = system.modifiers.categories.find((sCategory) => sCategory.id === categoryId)?.label
      } else if (sectionStep === 'feats' && section.__typename === 'FeatureFeat') {
        existing = getStateFeats()
        if (section.feats.some((feat) => feat === 'all')) {
          options = feats
        } else {
          options = feats.filter((feat) => section.feats.includes(feat.id))
        }
        label = 'Feat'
      } else if (sectionStep === 'senses' && section.__typename === 'FeatureSense') {
        existing = getStateSenses()
        if (section.ids.some((sense) => sense === 'all')) {
          options = system.senses
        } else {
          options = system.senses.filter((sense) => section.ids.includes(sense.id))
        }
        label = 'Sense'
      }
      if (sectionStep !== 'expertise') {
        options = options?.filter((option) => !existing.flatMap((existing) => existing.id).includes(option.id))
      }

      exist = formData[sectionStep]?.find((section) => section.optionIndex === optionIndex)?.optionId

      path = `${sectionStep}.${stateIndex}`

      if (exist != null) {
        const existIndex = formData[sectionStep]?.findIndex((section) => section.optionIndex === optionIndex)

        path = `${sectionStep}.${existIndex}`
      }
    } else {
      if (sectionStep === 'spells' && section.__typename === 'FeatureSpell') {
        if (section.ids.some((spell) => spell === 'all')) {
          options = spells
        } else {
          options = spells.filter((spell) => section.ids.includes(spell.id))
        }
        if (section.attributes?.some((attribute) => attribute === Attributes.classLimit)) {
          options = (options as Array<Spell>).filter((option) =>
            option.classes?.some((oClass) => section.classLimit?.some((lClass) => lClass === oClass))
          )
        }

        if (section.attributes?.some((attribute) => attribute === Attributes.levelLimit)) {
          options = (options as Array<Spell>).filter((spell) => section.levelLimit === spell.level)
        }

        const stateIndex = formData?.spellcasting?.additional?.length || 0

        path = `spellcasting.additional.${stateIndex}`

        exist = formData.spellcasting.additional?.find((spell) => spell.optionIndex === optionIndex).id

        if (exist != null) {
          const existIndex = formData.spellcasting.additional?.findIndex(
            (section) => section.optionIndex === optionIndex
          )

          path = `spellcasting.additional.${existIndex}`
        }
      }
    }

    return { options, path, label, exist }
  }

  const getFeatureOptions = ({ options, optionIndex }: { options: Array<FeatureOption>; optionIndex: number }) => {
    const featureIndex = formData.features.length || 0
    let path: DeepKeyOf<typeof formData> = `features.${featureIndex}`

    const existId = formData.features.find((feature) => feature.optionIndex === optionIndex)?.option

    const exist = options.find((option) => option.id === existId)

    if (exist != null) {
      const existIndex = formData.features.findIndex((feature) => feature.optionIndex === optionIndex)

      path = `features.${existIndex}`
    }

    return { path, exist }
  }

  const createClassProficiencyText = ({ fullClass }: { fullClass: Class }) => {
    const fullProficiencies = fullClass.proficiencies

    const proficiencyObject = {} as ClassProficiency

    fullProficiencies?.forEach((proficiency) => {
      if (proficiency?.category === ProficiencyCategories.properties) {
        if (proficiency?.properties?.ids?.length > 0) {
          const equipmentCategory = system.equipment.categories.find(
            (category) => category.id === proficiency?.properties?.category
          )

          const existType: Array<{ id: string; label: string; value: string }> = [
            ...(proficiencyObject[equipmentCategory.value]?.type || []),
          ]

          const filteredProperties = []

          if (proficiency?.properties.ids.some((id) => id === 'all')) {
            filteredProperties.push(
              ...system.equipment.properties
                .filter((property) =>
                  system.equipment.categoryProperties.some(
                    (category) =>
                      category.categoryId === proficiency?.properties.category && category.propertyId === property.id
                  )
                )
                .filter((property) => !existType.some((type) => type.id === property.id))
                .map((property) => ({ id: property.id, label: property.label, value: property.value }))
            )
          } else {
            filteredProperties.push(
              ...system.equipment.properties
                .filter((property) => proficiency?.properties.ids.some((id) => id === property.id))
                .filter((property) => !existType.some((type) => type.id === property.id))
                .map((property) => ({ id: property.id, label: property.label, value: property.value }))
            )
          }

          proficiencyObject[equipmentCategory.value] = {
            proficiencyId: proficiency.id,
            type: [...existType, ...filteredProperties],
            selectionCount: proficiency?.selectionCount || 0,
          }
        }
      }
      if (proficiency?.category === ProficiencyCategories.equipment) {
        const equipmentCategory = system.equipment.categories.find(
          (category) => category.id === proficiency?.equipment?.category
        )

        const existType: Array<{ id: string; label: string; value: string }> = [
          ...(proficiencyObject[equipmentCategory.value]?.type || []),
        ]

        const filteredEquipment = []
        if (proficiency?.equipment.ids.some((id) => id === 'all')) {
          if (proficiency?.equipment.properties.length > 0) {
            filteredEquipment.push(
              ...equipment
                .filter((sEquipment) => sEquipment.category === proficiency?.equipment.category)
                .filter((sEquipment) =>
                  sEquipment.properties.some((eProperty) => proficiency?.equipment.properties.includes(eProperty))
                )
                .filter((sEquipment) => !existType.some((type) => type.id === sEquipment.id))
                .map((sEquipment) => ({ id: sEquipment.id, label: sEquipment.value, value: sEquipment.value }))
            )
          } else {
            filteredEquipment.push(
              ...equipment
                .filter((sEquipment) => sEquipment.category === proficiency?.equipment.category)
                .filter((sEquipment) => !existType.some((type) => type.id === sEquipment.id))
                .map((sEquipment) => ({ id: sEquipment.id, label: sEquipment.value, value: sEquipment.value }))
            )
          }
        } else {
          filteredEquipment.push(
            ...equipment
              .filter((sEquipment) => proficiency?.equipment.ids.some((id) => id === sEquipment.id))
              .filter((sEquipment) => !existType.some((type) => type.id === sEquipment.id))
              .map((sEquipment) => ({ id: sEquipment.id, label: sEquipment.value, value: sEquipment.value }))
          )
        }

        proficiencyObject[equipmentCategory.value] = {
          proficiencyId: proficiency.id,
          type: [...existType, ...filteredEquipment],
          selectionCount: proficiency?.selectionCount || 0,
        }
      } else if (proficiency?.category === ProficiencyCategories.skills) {
        const existType: Array<{ id: string; label: string; value: string }> = [
          ...(proficiencyObject?.skils?.type || []),
        ]

        const filteredSkills = []
        if (proficiency?.skills.some((skill) => skill === 'all')) {
          filteredSkills.push(
            ...system.skills
              .filter((skill) => !existType.some((type) => type.id === skill.id))
              .map((skill) => ({ id: skill.id, label: skill.label, value: skill.value }))
          )
        } else {
          filteredSkills.push(
            ...system.skills
              .filter((skill) => proficiency?.skills?.some((skillId) => skillId === skill.id))
              .filter((skill) => !existType.some((type) => type.id === skill.id))
              .map((skill) => ({ id: skill.id, label: skill.label, value: skill.value }))
          )
        }

        proficiencyObject.skills = {
          proficiencyId: proficiency.id,
          type: [...existType, ...filteredSkills],
          selectionCount: proficiency?.selectionCount || 0,
        }
      } else if (proficiency?.category === ProficiencyCategories.languages) {
        const existType: Array<{ id: string; label: string; value: string }> = [
          ...(proficiencyObject?.languages?.type || []),
        ]

        const filteredLanguages = []
        if (proficiency?.languages?.some((language) => language === 'all')) {
          filteredLanguages.push(
            ...system.languages
              .filter((language) => !existType.some((type) => type.id === language.id))
              .map((language) => ({ id: language.id, label: language.label, value: language.value }))
          )
        } else {
          filteredLanguages.push(
            ...system.languages
              .filter((language) => proficiency?.languages?.some((languageId) => languageId === language.id))
              .filter((language) => !existType.some((type) => type.id === language.id))
              .map((language) => ({ id: language.id, label: language.label, value: language.value }))
          )
        }

        proficiencyObject.languages = {
          proficiencyId: proficiency.id,
          type: [...existType, ...filteredLanguages],
          selectionCount: proficiency?.selectionCount || 0,
        }
      } else if (proficiency?.category === ProficiencyCategories.saveAbilities) {
        const existType: Array<{ id: string; label: string; value: string }> = [
          ...(proficiencyObject?.saveAbilities?.type || []),
        ]

        const filteredSaveAbilities = []
        if (proficiency?.saveAbilities?.some((ability) => ability === 'all')) {
          filteredSaveAbilities.push(
            ...system.abilities
              .filter((ability) => !existType.some((type) => type.id === ability.id))
              .map((ability) => ({ id: ability.id, label: ability.label, value: ability.value }))
          )
        } else {
          filteredSaveAbilities.push(
            ...system.abilities
              .filter((ability) => proficiency?.saveAbilities?.some((abilityId) => abilityId === ability.id))
              .filter((ability) => !existType.some((type) => type.id === ability.id))
              .map((ability) => ({ id: ability.id, label: ability.label, value: ability.value }))
          )
        }

        proficiencyObject.saveAbilities = {
          proficiencyId: proficiency.id,
          type: [...existType, ...filteredSaveAbilities],
          selectionCount: proficiency?.selectionCount || 0,
        }
      }
    })

    const sortedProficiencyObject = Object.fromEntries(
      Object.entries(proficiencyObject).sort(([keyA, valueA], [keyB, valueB]) => {
        // If one has selectionCount and the other doesn't, the one with selectionCount goes last
        if (valueA.selectionCount > 0 !== valueB.selectionCount > 0) {
          return valueA.selectionCount > 0 ? 1 : -1
        }
        // If both have same selectionCount status, sort alphabetically
        return keyA.localeCompare(keyB)
      })
    ) as ClassProficiency

    return sortedProficiencyObject
  }

  const createFeatures = (source?: { type: 'race' | 'class'; data: Class | Race; subclasses?: Class[] }) => {
    let sourceObject:
      | {
          race?: Race
          classes?: (Class & { subclass?: { id: string }[] })[]
        }
      | Character = {}

    if (source) {
      if (source.type === 'race' && source.data.__typename === 'Race') {
        sourceObject = {
          race: source.data,
        }
      }
      if (source.type === 'class' && source.data.__typename === 'Class') {
        sourceObject = {
          classes: [
            {
              ...source.data,
              subclass: source.subclasses?.map((subclass) => ({ id: subclass.id })),
            },
          ],
        }
      }
    } else {
      sourceObject = formData
    }

    const features: CharacterFeature[] = []

    // Process class features
    sourceObject.classes?.forEach((characterClass) => {
      const fullClass = classes.find((c) => c.id === characterClass.id)

      const processClassFeatures = (source: Class) => {
        source.features?.forEach((feature) => {
          const levels = feature.levelAvailable.split(/\s*,\s*/)

          levels.forEach((featureLevel) => {
            features.push({
              __typename: 'CharacterFeature',
              id: feature.id,
              classId: source.id,
              level: Number(featureLevel),
            })
          })
        })
      }

      processClassFeatures(fullClass)

      if (characterClass.__typename === 'CharacterClass') {
        const subClass = classes.find((c) => c.id === characterClass.subclass.id)
        if (subClass) processClassFeatures(subClass)
      } else {
        if (Array.isArray(characterClass.subclass) && characterClass.subclass.length > 0) {
          characterClass.subclass.forEach((subclass) => {
            const subClass = classes.find((c) => c.id === subclass.id)
            if (subClass) processClassFeatures(subClass)
          })
        }
      }
    })

    // Process race features
    if (sourceObject.race) {
      const fullRace = races.find((r) => r.id === formData.race)

      const processRaceFeatures = (source: Race | AncestryOption, type?: 'ancestry') => {
        source.features?.forEach((feature) => {
          features.push({ __typename: 'CharacterFeature', id: feature.id, [`${type || 'race'}Id`]: source.id })
        })
      }

      processRaceFeatures(fullRace)

      if (formData.ancestry) {
        const ancestry = fullRace.ancestry.options.find((a) => a.id === formData.ancestry.id)
        if (ancestry) processRaceFeatures(ancestry, 'ancestry')
      }
    }

    return features
  }

  const createSections = () => {
    type SectionTypeMap = {
      feats: CharacterFeat
      modifiers: CharacterModifier
      proficiencies: CharacterProficiency
      expertise: CharacterExpertise
      senses: CharacterSense
    }

    const sections: { [K in keyof SectionTypeMap]: SectionTypeMap[K][] } = {
      feats: [],
      modifiers: [],
      proficiencies: [],
      expertise: [],
      senses: [],
    }

    type SectionStep = keyof typeof sections

    const pushToSection = (step: SectionStep, obj: any) => {
      switch (step) {
        case 'feats':
          sections.feats.push(obj as CharacterFeat)
          break
        case 'proficiencies':
          sections.proficiencies.push(obj as CharacterProficiency)
          break
        case 'expertise':
          sections.expertise.push(obj as CharacterExpertise)
          break
        case 'modifiers':
          sections.modifiers.push(obj as CharacterModifier)
          break
        case 'senses':
          sections.senses.push(obj as CharacterSense)
          break
      }
    }

    const processFeatures = (
      features: (Feature | AncestryFeature)[],
      source: Class | Race | AncestryOption,
      type: 'class' | 'race' | 'ancestry'
    ) => {
      features?.forEach((feature) => {
        sectionSteps.forEach((sectionStep) => {
          if (
            sectionStep !== 'spells' &&
            sectionStep !== 'ancestries' &&
            sectionStep !== 'options' &&
            sectionStep !== 'subfeatures' &&
            feature?.[sectionStep]?.length > 0
          ) {
            feature[sectionStep].forEach((fSection) => {
              if (!fSection?.attributes?.some((attribute) => attribute === Attributes.providesOptions)) {
                const sourceId = source.id
                const featureId = feature.id

                const typename = () => {
                  switch (sectionStep) {
                    case 'feats':
                      return 'CharacterFeat' as const
                    case 'proficiencies':
                      return 'CharacterProficiency' as const
                    case 'expertise':
                      return 'CharacterExpertise' as const
                    case 'modifiers':
                      return 'CharacterModifier' as const
                    case 'senses':
                      return 'CharacterSense' as const
                  }
                }

                const sectionIdKey = () => {
                  switch (sectionStep) {
                    case 'feats':
                      return 'featId'
                    case 'proficiencies':
                      return 'proficiencyId'
                    case 'expertise':
                      return 'expertiseId'
                    case 'modifiers':
                      return 'modifierId'
                    case 'senses':
                      return 'senseId'
                  }
                }

                pushToSection(sectionStep as SectionStep, {
                  __typename: typename(),
                  [`${sectionIdKey()}`]: fSection.id,
                  featureId,
                  [`${type}Id`]: sourceId,
                })
              }
            })
          }
        })
      })
    }

    // Process class features
    formData.classes?.forEach((characterClass) => {
      const fullClass = classes.find((c) => c.id === characterClass.id)
      processFeatures(fullClass.features, fullClass, 'class')

      if (characterClass.subclass) {
        const subClass = classes.find((c) => c.id === characterClass.subclass.id)
        if (subClass) {
          processFeatures(subClass.features, subClass, 'class')
        }
      }
    })

    // Process race features
    if (formData.race) {
      const fullRace = races.find((r) => r.id === formData.race)
      processFeatures(fullRace.features, fullRace, 'race')

      if (formData.ancestry) {
        const ancestry = fullRace.ancestry.options.find((a) => a.id === formData.ancestry.id)
        if (ancestry) {
          processFeatures(ancestry.features, ancestry, 'ancestry')
        }
      }
    }

    return sections
  }

  const createAbilityScores = () => {
    if (formData.__typename === 'Character') {
      const abilityScores: Scores[] = JSON.parse(
        JSON.stringify(formData?.abilities?.scores || [])
      ) as Character['abilities']['scores']

      const characterModifiers = [...(formData?.modifiers || [])]

      abilityScores?.forEach((score, index) => {
        // Set the calculated score

        let calculatedScore: number = Number(score.baseScore) || 0
        let raceScore: number = 0
        let classScore: number = 0
        let modifierScore: number = 0

        // Set modifers on ability scores

        characterModifiers?.forEach((cModifier) => {
          let charClass: Class
          let charRace: Race
          let charAncestry: AncestryOption
          let featureMod: FeatureModifier

          if (cModifier.classId) {
            charClass = classes.find((sClass) => sClass.id === cModifier.classId)
            featureMod = charClass?.features
              ?.find(
                (feature) =>
                  feature.id === cModifier.featureId &&
                  feature.levelAvailable
                    .split(/\s*,\s*/)
                    .includes(String(formData.classes.find((fClass) => fClass.id === cModifier.classId)?.level))
              )
              ?.modifiers?.find((modifier) => modifier.id === cModifier.modifierId)
          }
          if (cModifier.raceId) {
            charRace = races.find((sRace) => sRace.id === cModifier.raceId)
            featureMod = charRace?.features
              ?.find((feature) => feature.id === cModifier.featureId)
              ?.modifiers?.find((modifier) => modifier.id === cModifier.modifierId)
          }
          if (cModifier.ancestryId) {
            charAncestry = charRace?.ancestry?.options?.find((option) => option.id === cModifier.ancestryId)
            featureMod = charAncestry?.features
              ?.find((feature) => feature.id === cModifier.featureId)
              ?.modifiers?.find((modifier) => modifier.id === cModifier.modifierId)
          }

          let method: FeatureModifier['method']
          let type: FeatureModifier['type']
          if (featureMod && featureMod.category === ModifierCategories.abilityScores) {
            method = featureMod.method
            type = featureMod.type

            if (type === ModifierTypes.bonus) {
              if (method === ModifierMethods.setGlobally) {
                if (featureMod?.abilities && featureMod?.abilities?.includes(score.ability)) {
                  if (cModifier.classId != null) {
                    console.log({ featureMod, charClass })
                    classScore += featureMod.setAmount
                    modifierScore += featureMod.setAmount
                  }
                  if (cModifier.raceId != null) {
                    raceScore += featureMod.setAmount
                    modifierScore += featureMod.setAmount
                  }
                }
              }
            }
          }
        })

        console.log({ classScore })

        calculatedScore += raceScore
        calculatedScore += classScore

        if (calculatedScore !== score.calculatedScore || !score.calculatedScore) {
          abilityScores[index] = {
            ...score,
            calculatedScore: calculatedScore,
            raceScore: raceScore,
            classScore: classScore,
            modifierScore: modifierScore,
          }
        }
      })

      return abilityScores
    }
  }

  return {
    getSectionOptions,
    getFeatureOptions,
    createClassProficiencyText,
    createSections,
    createFeatures,
    createAbilityScores,
  }
}
export default useGetSections
