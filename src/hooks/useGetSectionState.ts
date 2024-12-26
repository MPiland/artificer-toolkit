import {
  AncestryFeature,
  Character,
  Feature,
  FeatureExpertise,
  FeatureFeat,
  FeatureOption,
  FeatureProficiency,
  FeatureSense,
  Spell,
} from '../../amplify/API'
import { DeepKeyOf, SectionDataType, SectionName } from '../types/form'
import { Attributes, ModifierCategories, ModifierSpellCategories, ProficiencyCategories } from '../types/enums'
import { useListClassesQuery } from '../features/classes/classesApi'
import { useListEquipmentQuery } from '../features/equipment/equipmentApi'
import { useListSpellsQuery } from '../features/spells/spellsApi'
import { useGetSystemQuery } from '../features/systems/systemsApi'
import { getKeyFromId, getModifierProperties } from '../utils/form'
import { useListRacesQuery } from '../features/races/racesApi'
import { useListFeatsQuery } from '../features/feats/featsApi'
import { useListBackgroundsQuery } from '../features/backgrounds/backgroundsApi'

const useGetSections = ({ state }: { state: Character }) => {
  const { data: classes } = useListClassesQuery()
  const { data: system } = useGetSystemQuery()
  const { data: spells } = useListSpellsQuery()
  const { data: races } = useListRacesQuery()
  const { data: feats } = useListFeatsQuery()
  const { data: equipment } = useListEquipmentQuery()
  const { data: backgrounds } = useListBackgroundsQuery()

  const getStateProficiencies = ({ categoryName }: { categoryName?: keyof typeof ProficiencyCategories }) => {
    const existing: Array<{ index: number; id: string }> = []

    const sections = state.proficiencies
    sections.forEach((section) => {
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
        if ((fullFeature as Feature | AncestryFeature).options.length > 0) {
          fullSections = (fullFeature as Feature | AncestryFeature).options.find(
            (option) => option.id === optionId
          ).proficiencies
        }
      }

      fullSections.forEach((proficiency) => {
        // If the sections do not provide options, pass the set ids from the category/subcategory
        // The ones that did provides options are already set in the above in if options condition
        if (!proficiency.attributes.some((attribute) => attribute === Attributes.providesOptions)) {
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

    const sections = state.expertise
    sections.forEach((section) => {
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

      if ((fullFeature as Feature | AncestryFeature).options.length > 0) {
        fullSections = (fullFeature as Feature | AncestryFeature).options.find(
          (option) => option.id === optionId
        ).expertise
      } else {
        fullSections.forEach((expertise) => {
          // If the sections do not provide options, pass the set ids from the category/subcategory
          // The ones that did provides options are already set in the above in if options condition
          if (!expertise.attributes.some((attribute) => attribute === Attributes.providesOptions)) {
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

    const sections = state.feats
    sections.forEach((section) => {
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

      if ((fullFeature as Feature | AncestryFeature).options.length > 0) {
        fullSections = (fullFeature as Feature | AncestryFeature).options.find((option) => option.id === optionId).feats
      } else {
        fullSections.forEach((feat) => {
          // If the sections do not provide options, pass the set ids from the category/subcategory
          // The ones that did provides options are already set in the above in if options condition
          if (!feat.attributes.some((attribute) => attribute === Attributes.providesOptions)) {
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

    const sections = state.senses
    sections.forEach((section) => {
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

      if ((fullFeature as Feature | AncestryFeature).options.length > 0) {
        fullSections = (fullFeature as Feature | AncestryFeature).options.find(
          (option) => option.id === optionId
        ).senses
      } else {
        fullSections.forEach((sense) => {
          // If the sections do not provide options, pass the set ids from the category/subcategory
          // The ones that did provides options are already set in the above in if options condition
          if (!sense.attributes.some((attribute) => attribute === Attributes.providesOptions)) {
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
    let path: DeepKeyOf<typeof state>

    // Initiate the options array to be populated the options for dropdown
    let options: Array<{ id: string; label: string; value: string }> = []

    // Initiate the exiting id array
    let existing: Array<{ index: number; id: string }> = []

    let label: string

    let exist: string

    if (sectionStep !== 'ancestries' && sectionStep !== 'spells') {
      const stateIndex = state[sectionStep]?.length || 0
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
          if (section[categoryName].some((saveAbility) => saveAbility === 'all')) {
            options = system.abilities
          } else {
            options = system.abilities.filter((ability) => section[categoryName].includes(ability.id))
          }
          // Find all other proficient options that are not initiative
        } else if (categoryName !== 'initiative') {
          if (section[categoryName].some((cOption) => cOption === 'all')) {
            options = system[categoryName]
          } else {
            options = system[categoryName].filter((ability) => section[categoryName].includes(ability.id))
          }
        }
        if (sectionStep === 'proficiencies') {
          existing = getStateProficiencies({ categoryName: categoryName })
        } else {
          // Filter out options that have already been selected
          existing = getStateExpertise({ categoryName: categoryName })
          const existingProficiencies = getStateProficiencies({ categoryName: categoryName })
          options = options.filter((option) =>
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
                options = system.abilities.filter((ability) => section[propertyName].includes(ability.id))
              } else {
                options = system[propertyName].filter((ability) => section[propertyName].includes(ability.id))
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
        if (section.senses.some((sense) => sense === 'all')) {
          options = system.senses
        } else {
          options = system.senses.filter((sense) => section.senses.includes(sense.id))
        }
        label = 'Sense'
      }
      if (sectionStep !== 'expertise') {
        options = options.filter((option) => !existing.flatMap((existing) => existing.id).includes(option.id))
      }

      exist = state[sectionStep]?.find((section) => section.optionIndex === optionIndex).optionId

      path = `${sectionStep}.${stateIndex}`

      if (exist != null) {
        const existIndex = state[sectionStep]?.findIndex((section) => section.optionIndex === optionIndex)

        path = `${sectionStep}.${existIndex}`
      }
    } else {
      if (sectionStep === 'spells' && section.__typename === 'FeatureSpell') {
        if (section.spells.some((spell) => spell === 'all')) {
          options = spells
        } else {
          options = spells.filter((spell) => section.spells.includes(spell.id))
        }
        if (section.attributes?.some((attribute) => attribute === Attributes.classLimit)) {
          options = (options as Array<Spell>).filter((option) =>
            option.classes?.some((oClass) => section.classLimit?.some((lClass) => lClass === oClass))
          )
        }

        if (section.attributes?.some((attribute) => attribute === Attributes.levelLimit)) {
          options = (options as Array<Spell>).filter((spell) => section.levelLimit === spell.level)
        }

        const stateIndex = state?.spellcasting?.additional?.length || 0

        path = `spellcasting.additional.${stateIndex}`

        exist = state.spellcasting.additional?.find((spell) => spell.optionIndex === optionIndex).id

        if (exist != null) {
          const existIndex = state.spellcasting.additional?.findIndex((section) => section.optionIndex === optionIndex)

          path = `spellcasting.additional.${existIndex}`
        }
      }
    }

    return { options, path, label, exist }
  }

  const getFeatureOptions = ({ options, optionIndex }: { options: Array<FeatureOption>; optionIndex: number }) => {
    const featureIndex = state.features.length || 0
    let path: DeepKeyOf<typeof state> = `features.${featureIndex}`

    const existId = state.features.find((feature) => feature.optionIndex === optionIndex)?.option

    const exist = options.find((option) => option.id === existId)

    if (exist != null) {
      const existIndex = state.features.findIndex((feature) => feature.optionIndex === optionIndex)

      path = `features.${existIndex}`
    }

    return { path, exist }
  }

  return { getSectionOptions, getFeatureOptions }
}
export default useGetSections
