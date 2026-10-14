import type {
  CharacterActionCandidate,
  CharacterActionRuleEntryPoint,
  CharacterResolvedActionMechanic
} from '@artificer-toolkit/schema/api/characterActionRules'
import type { CompiledActionEntryPoint } from '@artificer-toolkit/schema/projections/characterMechanics'
import type {
  CharacterRulePolicyInput,
  CharacterRulePolicyOutput
} from '@artificer-toolkit/schema/api/characterRules'
import type { CharacterAuthored } from '@artificer-toolkit/shared/authored'
import type { CompiledEffectGroup } from '@artificer-toolkit/shared/compilers'
import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { compileSpell } from '@artificer-toolkit/shared/subjects/compilers'
import { v5 as uuidv5 } from 'uuid'

import { normalizeCharacterActionMechanicFacts } from './characterActionRuleFacts.js'
import { projectCharacterSpellAccess } from './characterRulePolicyAdapter.js'
import { createCharacterSpellCastCandidateId } from './characterSpellCastRuleFacts.js'
import {
  getExplicitSpellCastLevels,
  getOwnedSpellSlotLevels,
  getSpellSourcesBySpellId,
  isActiveSpellSource
} from './sheetProjection.js'
import { getPreparationCapableClassIds, getSheetSpellIdsByClass } from './sheetSpellIds.js'

type SpellCastCandidate = CharacterRulePolicyInput['spellCastCandidates'][number]
type ActionDecision = CharacterRulePolicyOutput['actionDecisions'][number]
type SpellPolicyOutput = Pick<
  CharacterRulePolicyOutput,
  'spellCastDecisions' | 'spellCastMechanics' | 'spellSlots'
>

const SPELL_CAST_ACTION_NAMESPACE = 'b7a2f1d6-3c4e-5a89-9d10-6e2f4c8a1b35'

/**
 * A Spell cast resolves through the action seam under this identity; the candidate carries the rest.
 * The candidate id embeds the source and the spell and can outgrow an action identity, so the action
 * id is a fixed-length digest of it.
 */
export function spellCastActionId(candidateId: string): string {
  return `spell-cast:${uuidv5(candidateId, SPELL_CAST_ACTION_NAMESPACE)}`
}

/**
 * The spells a Character may cast in an Encounter, as actions of their own: movement reactions never
 * read them, and the Sheet's actions never include them.
 */
export type CharacterSpellCastActions = {
  candidates: readonly CharacterActionCandidate[]
  decisions: readonly ActionDecision[]
  compiledActionEntryPoints: readonly CompiledActionEntryPoint[]
}

/** The slot a policy slot key names, with the uses the Character has already spent from it. */
export function readSpellCastSlot(
  spellSlots: SpellPolicyOutput['spellSlots'],
  slotKey: string
): { level: number; used: number } | null {
  if (slotKey === 'PACT')
    return (
      spellSlots.pactMagic && {
        level: spellSlots.pactMagic.level,
        used: spellSlots.pactMagic.rawUsed
      }
    )
  const slot = spellSlots.maxByLevel.find((entry) => `STANDARD:${entry.spellLevel}` === slotKey)
  return slot ? { level: slot.spellLevel, used: slot.rawUsed } : null
}

/**
 * The cast candidates the Sheet lists as castable: a spell from each of its active sources (per
 * class, always prepared or granted) at its own level and at every level it scales at that the
 * Character owns a slot for. Read through the Sheet's own source and cast-level logic.
 */
