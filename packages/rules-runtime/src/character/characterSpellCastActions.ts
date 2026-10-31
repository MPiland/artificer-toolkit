import type {
  CharacterActionCandidate,
  CharacterActionRuleEntryPoint
} from '@artificer-toolkit/schema/api/characterActionRules'
import type { CharacterGrantFoldOutput } from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import type { CompiledActionEntryPoint } from '@artificer-toolkit/schema/projections/characterMechanics'
import type {
  CharacterRulePolicyInput,
  CharacterRulePolicyOutput
} from '@artificer-toolkit/schema/api/characterRules'
import type { CharacterAuthored } from '@artificer-toolkit/shared/authored'
import type { CompiledEffectGroup } from '@artificer-toolkit/shared/compilers'
import type { CompiledSpell } from '@artificer-toolkit/shared/subjects/compilers'

import { discoverCharacterActionCapabilities } from '../characterActionCapabilityDiscovery.js'
import { compileCharacterActionEntryPoints } from '../encounterActionEntryPointCompiler.js'
import { spellComponentsLabel } from '../spellCastCandidates.js'
import type { CastModifierSource } from './characterCastModifiers.js'
import { affordablePoolFor } from './characterResourcePool.js'
import { dnd5eSpellRangeReplacement } from '../systems/dnd5e/spellRangeReplacement.js'
import type { CharacterRuleEvaluationResult } from './characterRuleEvaluation.js'
import { normalizeCharacterActionMechanicFacts } from './characterActionRuleFacts.js'
import { mergeOnHitRiders, type OnHitRider } from './characterOnHitRiders.js'
import { projectCharacterSpellAccess } from './characterRulePolicyAdapter.js'
import { createCharacterSpellCastCandidateId } from './characterSpellCastRuleFacts.js'
import { castableEffectGroups, spellCastActionId, spellCastLabel } from '../spellCastCandidates.js'
import {
  getCastLevelReaderSpellIds,
  getOwnedSpellSlotLevels,
  getSpellCastLevels,
  getSpellSourcesBySpellId,
  isActiveSpellSource
} from './sheetProjection.js'
import { getPreparationCapableClassIds, getSheetSpellIdsByClass } from './sheetSpellIds.js'

type SpellCastCandidate = CharacterRulePolicyInput['spellCastCandidates'][number]
type SpellAccessCandidate = CharacterRulePolicyInput['spellAccessCandidates'][number]
type ActionDecision = CharacterRulePolicyOutput['actionDecisions'][number]
type SpellPolicyOutput = Pick<
  CharacterRulePolicyOutput,
  'resources' | 'spellCastDecisions' | 'spellCastMechanics' | 'spellSlots'
> & { grantFold: Pick<CharacterGrantFoldOutput, 'modifiers'> }

/**
 * The spells a Character may cast in an Encounter, as actions of their own: movement reactions never
 * read them, attack reactions do, and the Sheet's actions never include them.
 */
export type CharacterSpellCastActions = {
  candidates: readonly CharacterActionCandidate[]
  decisions: readonly ActionDecision[]
  compiledActionEntryPoints: readonly CompiledActionEntryPoint[]
  /** The magic school of each spell the casts name, which a target's school immunity is checked against. */
  magicSchoolIdBySpellId: ReadonlyMap<string, string>
  /** The components each cast names, shown on its choice and never enforced (D171). */
  componentsLabelBySpellId: ReadonlyMap<string, string>
  /** The spells the Character may cast only as a ritual, listed with why an Encounter refuses them (D171). */
  unavailable: readonly { id: string; label: string; reason: string }[]
}

/** The slot a policy slot key names, with the uses the Character has already spent from it. */
export function readSpellCastSlot(
  spellSlots: SpellPolicyOutput['spellSlots'],
  slotKey: string
): { level: number; used: number } | null {
  const pool = spellSlots.slotPools.find((entry) => entry.poolCode === slotKey)
  if (pool) return { level: pool.level, used: pool.rawUsed }
  const slot = spellSlots.maxByLevel.find((entry) => `STANDARD:${entry.spellLevel}` === slotKey)
  return slot ? { level: slot.spellLevel, used: slot.rawUsed } : null
}

/**
 * The cast candidates the Sheet lists as castable: a spell from each of its active sources (per
 * class, always prepared or granted) at its own level and at every higher level the Character
 * owns a slot for; a spell whose effects do not read their cast level lists only its own level. Read
 * through the Sheet's own source and cast-level logic.
 */
