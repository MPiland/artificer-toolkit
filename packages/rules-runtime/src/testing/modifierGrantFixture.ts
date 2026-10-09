import type {
  ServerCompletedRuleExecutionDto,
  ServerPublishedRuleDefinitionDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import type { EffectAuthored, PathLifecycleAuthored } from '@artificer-toolkit/shared/authored'
import { compileEffect } from '@artificer-toolkit/shared/compilers'
import { antitoxinVial } from '@artificer-toolkit/source-data/srd/equipment/antitoxin-vial.js'
import { aid } from '@artificer-toolkit/source-data/srd/spells/aid.js'

import { prepareEncounterActionEffectPlans } from '../encounterActionEffectPlans.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import { ACTION_EFFECT_ID, characterActionDescriptor } from './characterActionDescriptor.js'
import { testUuid } from './dnd5eSrdEncounter.js'

/**
 * The published action graph as a grant plan reads it: its identity only, since a grant freezes its
 * own graph. Spells whose whole action the compiler does not take yet (Aid) still plan their grant.
 */
export function grantPublishedIdentity() {
  return { id: ACTION_EFFECT_ID, checksum: 'a'.repeat(64) } as ServerPublishedRuleDefinitionDto
}

/**
 * The SRD Aid as cast at 2nd level: its slot-scaled maximum hit point bonus resolved to +5 (casting
 * resolves it in SPELLS-8) and its heal dropped, leaving the grant.
 */
export function aidAtSecondLevel(): EffectAuthored {
  const [effect] = aid.effects ?? []
  if (!effect) throw new Error('The SRD Aid has no effect.')
  return {
    ...effect,
    paths: effect.paths.map((path) =>
      path.selectionKind === 'FIXED'
        ? {
            ...path,
            resultBlock: {
              ...path.resultBlock,
              outcomes: path.resultBlock.outcomes.flatMap((outcome) =>
                outcome.effectKind === 'APPLY_GRANT'
                  ? [
                      {
                        ...outcome,
                        grants: {
                          ...outcome.grants,
                          modifiers: outcome.grants.modifiers?.map((modifier) => ({
                            ...modifier,
                            payload: { valueKind: 'FIXED' as const, amount: 5 }
                          }))
                        }
                      }
                    ]
                  : []
              )
            }
          }
        : path
    )
  }
}

/**
 * The definition and lifecycle the real planner stores for an authored grant (the SRD Antitoxin's
 * unless `effect` says otherwise), lasting one round and carrying `lifecycle`, applied by
 * `sourceActorId` to `holderActorId`. Seed it as an active effect.
 */
export function plannedModifierGrant(input: {
  encounterId: string
  sourceActorId: string
  holderActorId: string
  lifecycle: PathLifecycleAuthored
  currentActorId?: string | null
  effect?: EffectAuthored
  sourceLabel?: string
}) {
  const authored = input.effect ?? antitoxinVial.effects?.[0]
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
  const published = grantPublishedIdentity()
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
    sourceLabel: input.sourceLabel ?? antitoxinVial.label,
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
