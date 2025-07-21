import { useStoreFunctions, useMutationFunctions } from '@/hooks'
import {
  useFeatureExpertiseStore,
  useFeatureSenseStore,
  useFeatureProficiencyStore,
  useFeatureModifierStore,
  useFeatureSpellStore,
  useFeatureFeatStore,
} from '@/store'
import type {
  FeatureExpertiseInput,
  FeatureSenseInput,
  FeatureProficiencyInput,
  FeatureModifierInput,
  FeatureSpellInput,
  FeatureFeatInput,
} from '@/types'

export type SectionType = {
  expertise: FeatureExpertiseInput
  senses: FeatureSenseInput
  proficiencies: FeatureProficiencyInput
  modifiers: FeatureModifierInput
  spells: FeatureSpellInput
  feats: FeatureFeatInput
}

const useSectionManager = () => {
  const { proficiencies, expertise, senses, spells, feats, modifiers } = useStoreFunctions()

  const {
    proficiencies: proficiencyMutations,
    expertise: expertiseMutations,
    senses: senseMutations,
    spells: spellMutations,
    feats: featMutations,
    modifiers: modifierMutations,
  } = useMutationFunctions()

  // Store subscriptions
  const sectionMap = {
    expertise: {
      current: useFeatureExpertiseStore((state) => state.current),
      added: useFeatureExpertiseStore((state) => state.added),
      edited: useFeatureExpertiseStore((state) => state.edited),
      removed: useFeatureExpertiseStore((state) => state.removed),
      functions: {
        setCurrent: expertise.setCurrent,
        upsertAdded: expertise.upsertAdded,
        upsertEdited: expertise.upsertEdited,
        resetFormFields: expertise.resetFormFields,
      },
      mutations: expertiseMutations,
    },
    senses: {
      current: useFeatureSenseStore((state) => state.current),
      added: useFeatureSenseStore((state) => state.added),
      edited: useFeatureSenseStore((state) => state.edited),
      removed: useFeatureSenseStore((state) => state.removed),
      functions: {
        setCurrent: senses.setCurrent,
        upsertAdded: senses.upsertAdded,
        upsertEdited: senses.upsertEdited,
        resetFormFields: senses.resetFormFields,
      },
      mutations: senseMutations,
    },
    proficiencies: {
      current: useFeatureProficiencyStore((state) => state.current),
      added: useFeatureProficiencyStore((state) => state.added),
      edited: useFeatureProficiencyStore((state) => state.edited),
      removed: useFeatureProficiencyStore((state) => state.removed),
      functions: {
        setCurrent: proficiencies.setCurrent,
        upsertAdded: proficiencies.upsertAdded,
        upsertEdited: proficiencies.upsertEdited,
        resetFormFields: proficiencies.resetFormFields,
      },
      mutations: proficiencyMutations,
    },
    modifiers: {
      current: useFeatureModifierStore((state) => state.current),
      added: useFeatureModifierStore((state) => state.added),
      edited: useFeatureModifierStore((state) => state.edited),
      removed: useFeatureModifierStore((state) => state.removed),
      functions: {
        setCurrent: modifiers.setCurrent,
        upsertAdded: modifiers.upsertAdded,
        upsertEdited: modifiers.upsertEdited,
        resetFormFields: modifiers.resetFormFields,
      },
      mutations: modifierMutations,
    },
    spells: {
      current: useFeatureSpellStore((state) => state.current),
      added: useFeatureSpellStore((state) => state.added),
      edited: useFeatureSpellStore((state) => state.edited),
      removed: useFeatureSpellStore((state) => state.removed),
      functions: {
        setCurrent: spells.setCurrent,
        upsertAdded: spells.upsertAdded,
        upsertEdited: spells.upsertEdited,
        resetFormFields: spells.resetFormFields,
      },
      mutations: spellMutations,
    },
    feats: {
      current: useFeatureFeatStore((state) => state.current),
      added: useFeatureFeatStore((state) => state.added),
      edited: useFeatureFeatStore((state) => state.edited),
      removed: useFeatureFeatStore((state) => state.removed),
      functions: {
        setCurrent: feats.setCurrent,
        upsertAdded: feats.upsertAdded,
        upsertEdited: feats.upsertEdited,
        resetFormFields: feats.resetFormFields,
      },
      mutations: featMutations,
    },
  } as const

  // Process all section mutations (extracted from handleUpdate)
  const processSectionMutations = async () => {
    const results: Array<{ section: keyof SectionType; success: boolean; error?: unknown }> = []

    // Process each section type with proper typing
    const processSection = async <K extends keyof SectionType>(sectionName: K, section: (typeof sectionMap)[K]) => {
      try {
        // Process added items
        if (section.added.size > 0) {
          await Promise.all(
            Array.from(section.added.values() as unknown as Array<SectionType[K]>).map(async (item: SectionType[K]) => {
              try {
                await section.mutations.add(item as never)
              } catch (error) {
                console.error(`Error adding ${sectionName} item:`, error)
                throw error
              }
            })
          )
        }

        // Process edited items
        if (section.edited.size > 0) {
          await Promise.all(
            Array.from(section.edited.values() as unknown as Array<SectionType[K]>).map(
              async (item: SectionType[K]) => {
                try {
                  await section.mutations.update(item as never)
                } catch (error) {
                  console.error(`Error updating ${sectionName} item:`, error)
                  throw error
                }
              }
            )
          )
        }

        // Process removed items
        if (section.removed.size > 0) {
          await Promise.all(
            Array.from(section.removed).map(async (itemId: string) => {
              try {
                await section.mutations.delete(itemId)
              } catch (error) {
                console.error(`Error deleting ${sectionName} item:`, error)
                throw error
              }
            })
          )
        }

        results.push({ section: sectionName, success: true })
      } catch (error) {
        results.push({ section: sectionName, success: false, error })
      }
    }

    // Process all sections
    await Promise.all([
      processSection('expertise', sectionMap.expertise),
      processSection('senses', sectionMap.senses),
      processSection('proficiencies', sectionMap.proficiencies),
      processSection('modifiers', sectionMap.modifiers),
      processSection('spells', sectionMap.spells),
      processSection('feats', sectionMap.feats),
    ])

    return results
  }

  // Clear section maps utility
  const clearSectionMaps = (itemId: string) => {
    Object.values(sectionMap).forEach(({ added, edited, removed }) => {
      if (added.has(itemId)) added.delete(itemId)
      if (edited.has(itemId)) edited.delete(itemId)
      if (removed.has(itemId)) removed.delete(itemId)
    })
  }

  // Get section by type
  const getSection = <K extends keyof SectionType>(sectionType: K) => sectionMap[sectionType]



  return {
    sectionMap,
    processSectionMutations,
    clearSectionMaps,
    getSection,
  }
}

export default useSectionManager