export function listCastableSpellCandidateIds(input: {
  character: CharacterAuthored
  ruleEvaluation: Parameters<typeof projectCharacterSpellAccess>[0]
}): ReadonlySet<string> {
  const { output, facts } = input.ruleEvaluation
  const sourcesBySpellId = getSpellSourcesBySpellId(
    input.character,
    getSheetSpellIdsByClass(output, facts),
    getPreparationCapableClassIds(output),
    projectCharacterSpellAccess(input.ruleEvaluation),
    input.ruleEvaluation.snapshot.classRitualSources ?? []
  )
  const ownedSlotLevels = getOwnedSpellSlotLevels(output.spellSlots)
  const castLevelReaderSpellIds = getCastLevelReaderSpellIds(output.spellReferenceMechanics)
  const spellLevelById = new Map(
    facts.spellCastCandidates.map((cast) => [cast.spellId, cast.spellLevel])
  )
  const candidateIds = new Set<string>()
  for (const [spellId, sources] of sourcesBySpellId) {
    const level = spellLevelById.get(spellId)
    if (level === undefined) continue
    for (const source of sources) {
      if (!isActiveSpellSource(level, source)) continue
      const spell = { level, readsCastLevel: castLevelReaderSpellIds.has(spellId) }
      for (const castLevel of getSpellCastLevels(spell, source, ownedSlotLevels))
        candidateIds.add(createCharacterSpellCastCandidateId(source.source, castLevel))
    }
  }
  return candidateIds
}

/** Why a ritual is not cast in an Encounter: it takes ten minutes longer (SRD 5.1) than the spell's casting time. */
export const RITUAL_CAST_REFUSAL =
  'A ritual takes 10 minutes longer to cast, so it cannot be cast in an Encounter; cast it from the Character Sheet.'

/**
 * Whether an Encounter offers this cast: only a decision that is AVAILABLE, never a ritual (a ritual
 * takes ten minutes longer, SRD 5.1), and only a cast the Sheet lists as castable. As on the Sheet,
 * the decision names what the cast spends: the slot of the cast level's own, or a higher one (a
 * Warlock's Pact Magic slot) when that is all the Character has; or, for a limited-use or fixed-level
 * cast, a use of its pool.
 */
function isCastOffered(
  candidate: SpellCastCandidate,
  decision: SpellPolicyOutput['spellCastDecisions'][number] | undefined,
  castableCandidateIds: ReadonlySet<string>
): boolean {
  return (
    decision?.status === 'AVAILABLE' &&
    candidate.castMode !== 'RITUAL' &&
    castableCandidateIds.has(candidate.candidateId)
  )
}

/**
 * The cast's Effect group with its targeting narrowed to the creature types its grant allows
 * (Chains of Carceri's celestials, fiends and elementals, D156): the types both allow, or the
 * grant's when the spell names none.
 */
function withGrantCreatureTypes(
  group: CompiledEffectGroup,
  allowedCreatureTypeIds: readonly string[]
): CompiledEffectGroup {
  const { targeting } = group.invocation
  if (!allowedCreatureTypeIds.length || !targeting || targeting.selectionKind === 'SELF')
    return group
  const own = targeting.allowedCreatureTypeIds ?? []
  return {
    ...group,
    invocation: {
      ...group.invocation,
      targeting: {
        ...targeting,
        allowedCreatureTypeIds: own.length
          ? own.filter((id) => allowedCreatureTypeIds.includes(id))
          : [...allowedCreatureTypeIds]
      }
    }
  }
}

/**
 * The Encounter's action candidates, entry points and decisions for the spells a Character may cast:
 * one per offered `spellCastCandidates` entry, built from the same candidate the Sheet reads. They
 * are never part of the Sheet's own actions, so they exist only where an Encounter asks for them.
 */
