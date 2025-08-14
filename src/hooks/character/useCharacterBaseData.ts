import type { CharacterInput, FeatureModifier, Race, Class, Background, Feat, Equipment, AncestryOption } from '~/types'
import {
  fetchAncestryOption,
  fetchBackground,
  fetchClass,
  fetchFeat,
  fetchFeatureModifier,
  fetchRace,
  fetchSingleEquipment,
} from '~/apis'
import { useQuery } from '@tanstack/react-query'
import { useOptimizedSelector } from '~/store'
import { queryClient } from '~/apis'

/**
 * Shared hook that batches all common API calls used across multiple character hooks.
 * This eliminates redundant API calls and provides a single source of truth for character data.
 */
export const useCharacterBaseData = () => {
  // Use optimized selector to get only the specific properties we need
  const {
    characterId,
    characterClasses,
    characterRace,
    characterBackground,
    characterFeats,
    characterEquipment,
    characterModifiers,
    characterAncestry
  } = useOptimizedSelector<CharacterInput, {
    characterId: string | undefined
    characterClasses: CharacterInput['classes']
    characterRace: CharacterInput['race']
    characterBackground: CharacterInput['background']
    characterFeats: CharacterInput['feats']
    characterEquipment: CharacterInput['equipment']
    characterModifiers: CharacterInput['modifiers']
    characterAncestry: CharacterInput['ancestry']
  }>((state) => ({
    characterId: state.current?.id,
    characterClasses: state.current?.classes,
    characterRace: state.current?.race,
    characterBackground: state.current?.background,
    characterFeats: state.current?.feats,
    characterEquipment: state.current?.equipment,
    characterModifiers: state.current?.modifiers,
    characterAncestry: state.current?.ancestry
  }))

  return useQuery({
    queryKey: [
      'characterBaseData',
      characterId,
      {
        classIds: characterClasses?.map((c) => c.id) || [],
        raceId: characterRace,
        backgroundId: characterBackground,
        featIds: characterFeats?.map((f) => f.id) || [],
        equipmentIds: characterEquipment?.inventory?.map((i) => i.id) || [],
        modifierIds: characterModifiers?.map((m) => m.id) || [],
        ancestryId: characterAncestry?.id,
      },
    ],
    queryFn: async () => {
      const promiseMap = {
        classes: [] as Promise<Class | null | undefined>[],
        races: [] as Promise<Race | null | undefined>[],
        backgrounds: [] as Promise<Background | null | undefined>[],
        feats: [] as Promise<Feat | null | undefined>[],
        equipment: [] as Promise<Equipment | null | undefined>[],
        modifiers: [] as Promise<FeatureModifier | null | undefined>[],
        ancestries: [] as Promise<AncestryOption | null | undefined>[],
      }

      // Batch class fetches
      if (characterClasses?.length) {
        characterClasses.forEach((charClass) => {
          const classPromise = queryClient.fetchQuery(fetchClass(charClass.id))
          promiseMap.classes.push(classPromise)
        })
      }

      // Batch race fetches
      if (characterRace) {
        const racePromise = queryClient.fetchQuery(fetchRace(characterRace))
        promiseMap.races.push(racePromise)
      }

      // Batch background fetch
      if (characterBackground) {
        const backgroundPromise = queryClient.fetchQuery(fetchBackground(characterBackground))
        promiseMap.backgrounds.push(backgroundPromise)
      }

      // Batch feat fetches
      if (characterFeats?.length) {
        characterFeats.forEach((feat) => {
          const featPromise = queryClient.fetchQuery(fetchFeat(feat.id))
          promiseMap.feats.push(featPromise)
        })
      }

      // Batch equipment fetches (inventory is an array of equipment objects)
      if (characterEquipment?.inventory?.length) {
        characterEquipment.inventory.forEach((item) => {
          if (item.id) {
            const equipmentPromise = queryClient.fetchQuery(fetchSingleEquipment(item.id))
            promiseMap.equipment.push(equipmentPromise)
          }
        })
      }

      // Batch modifier fetches
      if (characterModifiers?.length) {
        characterModifiers.forEach((modifier) => {
          const modifierPromise = queryClient.fetchQuery(fetchFeatureModifier(modifier.id))
          promiseMap.modifiers.push(modifierPromise)
        })
      }

      // Batch ancestry fetch
      if (characterAncestry?.id) {
        const ancestryPromise = queryClient.fetchQuery(fetchAncestryOption(characterAncestry.id))
        promiseMap.ancestries.push(ancestryPromise)
      }

      // Resolve individual promise arrays
      const [classes, races, backgrounds, feats, equipment, modifiers, ancestries] = await Promise.all([
        Promise.all(promiseMap.classes),
        Promise.all(promiseMap.races),
        Promise.all(promiseMap.backgrounds),
        Promise.all(promiseMap.feats),
        Promise.all(promiseMap.equipment),
        Promise.all(promiseMap.modifiers),
        Promise.all(promiseMap.ancestries),
      ])

      // Fetch lineages for races (second batch after getting main race data)
      const lineagePromises: Promise<Race | null | undefined>[] = []
      for (const race of races) {
        const raceData = race as { lineages?: string[] }
        if (raceData?.lineages?.length) {
          raceData.lineages.forEach((lineageId: string) => {
            lineagePromises.push(queryClient.fetchQuery(fetchRace(lineageId)))
          })
        }
      }

      const lineages = lineagePromises.length > 0 ? await Promise.all(lineagePromises) : []

      // Return organized data structure with proper typing
      const filteredClasses = classes.filter(Boolean)
      const filteredRaces = races.filter(Boolean)
      const filteredLineages = lineages.filter(Boolean)
      const filteredBackgrounds = backgrounds.filter(Boolean)
      const filteredFeats = feats.filter(Boolean)
      const filteredEquipment = equipment.filter(Boolean)
      const filteredModifiers = modifiers.filter(Boolean)
      const filteredAncestries = ancestries.filter(Boolean)

      return {
        classMap: new Map(filteredClasses.map((c) => [c?.id, c])),
        raceMap: new Map(filteredRaces.map((r) => [r?.id, r])),
        lineageMap: new Map(filteredLineages.map((l) => [l?.id, l])),
        backgroundMap: new Map(filteredBackgrounds.map((b) => [b?.id, b])),
        featMap: new Map(filteredFeats.map((f) => [f?.id, f])),
        equipmentMap: new Map(filteredEquipment.map((e) => [e?.id, e])),
        modifierMap: new Map(filteredModifiers.map((m) => [m?.id, m])),
        ancestryMap: new Map(filteredAncestries.map((a) => [a?.id, a])),
      }
    },
    enabled: !!characterId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (React Query v5 uses gcTime instead of cacheTime)
  })
}
