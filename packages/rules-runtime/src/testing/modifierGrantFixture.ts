import type { ServerCompletedRuleExecutionDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import type { PathLifecycleAuthored } from '@artificer-toolkit/shared/authored'
import { compileEffect } from '@artificer-toolkit/shared/compilers'
import { antitoxinVial } from '@artificer-toolkit/source-data/srd/equipment/antitoxin-vial.js'

import { prepareEncounterActionEffectPlans } from '../encounterActionEffectPlans.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import { ACTION_EFFECT_ID, characterActionDescriptor } from './characterActionDescriptor.js'
import { testUuid } from './dnd5eSrdEncounter.js'

/**
 * The definition and lifecycle the real planner stores for the SRD Antitoxin's grant, lasting one
 * round and carrying `lifecycle`, applied by `sourceActorId` to `holderActorId`. Seed it as an active effect.
 */
export function plannedModifierGrant(input: {
  encounterId: string
  sourceActorId: string
  holderActorId: string
  lifecycle: PathLifecycleAuthored
  currentActorId?: string | null
}) {
  const [authored] = antitoxinVial.effects ?? []
  if (!authored) throw new Error('The SRD Antitoxin has no effect.')
  const grantPath = {
    ...authored,
    paths: authored.paths.flatMap((path) =>
      path.selectionKind === 'FIXED' &&
      path.resultBlock.outcomes.some((outcome) => outcome.effectKind === 'APPLY_GRANT')
        ? [
            {
              ...path,
              resultBlock: {
                ...path.resultBlock,
                duration: path.resultBlock.duration && {
                  ...path.resultBlock.duration,
                  durationKind: 'ROUND' as const,
                  amount: 1
                },
                lifecycle: { ...path.resultBlock.lifecycle, ...input.lifecycle }
              }
            }
          ]
        : []
    )
  }
  const action = characterActionDescriptor(compileEffect({ ...grantPath, id: ACTION_EFFECT_ID }))
  const published = dnd5eCharacterRuleActionSystemAdapter.compile({ action })
  const [activeEffectPlan] =
    dnd5eCharacterRuleActionSystemAdapter.activeEffectPlans?.({ action, published }) ?? []
  const execution = {
    status: 'COMPLETE',
    outputs: {},
    evidence: {
      source: {
        definitionId: ACTION_EFFECT_ID,
        gameSystemId: input.encounterId,
        definitionFamilyKey: 'rules-runtime-graph',
        checksum: 'd'.repeat(64)
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
    sourceLabel: antitoxinVial.label,
    sourceHidden: false,
    currentActorId: input.currentActorId ?? null,
    target: {
      actorId: input.holderActorId,
      conditionIds: [],
      effectiveSize: 'MEDIUM',
      lifetimeScope: 'ENCOUNTER',
      activeEffects: []
    },
    activeEffectsByActorId: new Map(),
    activeEffectPlan: activeEffectPlan ?? null,
    published,
    execution,
    d20: null,
    applications: []
  })
  if (!recurringEffect) throw new Error('No grant effect was planned.')
  return recurringEffect
}