export function buildCharacterSpellCastActions(input: {
  spellCastCandidates: readonly SpellCastCandidate[]
  /** The grants the casts come from, read for what a grant adds to its casts. */
  spellAccessCandidates: readonly SpellAccessCandidate[]
  castableCandidateIds: ReadonlySet<string>
  policyOutput: SpellPolicyOutput
  spellsById: ReadonlyMap<string, CompiledSpell> | undefined
  /** The Character's level, the sum of its class levels. */
  characterLevel: number
  /** The riders the Character's features owe a cast of the Spell they name (G4). */
  onHitRiders?: readonly OnHitRider[]
  firstSequence: number
  /** What the Character's features let it pay on a cast; offered on casts no pool already pays for. */
  castModifiers?: readonly CastModifierSource[]
}): {
  candidates: CharacterActionCandidate[]
  entryPoints: CharacterActionRuleEntryPoint[]
  decisions: ActionDecision[]
  unavailable: CharacterSpellCastActions['unavailable'][number][]
} {
  const { policyOutput } = input
  const decisionsByCandidateId = new Map(
    policyOutput.spellCastDecisions.map((decision) => [decision.candidateId, decision])
  )
  const mechanicsByCandidateId = new Map(
    policyOutput.spellCastMechanics.map((entry) => [entry.candidateId, entry])
  )
  const accessById = new Map(input.spellAccessCandidates.map((access) => [access.accessId, access]))
  const candidates: CharacterActionCandidate[] = []
  const entryPoints: CharacterActionRuleEntryPoint[] = []
  const decisions: ActionDecision[] = []
  const unavailable: CharacterSpellCastActions['unavailable'][number][] = []
  for (const cast of input.spellCastCandidates) {
    const spell = input.spellsById?.get(cast.spellId)
    if (
      spell &&
      cast.castMode === 'RITUAL' &&
      decisionsByCandidateId.get(cast.candidateId)?.status === 'AVAILABLE' &&
      input.castableCandidateIds.has(cast.candidateId)
    )
      unavailable.push({
        id: spellCastActionId(cast.candidateId),
        label: `${spellCastLabel(spell, cast)} (ritual)`,
        reason: RITUAL_CAST_REFUSAL
      })
    if (
      !spell ||
      !isCastOffered(cast, decisionsByCandidateId.get(cast.candidateId), input.castableCandidateIds)
    )
      continue
    // One cast action runs one Effect group. Groups that are each a reaction of their own (Shield
    // answering an attack, and answering Magic Missile) are separate actions; any other spell with
    // several groups is not offered.
    const effects = castableEffectGroups(spell)
    const mechanics = mechanicsByCandidateId.get(cast.candidateId)?.mechanics ?? []
    const access =
      cast.source.sourceKind === 'FEATURE'
        ? accessById.get(`${cast.source.sourceInstanceId}:${cast.spellId}`)
        : undefined
    // An at-will grant's lockout keys every creature its casts target to the grant (D156).
    const perTargetLockout =
      access?.perTargetLockout && cast.castMode === 'AT_WILL' ? { grantId: access.grantId } : null
    const range = dnd5eSpellRangeReplacement(policyOutput.grantFold, {
      id: cast.spellId,
      level: cast.spellLevel,
      magicSchoolId: spell.magicSchoolId
    })
    for (const [index, spellGroup] of effects.entries()) {
      const typedGroup = withGrantCreatureTypes(spellGroup, access?.allowedCreatureTypeIds ?? [])
      const rangedGroup = range
        ? {
            ...typedGroup,
            invocation: {
              ...typedGroup.invocation,
              range: { id: typedGroup.invocation.range.id, ...range }
            }
          }
        : typedGroup
      const group = mergeOnHitRiders(rangedGroup, input.onHitRiders ?? [], undefined, cast.spellId)
      const actionId = spellCastActionId(cast.candidateId, index === 0 ? undefined : group.id)
      const mechanic = mechanics.find((entry) => entry.effectId === group.id)
      if (!mechanic) continue
      const mechanicFacts = normalizeCharacterActionMechanicFacts(group)
      const source = {
        kind: 'AUTHORED' as const,
        sourceKind: 'SPELL' as const,
        definitionId: cast.spellId,
        sourceInstanceId: cast.candidateId
      }
      const mechanicsOwner = { kind: 'SPELL' as const, id: cast.spellId }
      // As on the Sheet, a leveled cast paid from a pool spends one of its uses, and a cantrip is free.
      const poolId =
        cast.spellLevel > 0 && (cast.castMode === 'LIMITED_USE' || cast.castMode === 'FIXED_LEVEL')
          ? cast.resourceOwnerKey
          : null
      const pool =
        poolId === null
          ? null
          : policyOutput.resources.find(
              (resource) => resource.poolId === poolId && resource.state === 'RESOLVED'
            )
      if (pool === undefined) continue
      const resourceUse = pool && { poolId: pool.poolId, chargeId: pool.chargeId, cost: 1 }
      const offeredModifiers = resourceUse
        ? []
        : (input.castModifiers ?? []).flatMap(({ modifierId, label, cost }) => {
            const modifierPool = affordablePoolFor(policyOutput.resources, cost)
            return modifierPool
              ? [
                  {
                    modifierId,
                    label,
                    chargeId: cost.chargeId,
                    cost: cost.cost,
                    poolId: modifierPool.poolId
                  }
                ]
              : []
          })
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
        resourceUse,
        ...(offeredModifiers.length > 0 && { castModifiers: offeredModifiers }),
        mechanicFacts
      })
      entryPoints.push({
        actionId,
        effectId: group.id,
        sourceId: cast.candidateId,
        source,
        mechanicsOwner,
        activationSourceKind: 'ACTIVE_SOURCE',
        compiledEffect: group,
        spellCastLevel: cast.castLevel,
        characterLevel: input.characterLevel,
        ...(perTargetLockout && { perTargetLockout })
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
        resourcePoolId: resourceUse?.poolId ?? null,
        resourceCost: resourceUse?.cost ?? null,
        mechanic
      })
    }
  }
  return { candidates, entryPoints, decisions, unavailable }
}

