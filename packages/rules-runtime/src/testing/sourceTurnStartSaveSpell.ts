import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { powerWordStun } from '@artificer-toolkit/source-data/srd/spells/power-word-stun.js'

import { SRD_ABILITIES } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { executeNativeActionGraphs } from '../encounterActionExecution.js'
import { prepareEncounterActionEffectPlans } from '../encounterActionEffectPlans.js'
import { createPlatformRulesRuntime } from '../platformRulesRuntime.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import { testUuid } from './dnd5eSrdEncounter.js'
import { compiledTestSpellCast } from './plannedTimedCondition.js'

const CONSTITUTION = SRD_ABILITIES.find(({ code }) => code === 'CONSTITUTION')!.id

export const sourceTurnStartRuling = {
  id: testUuid(0xc510),
  effectKind: 'MANUAL_ADJUDICATION' as const,
  label: 'Choose destination plane',
  reasonCode: 'GM_CHOICE' as const,
  instructions: 'The GM chooses the plane.'
}

/** The failed save's transport to a place the table does not model, which the ruling above settles. */
export const sourceTurnStartPlaneTransport = {
  id: testUuid(0xc517),
  effectKind: 'TELEPORT' as const,
  targetKind: 'TARGET' as const,
  destinationKind: 'SPECIAL' as const
}

/** Power Word Stun with its repeated save moved to the start of its source's next turn. */
export function sourceTurnStartSpell(onFailureOutcomes: readonly object[]): SpellAuthored {
  const [effect] = powerWordStun.effects ?? []
  const [path] = effect!.paths
  if (!path || !('resultBlock' in path)) throw new Error('Expected a result-block path.')
  const block = path.resultBlock
  if (block.resultKind !== 'SEQUENCE') throw new Error('Expected a sequence result block.')
  const { duration: _duration, gate: _gate, ...untimed } = block
  return {
    ...powerWordStun,
    effects: [
      {
        ...effect!,
        paths: [
          {
            ...path,
            resultBlock: {
              ...untimed,
              outcomes: block.outcomes.map((outcome) =>
                outcome.effectKind === 'FOLLOW_UP_SAVE'
                  ? {
                      ...outcome,
                      timing: 'SOURCE_NEXT_TURN_START' as const,
                      attempts: { kind: 'ONCE' as const },
                      onSuccess: { kind: 'END' as const },
                      onFailure: {
                        kind: 'OUTCOMES' as const,
                        endCurrent: true,
                        resultKind: 'SEQUENCE' as const,
                        outcomes: onFailureOutcomes
                      }
                    }
                  : outcome
              )
            }
          }
        ]
      }
    ]
  } as SpellAuthored
}

/** The spell's cast compiled by the real cast and entry compilers. */
export function compiledSourceTurnStartSpell(authored: SpellAuthored) {
  return compiledTestSpellCast({
    spell: authored,
    cast: {
      sequence: 0,
      candidateId: `CLASS:class-${authored.id}:${authored.id}:level:7`,
      spellId: authored.id,
      source: {
        spellId: authored.id,
        sourceKind: 'CLASS',
        sourceInstanceId: `class-${authored.id}`
      },
      spellLevel: 7,
      castMode: 'SPELL_SLOT',
      castLevel: 7,
      baseEntry: true,
      resourceOwnerKey: null,
      slotPoolCode: null
    },
    decision: { status: 'AVAILABLE', reasonCode: 'SPELL_SLOT_REMAINING', slotKey: 'STANDARD:7' }
  }).entry.compilation
}

/** The repeating effect a cast of the spell plans for `holderActorId`, from its real cast graph. */
export async function plannedSourceTurnStartEffect(input: {
  spell: SpellAuthored
  encounterId: string
  sourceActorId: string
  holderActorId: string
}) {
  const { executionPlan, activeEffectPlan } = compiledSourceTurnStartSpell(input.spell)
  if (executionPlan.kind !== 'SINGLE_GRAPH') throw new Error('Expected one graph.')
  const cast = await executeNativeActionGraphs({
    runtime: createPlatformRulesRuntime({
      definitions: {
        async requireCurrent() {
          throw new Error('Definitions are not used by sealed graphs.')
        }
      }
    }),
    adapter: dnd5eCharacterRuleActionSystemAdapter,
    plan: executionPlan,
    occurrenceId: testUuid(0xc515),
    binding: {
      actionMechanic: {
        attackBonus: null,
        attackKind: null,
        attackDomain: null,
        attackAbility: null,
        attackRollMode: 'NORMAL',
        save: { abilityDefinitionId: CONSTITUTION, dc: 15 },
        outcomes: []
      },
      sourceDerivedFacts: {},
      targetActorId: input.holderActorId,
      targetDerivedFacts: { statBlock: { armorClass: 12 }, savingThrowDefinitions: [] },
      targetConditionIds: [],
      currentHitPoints: 100,
      temporaryHitPoints: 0,
      maximumHitPoints: 100,
      targetScalarValues: {},
      defenses: []
    },
    afterTest: async () => undefined
  })
  const planned = prepareEncounterActionEffectPlans({
    encounterId: input.encounterId,
    occurrenceId: testUuid(0xc515),
    commandId: testUuid(0xc516),
    sourceActorId: input.sourceActorId,
    sourceLabel: input.spell.label,
    sourceHidden: false,
    currentActorId: null,
    target: {
      actorId: input.holderActorId,
      conditionIds: [],
      effectiveSize: 'MEDIUM',
      lifetimeScope: 'ENCOUNTER',
      activeEffects: []
    },
    activeEffectsByActorId: new Map(),
    activeEffectPlan,
    published: cast.published,
    execution: cast.execution,
    d20: cast.d20,
    applications: cast.applications
  })
  if (!planned.recurringEffect) throw new Error('The cast planned no repeating effect.')
  return planned.recurringEffect
}
