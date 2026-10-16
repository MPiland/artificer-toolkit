import type { CharacterRulePolicyOutput } from '@artificer-toolkit/schema/api/characterRules'
import type { ServerCompletedRuleExecutionDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { compileSpell } from '@artificer-toolkit/shared/subjects/compilers'
import {
  SRD_ABILITIES,
  SRD_CONDITION_TYPES,
  SRD_SYSTEM_ID
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { buildCharacterSpellCastActions } from '../character/characterSpellCastActions.js'
import { discoverCharacterActionCapabilities } from '../characterActionCapabilityDiscoveryRegistry.js'
import { prepareEncounterActionEffectPlans } from '../encounterActionEffectPlans.js'
import { compileCharacterActionEntryPoints } from '../encounterActionEntryPointCompiler.js'
import { testUuid } from './dnd5eSrdEncounter.js'

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
}) {
  const { spell } = input
  const sourceInstanceId = `class-${spell.id}`
  const cast = {
    sequence: 0,
    candidateId: `CLASS:${sourceInstanceId}:${spell.id}:level:${spell.level}`,
    spellId: spell.id,
    source: { spellId: spell.id, sourceKind: 'CLASS', sourceInstanceId },
    spellLevel: spell.level,
    castMode: 'SPELL_SLOT',
    castLevel: spell.level,
    baseEntry: true,
    resourceOwnerKey: null
  } as const
  const built = buildCharacterSpellCastActions({
    spellCastCandidates: [cast],
    castableCandidateIds: new Set([cast.candidateId]),
    policyOutput: {
      spellCastDecisions: [
        {
          candidateId: cast.candidateId,
          status: 'AVAILABLE',
          reasonCode: 'SPELL_SLOT_REMAINING',
          slotKey: `STANDARD:${spell.level}`
        }
      ],
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
            attackBonus: null,
            attackRollMode: null,
            save: null,
            outcomes: []
          }))
        }
      ],
      resources: [],
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
        pactMagic: null,
        fusionStrategy: 'NONE' as const
      }
    } satisfies Pick<
      CharacterRulePolicyOutput,
      'resources' | 'spellCastDecisions' | 'spellCastMechanics' | 'spellSlots'
    >,
    spellDocumentsById: new Map([[spell.id, spell]]),
    firstSequence: 10
  })
  const [entry] = compileCharacterActionEntryPoints({
    gameSystemId: SRD_SYSTEM_ID,
    candidates: built.candidates,
    descriptors: discoverCharacterActionCapabilities({
      gameSystemId: SRD_SYSTEM_ID,
      candidates: built.candidates,
      conditionDefinitionIds: SRD_CONDITION_TYPES.map(({ id }) => id).sort(),
      abilityDefinitions: SRD_ABILITIES.map(({ id, code }) => ({ id, code })),
      entryPoints: built.entryPoints
    })
  })
  if (
    entry?.kind !== 'CHARACTER_ACTION' ||
    entry.schemaVersion !== 4 ||
    entry.compilation.kind !== 'COMPILED'
  )
    throw new Error(`${spell.label} does not compile to an Encounter action.`)
  const { executionPlan, activeEffectPlan } = entry.compilation
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
  const { recurringEffect } = prepareEncounterActionEffectPlans({
    encounterId: input.encounterId,
    occurrenceId: testUuid(0xc310),
    commandId: testUuid(0xc311),
    sourceActorId: input.sourceActorId,
    sourceLabel: spell.label,
    sourceHidden: false,
    currentActorId: null,
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
            derivedRollMode: 'NORMAL',
            rawFaces: [10],
            selectedNatural: 10,
            contributors: [],
            contributorChecksum: 'c'.repeat(64),
            modifier: 0,
            total: 10,
            defenseOrDc: 15,
            resultPath: 'ON_SAVE_FAIL'
          }
        : null,
    applications: []
  })
  if (!recurringEffect) throw new Error(`${spell.label} planned no condition effect.`)
  return recurringEffect
}
