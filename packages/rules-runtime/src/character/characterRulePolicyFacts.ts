import { SPELL_SLOT_POOL } from '@artificer-toolkit/shared/core'
import {
  characterRulePolicyInputSchema,
  type CharacterRulePolicyInput
} from '@artificer-toolkit/schema/api/characterRules'
import type { CompiledCreature, CompiledSpell } from '@artificer-toolkit/shared/subjects/compilers'
import type { CharacterResourceUsage } from '@artificer-toolkit/shared/core'

import { buildCharacterArmorClassRuleFacts } from './characterArmorClassRuleFacts.js'
import { buildCharacterHandRuleFacts } from './characterHandRuleFacts.js'
import { buildCharacterActionRuleFacts } from './characterActionRuleFacts.js'
import { buildCharacterCompanionMechanicsRuleFacts } from './characterCompanionMechanicsRuleFacts.js'
import { buildCharacterDefenseRuleFacts } from './characterDefenseRuleFacts.js'
import { buildCharacterDerivedRuleFacts } from './characterDerivedRuleFacts.js'
import { buildCharacterHitPointRuleFacts } from './characterHitPointRuleFacts.js'
import { buildCharacterItemMechanicsRuleFacts } from './characterItemMechanicsRuleFacts.js'
import { buildCharacterMovementRuleFacts } from './characterMovementRuleFacts.js'
import { buildCharacterProficiencyRuleFacts } from './characterProficiencyRuleFacts.js'
import { buildCharacterResourceRuleFacts } from './characterResourceRuleFacts.js'
import { buildCharacterSenseRuleFacts } from './characterSenseRuleFacts.js'
import { buildCharacterSpellCastRuleFacts } from './characterSpellCastRuleFacts.js'
import { buildCharacterSpellActionRuleFacts } from './characterSpellActionRuleFacts.js'
import { buildCharacterSpellMechanicsRuleFacts } from './characterSpellMechanicsRuleFacts.js'
import { buildCharacterSpellPreparationRuleFacts } from './characterSpellPreparationRuleFacts.js'
import { buildCharacterSpellRuleFacts } from './characterSpellRuleFacts.js'
import {
  buildCharacterSpellClassListAdditions,
  withClassListAdditions
} from './spellClassListAdditions.js'
import { buildCharacterSpellSlotRuleFacts } from './characterSpellSlotRuleFacts.js'
import { compileCharacterGrantFoldRuleFacts } from './characterGrantFoldRuleFacts.js'
import {
  assembleCharacterRuleSnapshot,
  type CharacterRuleSnapshotInput,
  type CharacterRuleSnapshotResult
} from './characterRuleSnapshot.js'

export interface CharacterRulePolicyFactsInput extends CharacterRuleSnapshotInput {
  eligibilityFacets?: CharacterRulePolicyInput['eligibilityFacets']
  spellPreparationRequest?: CharacterRulePolicyInput['spellPreparationRequest']
  hitPointProgression?: NonNullable<CharacterRulePolicyInput['hitPointFacts']>['progression']
  attunementSlotOverride?: number | null
  resourceUsage?: readonly CharacterResourceUsage[]
  spellsWithEffects?: readonly CompiledSpell[]
}

export interface CharacterRulePolicyFactsResult extends CharacterRuleSnapshotResult {
  facts: CharacterRulePolicyInput
  /** Server-only exact authored action entries. Never included in policy facts. */
  actionEntryPoints: ReturnType<typeof buildCharacterActionRuleFacts>['entryPoints']
  /** Server-only passive zone sources an Encounter places on the Character's token (D155). */
  passiveZoneSources: ReturnType<typeof buildCharacterActionRuleFacts>['passiveZones']
  /** Server-only charges the Character's passive features raise when it rolls initiative. */
  initiativeRestoreSources: ReturnType<typeof buildCharacterActionRuleFacts>['initiativeRestores']
}

interface CharacterRulePolicyFactsPreparation {
  assembled: CharacterRuleSnapshotResult
  spellFacts: ReturnType<typeof buildCharacterSpellRuleFacts>
}

function totalHitDice(character: CharacterRulePolicyFactsInput['character']): number {
  return character.state.hitpoints.hitDice.reduce((total, entry) => total + entry.total, 0)
}