export function listCastableSpellCandidateIds(input: {
  character: CharacterAuthored
  ruleEvaluation: Parameters<typeof projectCharacterSpellAccess>[0]
}): ReadonlySet<string> {
  const { output, facts } = input.ruleEvaluation
  // Labels only title a source on the Sheet, which an Encounter does not show.
  const sourcesBySpellId = getSpellSourcesBySpellId(
    input.character,
    new Map(),
    getSheetSpellIdsByClass(output, facts),
    getPreparationCapableClassIds(output),
    projectCharacterSpellAccess(input.ruleEvaluation),
    new Map()
  )
  const ownedSlotLevels = getOwnedSpellSlotLevels(output.spellSlots)
  const spellLevelById = new Map(
    facts.spellCastCandidates.map((cast) => [cast.spellId, cast.spellLevel])
  )
  const candidateIds = new Set<string>()
  for (const [spellId, sources] of sourcesBySpellId) {
    const level = spellLevelById.get(spellId)
    if (level === undefined) continue
    const mechanics = output.spellReferenceMechanics
      .filter((entry) => entry.spellId === spellId)
      .flatMap((entry) => entry.mechanics)
    for (const source of sources) {
      if (!isActiveSpellSource(level, source)) continue
      for (const castLevel of getExplicitSpellCastLevels(
        { level, mechanics },
        source,
        ownedSlotLevels
      ))
        candidateIds.add(createCharacterSpellCastCandidateId(source.source, castLevel))
    }
  }
  return candidateIds
}

/**
 * Whether an Encounter offers this cast: only a decision that is AVAILABLE, never a ritual (a ritual
 * takes ten minutes longer, SRD 5.1), never a cast paid from a limited-use pool, and only a cast the
 * Sheet lists as castable. As on the Sheet, the decision names the slot it spends: the cast level's
 * own, or a higher one (a Warlock's Pact Magic slot) when that is all the Character has.
 */
function isCastOffered(
  candidate: SpellCastCandidate,
  decision: SpellPolicyOutput['spellCastDecisions'][number] | undefined,
  castableCandidateIds: ReadonlySet<string>
): boolean {
  return (
    decision?.status === 'AVAILABLE' &&
    candidate.castMode !== 'RITUAL' &&
    candidate.castMode !== 'LIMITED_USE' &&
    !(candidate.castMode === 'FIXED_LEVEL' && candidate.resourceOwnerKey !== null) &&
    castableCandidateIds.has(candidate.candidateId)
  )
}

const LEVEL_SUFFIXES = ['th', 'st', 'nd', 'rd']

/** "Cure Wounds (2nd level)"; a cantrip is just its name. */
function spellCastLabel(spell: SpellAuthored, cast: SpellCastCandidate): string {
  return cast.spellLevel === 0
    ? spell.label
    : `${spell.label} (${cast.castLevel}${LEVEL_SUFFIXES[cast.castLevel] ?? 'th'} level)`
}

const spellEffectGroups = new WeakMap<SpellAuthored, readonly CompiledEffectGroup[]>()

function activeSpellEffects(spell: SpellAuthored): readonly CompiledEffectGroup[] {
  const known = spellEffectGroups.get(spell)
  if (known) return known
  const groups = (compileSpell(spell).effects ?? []).filter(
    (effect) => effect.invocation.kind !== 'PASSIVE'
  )
  spellEffectGroups.set(spell, groups)
  return groups
}

/** The invocation without its row ids, which differ between Effects that invoke the same way. */
const withoutIds = (key: string, value: unknown) => (key === 'id' ? undefined : value)

/**
 * Every Effect of the spell as one group, since one cast is one action: the first Effect's identity
 * and invocation, with all entries. Effects that invoke differently cannot be one action.
 */
function mergeSpellEffects(effects: readonly CompiledEffectGroup[]): CompiledEffectGroup | null {
  const [first, ...rest] = effects
  if (!first) return null
  const invocation = JSON.stringify(first.invocation, withoutIds)
  if (rest.some((effect) => JSON.stringify(effect.invocation, withoutIds) !== invocation))
    return null
  return rest.length === 0
    ? first
    : { ...first, entries: effects.flatMap((effect) => effect.entries) }
}

