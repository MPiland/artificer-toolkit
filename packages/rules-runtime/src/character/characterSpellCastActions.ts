import type {
  CharacterActionCandidate,
  CharacterActionRuleEntryPoint,
  CharacterResolvedActionMechanic
} from '@artificer-toolkit/schema/api/characterActionRules'
import type {
  CharacterRulePolicyInput,
  CharacterRulePolicyOutput
} from '@artificer-toolkit/schema/api/characterRules'
import type { CompiledEffectGroup } from '@artificer-toolkit/shared/compilers'
import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { compileSpell } from '@artificer-toolkit/shared/subjects/compilers'

import { normalizeCharacterActionMechanicFacts } from './characterActionRuleFacts.js'

type SpellCastCandidate = CharacterRulePolicyInput['spellCastCandidates'][number]
type ActionDecision = CharacterRulePolicyOutput['actionDecisions'][number]
type SpellPolicyOutput = Pick<
  CharacterRulePolicyOutput,
  | 'spellCastDecisions'
  | 'spellCastMechanics'
  | 'spellReferenceMechanics'
  | 'spellSlots'
  | 'spellPreparation'
>

export const SPELL_CAST_ACTION_PREFIX = 'spell-cast:'
const MAX_ACTION_ID_LENGTH = 240

/** A Spell cast resolves through the action seam under this identity; the candidate carries the rest. */
export function spellCastActionId(candidateId: string): string {
  return `${SPELL_CAST_ACTION_PREFIX}${candidateId}`
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
 * Whether the Sheet lists this class spell among the Character's castable spells: a preparing class
 * casts what it has prepared, any other class what it knows, and a cantrip what the class knows.
 */
function isClassSpellActive(cast: SpellCastCandidate, policyOutput: SpellPolicyOutput): boolean {
  if (cast.source.sourceKind !== 'CLASS' && cast.source.sourceKind !== 'SUBCLASS') return true
  return policyOutput.spellPreparation.sources.some(
    (source) =>
      source.preparedSpellIds.includes(cast.spellId) ||
      ((cast.spellLevel === 0 || source.preparedSpellLimit === null) &&
        source.learnedSpellIds.includes(cast.spellId))
  )
}

/**
 * Whether an Encounter offers this cast: only a decision that is AVAILABLE, never a ritual (a ritual
 * takes ten minutes longer, SRD 5.1), never a cast paid from a limited-use pool, only a spell the
 * Sheet lists as castable, and only a slot of exactly the chosen cast level (the Sheet may spend a
 * higher slot for a base entry; an Encounter upcasts by choosing the higher candidate instead).
 */
function isCastOffered(
  candidate: SpellCastCandidate,
  decision: SpellPolicyOutput['spellCastDecisions'][number] | undefined,
  policyOutput: SpellPolicyOutput
): boolean {
  if (
    !decision ||
    decision.status !== 'AVAILABLE' ||
    candidate.castMode === 'RITUAL' ||
    candidate.castMode === 'LIMITED_USE' ||
    (candidate.castMode === 'FIXED_LEVEL' && candidate.resourceOwnerKey !== null) ||
    !isClassSpellActive(candidate, policyOutput)
  )
    return false
  if (candidate.spellLevel === 0 || candidate.castMode !== 'SPELL_SLOT') return true
  const slot =
    decision.slotKey === null ? null : readSpellCastSlot(policyOutput.spellSlots, decision.slotKey)
  return slot !== null && slot.level === candidate.castLevel
}

/**
 * The levels a spell's damage or healing scales at: the only levels above its own it can be cast at.
 * Read from the uncast spell's mechanics, as the Sheet does; a cast's own mechanics are already
 * resolved at one level and carry no scaling.
 */
function scalingLevels(spellId: string, policyOutput: SpellPolicyOutput): ReadonlySet<number> {
  return new Set(
    policyOutput.spellReferenceMechanics
      .filter((entry) => entry.spellId === spellId)
      .flatMap((entry) => entry.mechanics)
      .flatMap((mechanic) => mechanic.outcomes)
      .flatMap((outcome) =>
        outcome.kind === 'DAMAGE' || outcome.kind === 'HEAL'
          ? outcome.scaling.map((entry) => entry.level)
          : []
      )
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
      actionId.length > MAX_ACTION_ID_LENGTH ||
      !spell ||
      !isCastOffered(cast, decisionsByCandidateId.get(cast.candidateId), policyOutput)
    )
      continue
    const effects = activeSpellEffects(spell)
    const group = mergeSpellEffects(effects)
    const mechanic = mergeSpellMechanics(
      effects,
      mechanicsByCandidateId.get(cast.candidateId)?.mechanics ?? []
    )
    if (
      !group ||
      !mechanic ||
      (!cast.baseEntry && !scalingLevels(cast.spellId, policyOutput).has(cast.castLevel))
    )
      continue
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
