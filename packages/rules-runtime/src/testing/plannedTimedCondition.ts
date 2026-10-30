import { rollModeCapabilityRegistry } from '../platformPolicyModules.js'
import type {
  CharacterRulePolicyInput,
  CharacterRulePolicyOutput
} from '@artificer-toolkit/schema/api/characterRules'
import type { ServerCompletedRuleExecutionDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { compileSpell } from '@artificer-toolkit/shared/subjects/compilers'
import {
  SRD_ABILITIES,
  SRD_CONDITION_TYPES,
  SRD_SYSTEM_ID
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { buildCharacterSpellCastActions } from '../character/characterSpellCastActions.js'
import type { CharacterRuleActionSystemAdapter } from '../characterRuleActionSystemAdapter.js'
import { discoverCharacterActionCapabilities } from '../characterActionCapabilityDiscovery.js'
import { prepareEncounterActionEffectPlans } from '../encounterActionEffectPlans.js'
import { compileCharacterActionEntryPoints } from '../encounterActionEntryPointCompiler.js'
import { testUuid } from './dnd5eSrdEncounter.js'

type SpellCastCandidate = CharacterRulePolicyInput['spellCastCandidates'][number]
type SpellAccessCandidate = CharacterRulePolicyInput['spellAccessCandidates'][number]

/**
 * A spell cast compiled to its Encounter action by the real cast and entry compilers: `cast` is the
 * policy's offered candidate, available by `decision`, and `spellAccessCandidates` the grants it
 * came through.
 */
export function compiledTestSpellCast(input: {
  spell: SpellAuthored
  cast: SpellCastCandidate
  decision: Omit<CharacterRulePolicyOutput['spellCastDecisions'][number], 'candidateId'>
  spellAccessCandidates?: readonly SpellAccessCandidate[]
  /** The System adapter the cast compiles through; the installed one by default. */
  adapter?: CharacterRuleActionSystemAdapter
}) {
  const { spell, cast } = input
  const built = buildCharacterSpellCastActions({
    spellCastCandidates: [cast],
    spellAccessCandidates: input.spellAccessCandidates ?? [],
    castableCandidateIds: new Set([cast.candidateId]),
    policyOutput: {
      resources: [],
      spellCastDecisions: [{ candidateId: cast.candidateId, ...input.decision }],
      spellCastMechanics: [
        {
          sequence: 0,
          candidateId: cast.candidateId,
          spellId: spell.id,
          source: cast.source,
          castLevel: cast.castLevel,
          mechanics: (compileSpell(spell).effects ?? []).map((effect) => ({
            effectId: effect.id,
            trigger: effect.invocation.triggerCode,
            activation: null,
            rangeLabel: null,
            attackKind: null,
            attackDomain: null,
            attackAbility: null,
            attackBonus: null,
            attackRollMode: null,
            save: null,
            outcomes: []
          }))
        }
      ],
      spellSlots: {
        calculationId: 'slots',
        sourceClassIds: [],
        maxByLevel: [
          {
            spellLevel: spell.level,
            slotCount: 1,
            sourceIds: [],
            rawUsed: 0,
            effectiveUsed: 0,
            remaining: 1
          }
        ],
        slotPools: [],
        fusionStrategy: 'NONE' as const
      }
    } satisfies Pick<
      CharacterRulePolicyOutput,
      'resources' | 'spellCastDecisions' | 'spellCastMechanics' | 'spellSlots'
    >,
    spellsById: new Map([[spell.id, compileSpell(spell)]]),
    firstSequence: 10,
    characterLevel: 1
  })
  const [entry] = compileCharacterActionEntryPoints(
    {
      gameSystemId: SRD_SYSTEM_ID,
      candidates: built.candidates,
      descriptors: discoverCharacterActionCapabilities({
        gameSystemId: SRD_SYSTEM_ID,
        candidates: built.candidates,
        conditionDefinitionIds: SRD_CONDITION_TYPES.map(({ id }) => id).sort(),
        abilityDefinitions: SRD_ABILITIES.map(({ id, code }) => ({ id, code })),
        entryPoints: built.entryPoints
      })
    },
    input.adapter
  )
  if (
    entry?.kind !== 'CHARACTER_ACTION' ||
    entry.schemaVersion !== 4 ||
    entry.compilation.kind !== 'COMPILED'
  )
    throw new Error(`${spell.label} does not compile to an Encounter action.`)
  return { entry: { ...entry, compilation: entry.compilation }, candidate: built.candidates[0]! }
}

/**
 * The definition the room plans for a spell's authored timed condition, from the real cast
 * compiler: `sourceActorId` casts it at its level, and `holderActorId` fails the save when the spell
 * has one. Seed it as an active effect.
 */
export function plannedTimedCondition(input: {
  encounterId: string
  sourceActorId: string
  holderActorId: string
  spell: SpellAuthored
  /** The holder's lifetime scope: a Character's effect outlasts the Encounter (`OWNER`). */
  lifetimeScope: 'OWNER' | 'ENCOUNTER'
  /** Whose turn it is when the spell is cast; none by default. */
  currentActorId?: string | null
}) {
  const { spell } = input
  const sourceInstanceId = `class-${spell.id}`
  const { entry } = compiledTestSpellCast({
    spell,
    cast: {
      sequence: 0,
      candidateId: `CLASS:${sourceInstanceId}:${spell.id}:level:${spell.level}`,
      spellId: spell.id,
      source: { spellId: spell.id, sourceKind: 'CLASS', sourceInstanceId },
      spellLevel: spell.level,
      castMode: 'SPELL_SLOT',
      castLevel: spell.level,
      baseEntry: true,
      resourceOwnerKey: null,
      slotPoolCode: null
    },
    decision: {
      status: 'AVAILABLE',
      reasonCode: 'SPELL_SLOT_REMAINING',
      slotKey: `STANDARD:${spell.level}`
    }
  })
  const { recurringEffect } = plannedCastEffects({ ...input, entry, resultPath: 'ON_SAVE_FAIL' })
  if (!recurringEffect) throw new Error(`${spell.label} planned no condition effect.`)
  return recurringEffect
}

/**
 * The effects the room plans for a compiled cast against `holderActorId`, its save (when it has one)
 * landing on `resultPath`.
 */
export function plannedCastEffects(input: {
  encounterId: string
  sourceActorId: string
  /** The casting Character, which a source immunity keys; omitted for a cast that plans none. */
  sourceCharacterId?: string | null
  holderActorId: string
  spell: SpellAuthored
  entry: ReturnType<typeof compiledTestSpellCast>['entry']
  lifetimeScope: 'OWNER' | 'ENCOUNTER'
  currentActorId?: string | null
  resultPath: 'ON_SAVE_FAIL' | 'ON_SAVE_SUCCESS'
}) {
  const { executionPlan, activeEffectPlan } = input.entry.compilation
  const published =
    executionPlan.kind === 'SINGLE_GRAPH' ? executionPlan.published : executionPlan.test.published
  const execution = {
    status: 'COMPLETE',
    outputs: {},
    evidence: {
      source: {
        definitionId: published.id,
        gameSystemId: SRD_SYSTEM_ID,
        definitionFamilyKey: published.definitionFamilyKey,
        checksum: published.checksum
      },
      capabilityContractVersion: 1,
      facts: {},
      trace: [],
      outputs: {}
    }
  } satisfies ServerCompletedRuleExecutionDto
  return prepareEncounterActionEffectPlans({
    encounterId: input.encounterId,
    occurrenceId: testUuid(0xc310),
    commandId: testUuid(0xc311),
    sourceActorId: input.sourceActorId,
    sourceLabel: input.spell.label,
    ...(input.sourceCharacterId !== undefined && { sourceCharacterId: input.sourceCharacterId }),
    sourceHidden: false,
    currentActorId: input.currentActorId ?? null,
    target: {
      actorId: input.holderActorId,
      conditionIds: [],
      effectiveSize: 'MEDIUM',
      lifetimeScope: input.lifetimeScope,
      activeEffects: []
    },
    activeEffectsByActorId: new Map(),
    activeEffectPlan,
    published,
    execution,
    d20:
      executionPlan.kind === 'TEST_OUTCOME'
        ? {
            requestId: testUuid(0xc312),
            rollMode: 'NORMAL',
            keep: rollModeCapabilityRegistry.rollModeKeep({
              gameSystemId: published.gameSystemId,
              rollMode: 'NORMAL'
            }),
            derivedRollMode: 'NORMAL',
            rawFaces: [10],
            selectedNatural: 10,
            contributors: [],
            contributorChecksum: 'c'.repeat(64),
            modifier: 0,
            total: 10,
            defenseOrDc: 15,
            resultPath: input.resultPath
          }
        : null,
    applications: []
  })
}