/** The cast's mechanics as one: the first Effect's roll with every Effect's outcomes. */
function mergeSpellMechanics(
  effects: readonly CompiledEffectGroup[],
  mechanics: readonly CharacterResolvedActionMechanic[]
): CharacterResolvedActionMechanic | null {
  const ordered = effects.map((effect) => mechanics.find((entry) => entry.effectId === effect.id))
  const [first, ...rest] = ordered
  if (!first || ordered.some((entry) => !entry) || mechanics.length !== effects.length) return null
  const { outcomes: _outcomes, ...roll } = first
  const rolls = JSON.stringify(roll)
  if (
    rest.some((entry) => {
      const { outcomes: _other, ...other } = entry!
      return JSON.stringify({ ...other, effectId: roll.effectId }) !== rolls
    })
  )
    return null
  return { ...first, outcomes: ordered.flatMap((entry) => entry!.outcomes) }
}

/**
 * The Encounter's action candidates, entry points and decisions for the spells a Character may cast:
 * one per offered `spellCastCandidates` entry, built from the same candidate the Sheet reads. They
 * are never part of the Sheet's own actions, so they exist only where an Encounter asks for them.
 */
export function buildCharacterSpellCastActions(input: {
  spellCastCandidates: readonly SpellCastCandidate[]
  castableCandidateIds: ReadonlySet<string>
  policyOutput: SpellPolicyOutput
  spellDocumentsById: ReadonlyMap<string, SpellAuthored> | undefined
  firstSequence: number
}): {
  candidates: CharacterActionCandidate[]
  entryPoints: CharacterActionRuleEntryPoint[]
  decisions: ActionDecision[]
} {
  const { policyOutput } = input
  const decisionsByCandidateId = new Map(
    policyOutput.spellCastDecisions.map((decision) => [decision.candidateId, decision])
  )
  const mechanicsByCandidateId = new Map(
    policyOutput.spellCastMechanics.map((entry) => [entry.candidateId, entry])
  )
  const candidates: CharacterActionCandidate[] = []
  const entryPoints: CharacterActionRuleEntryPoint[] = []
  const decisions: ActionDecision[] = []
  for (const cast of input.spellCastCandidates) {
    const actionId = spellCastActionId(cast.candidateId)
    const spell = input.spellDocumentsById?.get(cast.spellId)
    if (
      !spell ||
      !isCastOffered(cast, decisionsByCandidateId.get(cast.candidateId), input.castableCandidateIds)
    )
      continue
    const effects = activeSpellEffects(spell)
    const group = mergeSpellEffects(effects)
    const mechanic = mergeSpellMechanics(
      effects,
      mechanicsByCandidateId.get(cast.candidateId)?.mechanics ?? []
    )
    if (!group || !mechanic) continue
    const mechanicFacts = normalizeCharacterActionMechanicFacts(group)
    const source = {
      kind: 'AUTHORED' as const,
      sourceKind: 'SPELL' as const,
      definitionId: cast.spellId,
      sourceInstanceId: cast.candidateId
    }
    const mechanicsOwner = { kind: 'SPELL' as const, id: cast.spellId }
    const sequence = input.firstSequence + candidates.length
    candidates.push({
      sequence,
      actionId,
      label: spellCastLabel(spell, cast),
      effectId: group.id,
      sourceId: cast.candidateId,
      source,
      mechanicsOwner,
      activationSourceKind: 'ACTIVE_SOURCE',
      equipment: null,
      resourceUse: null,
      mechanicFacts
    })
    entryPoints.push({
      actionId,
      effectId: group.id,
      sourceId: cast.candidateId,
      source,
      mechanicsOwner,
      activationSourceKind: 'ACTIVE_SOURCE',
      compiledEffect: group
    })
    decisions.push({
      sequence,
      actionId,
      effectId: group.id,
      sourceId: cast.candidateId,
      source,
      mechanicsOwner,
      status: 'AVAILABLE',
      reasonCode: null,
      resourcePoolId: null,
      resourceCost: null,
      mechanic
    })
  }
  return { candidates, entryPoints, decisions }
}