/**
 * Compiles the spells a Character may cast now into the actions that run them: the one compile both
 * the Encounter (which offers only these) and the Sheet (which reads a cast's summon plan from it,
 * D190) use. A cast the compiler cannot run is left out. `policyOutput` is the output the casts are
 * decided against (an Encounter's holds its active grants); `firstSequence` numbers the actions after
 * the Character's other ones.
 */
export function compileCharacterSpellCasts(input: {
  gameSystemId: string
  character: CharacterAuthored
  ruleEvaluation: CharacterRuleEvaluationResult
  policyOutput: CharacterRulePolicyOutput
  spellsById: ReadonlyMap<string, CompiledSpell> | undefined
  /** The Character's level, the sum of its class levels. */
  characterLevel: number
  conditionDefinitionIds: readonly string[]
  firstSequence: number
}): CharacterSpellCastActions {
  const { gameSystemId, ruleEvaluation, policyOutput, spellsById } = input
  const spellCast = buildCharacterSpellCastActions({
    spellCastCandidates: ruleEvaluation.facts.spellCastCandidates,
    spellAccessCandidates: ruleEvaluation.facts.spellAccessCandidates,
    castableCandidateIds: listCastableSpellCandidateIds({
      character: input.character,
      ruleEvaluation: { ...ruleEvaluation, output: policyOutput }
    }),
    policyOutput,
    spellsById,
    characterLevel: input.characterLevel,
    onHitRiders: ruleEvaluation.onHitRiders,
    firstSequence: input.firstSequence,
    castModifiers: ruleEvaluation.castModifiers
  })
  const entryPoints = compileCharacterActionEntryPoints({
    gameSystemId,
    candidates: spellCast.candidates,
    descriptors: discoverCharacterActionCapabilities({
      gameSystemId,
      candidates: spellCast.candidates,
      conditionDefinitionIds: [...input.conditionDefinitionIds],
      abilityDefinitions: ruleEvaluation.facts.abilityDefinitions,
      entryPoints: spellCast.entryPoints
    })
  })
  const executableActionIds = new Set(
    entryPoints
      .filter((entry) => entry.compilation.kind === 'COMPILED')
      .map((entry) => entry.actionId)
  )
  return {
    candidates: spellCast.candidates.filter((c) => executableActionIds.has(c.actionId)),
    decisions: spellCast.decisions.filter((d) => executableActionIds.has(d.actionId)),
    compiledActionEntryPoints: entryPoints.filter((entry) =>
      executableActionIds.has(entry.actionId)
    ),
    magicSchoolIdBySpellId: new Map(
      [...(spellsById ?? [])].map(([spellId, spell]) => [spellId, spell.magicSchoolId])
    ),
    componentsLabelBySpellId: new Map(
      [...(spellsById ?? [])].flatMap(([spellId, spell]) => {
        const label = spellComponentsLabel(spell)
        return label ? [[spellId, label] as const] : []
      })
    ),
    unavailable: spellCast.unavailable
  }
}
