import type {
  CharacterAuthored,
  CharacterProvenance
} from '@artificer-toolkit/shared/subjects/authored'

import {
  collectGrantedFeaturesForCharacter,
  findCurrentCharacterFeatureAcquisition,
  isCharacterAcquisitionTimingAvailable,
  isCharacterFeatAcquisitionValid
} from './characterBuilderSelections.js'
import type { CharacterRuleContext, CharacterRuleRegistry } from './characterRuleContext.js'
import { assembleCharacterRuleSnapshot } from './characterRuleSnapshot.js'
import {
  buildCharacterSpellRuleFacts,
  collectCharacterRuleInputSpellIds
} from './characterSpellRuleFacts.js'
import { collectSpellClassListAdditions } from './spellClassListAdditions.js'

/**
 * The class spell lists a Character's classes and subclasses draw on: the lists named by their ids,
 * plus the Spells their spellcasting lists explicitly or their reached features add (D175).
 */
export type CharacterClassSpellLists = {
  classIds: readonly string[]
  spellIds: ReadonlySet<string>
}

export function collectCharacterClassSpellLists(
  character: CharacterAuthored,
  registry: CharacterRuleRegistry
): CharacterClassSpellLists {
  const { classSelections } = collectGrantedFeaturesForCharacter(character, registry)
  return {
    classIds: [
      ...new Set(
        classSelections.flatMap(({ row }) =>
          row.subclassId ? [row.classId, row.subclassId] : [row.classId]
        )
      )
    ],
    spellIds: new Set(
      classSelections.flatMap((selection) => [
        ...selection.spellcasting.flatMap((spellcasting) => spellcasting.availableSpellIds ?? []),
        ...collectSpellClassListAdditions(selection.features, selection.row.classLevel).flatMap(
          (addition) => addition.spellIds
        )
      ])
    )
  }
}

type SpellGrantFeature = {
  id: string
  spells?: readonly unknown[]
  options?: ReadonlyArray<{ id: string; spells?: readonly unknown[] }>
}

function featureContributesSpellGrant(
  feature: SpellGrantFeature,
  character: CharacterAuthored,
  source?: CharacterProvenance
): boolean {
  if (feature.spells?.length) return true
  if (!feature.options?.length) return false
  if (!source) {
    return feature.options.some((option) => Boolean(option.spells?.length))
  }

  const acquisition = findCurrentCharacterFeatureAcquisition(character, feature.id, source)
  const selectedOptionIds = new Set(
    acquisition?.selections
      ?.filter((selection) => selection.selectionKey === 'options')
      .flatMap((selection) =>
        selection.values.flatMap((value) => {
          if (value.kind === 'ID') return [value.id]
          if (value.kind === 'IDS') return value.ids
          return []
        })
      ) ?? []
  )
  return feature.options.some(
    (option) => selectedOptionIds.has(option.id) && Boolean(option.spells?.length)
  )
}

export function collectContextSpellIds(
  character: CharacterAuthored,
  context: CharacterRuleContext,
  referenceSpellIds: readonly string[] | undefined
): readonly string[] {
  const assembled = assembleCharacterRuleSnapshot({ character, context })
  const spellFacts = buildCharacterSpellRuleFacts(assembled.snapshot, assembled.registry)
  return [
    ...collectCharacterRuleInputSpellIds({
      referenceSpellIds,
      spellAccessCandidates: spellFacts.spellAccessCandidates,
      spellSources: assembled.snapshot.spellSources
    })
  ]
}

export function needsCharacterSpellCatalog(
  character: CharacterAuthored,
  registry: CharacterRuleRegistry
): boolean {
  const feats = registry.feats ?? []
  const featsById = new Map(feats.map((feat) => [feat.id, feat]))
  const selectedFeaturesById = new Map(registry.features.map((feature) => [feature.id, feature]))
  const { classSelections, grantedFeatures } = collectGrantedFeaturesForCharacter(
    character,
    registry
  )

  return Boolean(
    character.intent.spellSelections?.length ||
    classSelections.some((selection) => selection.spellcasting.length > 0) ||
    grantedFeatures.some((granted) =>
      featureContributesSpellGrant(granted.feature, character, granted.source)
    ) ||
    character.intent.featureAcquisitions.some((acquisition) => {
      if (
        !isCharacterAcquisitionTimingAvailable(character, acquisition.timing) ||
        !isCharacterFeatAcquisitionValid(acquisition, registry)
      )
        return false
      const feature = selectedFeaturesById.get(acquisition.featureId)
      if (feature && featureContributesSpellGrant(feature, character, acquisition.source)) {
        return true
      }
      if (acquisition.source.kind !== 'FEAT') return false
      const feat = featsById.get(acquisition.source.featId)
      return Boolean(
        feat?.spells?.length ||
        feat?.features?.some((feature) => featureContributesSpellGrant(feature, character))
      )
    }) ||
    registry.equipment.some((record) =>
      record.features?.some((feature) => featureContributesSpellGrant(feature, character))
    )
  )
}
