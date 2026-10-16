import type { ServerCompletedRuleExecutionDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import { compileEffect } from '@artificer-toolkit/shared/compilers'

import { prepareEncounterActionEffectPlans } from '../encounterActionEffectPlans.js'
import { buildCompiledActionCompilerSource } from '../encounterActionEntryPointCompiler.js'
import { dnd5eCharacterRuleActionSystemAdapter as adapter } from '../systems/dnd5e/effectActionCompiler.js'
import { absorbElementsSpell, srdDamageTypeId } from './absorbElementsSpell.js'
import { ACTION_EFFECT_ID, characterActionDescriptor } from './characterActionDescriptor.js'
import { SRD_SYSTEM_ID, testUuid } from './dnd5eSrdEncounter.js'

const ENCOUNTER_ID = testUuid(0x7c0)
const REACTOR_ID = testUuid(0x7c1)

/**
 * The effect the room plans for a user-authored Absorb Elements reaction, from the real compiler,
 * as cast with a slot of `castLevel` against a hit that dealt `triggerDamageTypeCodes`.
 */
export function plannedAbsorbElements(input: {
  commandId: string
  occurrenceId: string
  chosenDamageTypeCodes?: readonly [string, ...string[]]
  triggerDamageTypeCodes?: readonly string[]
  castLevel?: number
}) {
  const [effect] = absorbElementsSpell(input.chosenDamageTypeCodes ?? ['FIRE']).effects ?? []
  if (!effect) throw new Error('The reaction fixture has no authored effect.')
  const action = characterActionDescriptor(
    compileEffect({ ...effect, id: ACTION_EFFECT_ID }),
    input.castLevel ?? 1
  )
  const executionPlan = adapter.compileExecutionPlan?.({
    action,
    compilerSource: buildCompiledActionCompilerSource(action)
  })
  if (executionPlan?.kind !== 'SINGLE_GRAPH') throw new Error('The reaction is one graph.')
  const { published } = executionPlan
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
    encounterId: ENCOUNTER_ID,
    commandId: input.commandId,
    occurrenceId: input.occurrenceId,
    sourceActorId: REACTOR_ID,
    sourceLabel: 'Absorb Elements',
    sourceHidden: false,
    currentActorId: REACTOR_ID,
    target: {
      actorId: REACTOR_ID,
      conditionIds: [],
      effectiveSize: 'MEDIUM',
      lifetimeScope: 'ENCOUNTER',
      activeEffects: []
    },
    activeEffectsByActorId: new Map(),
    activeEffectPlan: adapter.activeEffectPlans?.({ action, published })[0] ?? null,
    published,
    execution,
    d20: null,
    applications: [],
    trigger: { damageTypeIds: (input.triggerDamageTypeCodes ?? ['FIRE']).map(srdDamageTypeId) }
  })
  if (!recurringEffect) throw new Error('The reaction planned no effect.')
  return recurringEffect
}