export function composeCharacterRulePolicyFacts(
  input: CharacterRulePolicyFactsInput,
  preparation?: CharacterRulePolicyFactsPreparation
): CharacterRulePolicyFactsResult {
  const assembled = preparation?.assembled ?? assembleCharacterRuleSnapshot(input)
  const { character, context } = input
  const { snapshot, registry } = assembled
  const grantFoldFacts = compileCharacterGrantFoldRuleFacts({ snapshot, registry })
  const spellFacts = preparation?.spellFacts ?? buildCharacterSpellRuleFacts(snapshot, registry)
  const spellPreparationFacts = buildCharacterSpellPreparationRuleFacts(
    character,
    context.registry,
    {
      ...context.catalog,
      spells: withClassListAdditions(
        context.catalog.spells,
        buildCharacterSpellClassListAdditions(snapshot, registry)
      )
    },
    snapshot,
    input.spellPreparationRequest ?? null
  )
  const resourceFacts = buildCharacterResourceRuleFacts({
    character,
    snapshot,
    registry,
    grantFoldFacts,
    spellAccessCandidates: spellFacts.spellAccessCandidates,
    creaturesById: input.creaturesById ?? new Map<string, CompiledCreature>(),
    resourceUsage: input.resourceUsage
  })
  const spellCastFacts = buildCharacterSpellCastRuleFacts({
    snapshot,
    spellCatalog: context.catalog.spells,
    spellAccessCandidates: spellFacts.spellAccessCandidates,
    resourcePoolCandidates: resourceFacts.resourcePoolCandidates
  })

  const actionFacts = buildCharacterActionRuleFacts({
    snapshot,
    registry,
    grantFoldFacts,
    resourcePoolCandidates: resourceFacts.resourcePoolCandidates
  })
  const abilityDefinitions =
    context.vocabularySnapshot?.document.abilities.map(({ id, code }) => ({ id, code })) ?? []
  const facts = characterRulePolicyInputSchema.parse({
    contractVersion: 4,
    abilityDefinitions,
    grantFoldFacts,
    totalLevel: snapshot.totalLevel,
    derivedBaseFacts: buildCharacterDerivedRuleFacts(snapshot, registry),
    ...buildCharacterSpellMechanicsRuleFacts(snapshot),
    ...buildCharacterItemMechanicsRuleFacts(snapshot),
    ...buildCharacterCompanionMechanicsRuleFacts(snapshot),
    ...buildCharacterDefenseRuleFacts(snapshot),
    ...buildCharacterProficiencyRuleFacts(snapshot),
    ...buildCharacterMovementRuleFacts(snapshot, registry),
    ...buildCharacterSenseRuleFacts(snapshot),
    ...buildCharacterArmorClassRuleFacts(snapshot),
    ...buildCharacterHandRuleFacts(snapshot),
    ...buildCharacterHitPointRuleFacts(snapshot, input.hitPointProgression ?? null),
    ...spellFacts,
    ...spellPreparationFacts,
    ...spellCastFacts,
    ...buildCharacterSpellActionRuleFacts({
      spellIds: (input.spellsWithEffects ?? []).map((spell) => spell.id),
      spells: input.spellsWithEffects ?? []
    }),
    spellcastingClasses: buildCharacterSpellSlotRuleFacts(snapshot, registry),
    spellSlotUsageFacts: (character.state.spellSlots ?? []).map((slot) => {
      if (slot.slotKey === SPELL_SLOT_POOL.PACT)
        return { kind: 'PACT' as const, rawUsed: slot.used }
      const match = /^STANDARD:([1-9])$/.exec(slot.slotKey)
      if (!match) throw new Error(`Unsupported spell slot usage key: ${slot.slotKey}`)
      return { kind: 'STANDARD' as const, spellLevel: Number(match[1]), rawUsed: slot.used }
    }),
    ...resourceFacts,
    actionCandidates: actionFacts.actionCandidates,
    eligibilityFacets: input.eligibilityFacets ?? [],
    rest: {
      totalHitDice: totalHitDice(character),
      currentExhaustion: character.state.exhaustion?.level ?? 0,
      attunementSlotOverride: input.attunementSlotOverride ?? null,
      companions: (character.state.creatures ?? []).map((companion) => ({
        companionInstanceId: companion.id,
        totalHitDice: (companion.hitDice ?? []).reduce((total, pool) => total + pool.total, 0)
      }))
    }
  })

  return {
    ...assembled,
    facts,
    actionEntryPoints: actionFacts.entryPoints,
    passiveZoneSources: actionFacts.passiveZones,
    initiativeRestoreSources: actionFacts.initiativeRestores
  }
}
