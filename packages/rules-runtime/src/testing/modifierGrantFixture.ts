import type {
  ServerCompletedRuleExecutionDto,
  ServerPublishedRuleDefinitionDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import type {
  EffectAuthored,
  ModifierGrantAuthored,
  PathLifecycleAuthored
} from '@artificer-toolkit/shared/authored'
import { compileEffect } from '@artificer-toolkit/shared/compilers'
import {
  SRD_BASIC_ACTION_DEFINITIONS,
  SRD_BASIC_ACTION_IDS
} from '@artificer-toolkit/source-data/srd/basicActions.js'
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
 * `effect` with each of its granted modifiers' `domain` or `payload` replaced (a copy; the authored effect is
 * untouched), for a test that varies a real spell's grant, such as a floor's amount or ability.
 */
export function withGrantModifiers(
  effect: EffectAuthored | undefined,
  changes: Partial<Pick<ModifierGrantAuthored, 'domain' | 'payload'>>
): EffectAuthored {
  if (!effect) throw new Error('The effect to vary is missing.')
  const copy = structuredClone(effect)
  for (const path of copy.paths)
    if (path.selectionKind === 'FIXED')
      for (const outcome of path.resultBlock.outcomes)
        if (outcome.effectKind === 'APPLY_GRANT' && outcome.grants.modifiers)
          for (const modifier of outcome.grants.modifiers) Object.assign(modifier, changes)
  return copy
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
                          modifiers: outcome.grants.modifiers?.map((modifier) =>
                            modifier.valueDomainCode === 'HIT_POINTS_MAX'
                              ? { ...modifier, payload: { valueKind: 'FIXED' as const, amount: 5 } }
                              : modifier
                          )
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
 * A grant of Dexterity-save advantage that holds only while the holder sees the effect's source,
 * authored from core options as Danger Sense's is: the SRD Dodge grant with its attack-defence
 * modifiers dropped and the save modifier flagged `requiresHolderSeesSource`.
 */
export function sourceSightSaveAuthoredEffect(): EffectAuthored {
  const effect = SRD_BASIC_ACTION_DEFINITIONS.find(({ id }) => id === SRD_BASIC_ACTION_IDS.DODGE)
    ?.document.effects[0]
  if (!effect) throw new Error('The SRD Dodge has no effect.')
  return {
    ...effect,
    paths: effect.paths.map((path) =>
      path.selectionKind === 'FIXED'
        ? {
            ...path,
            resultBlock: {
              ...path.resultBlock,
              outcomes: path.resultBlock.outcomes.map((outcome) =>
                outcome.effectKind === 'APPLY_GRANT'
                  ? {
                      ...outcome,
                      grants: {
                        ...outcome.grants,
                        modifiers: outcome.grants.modifiers?.flatMap((modifier) =>
                          modifier.valueDomainCode === 'SAVING_THROW_MODIFIER' &&
                          modifier.modifierKind === 'ROLL_INFLUENCE' &&
                          modifier.payload.influence === 'ADVANTAGE'
                            ? [
                                {
                                  ...modifier,
                                  domain: { ...modifier.domain, requiresHolderSeesSource: true }
                                }
                              ]
                            : []
                        )
                      }
                    }
                  : outcome
              )
            }
          }
        : path
    )
  }
}

/**
 * The definition and lifecycle the real planner stores for an authored grant (the SRD Antitoxin's
 * unless `effect` says otherwise), lasting `rounds` (one by default) and carrying `lifecycle`, applied by
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
  sourceHidden?: boolean
  rounds?: number
  /** The holder's lifetime scope: a Character's grant outlasts the Encounter (`OWNER`). */
  lifetimeScope?: 'OWNER' | 'ENCOUNTER'
  /**
   * Set for a grant authored on a result path (an attack's on-hit rider, a failed save's grant): the
   * d20's resolved path.
   */
  resultPath?: 'ON_HIT' | 'ON_CRIT' | 'ON_SAVE_FAIL'
  /** The slot level a spell's grant was cast at, for a grant that scales by it (Branding Smite). */
  spellCastLevel?: number
  /** Keeps the effect's own authored id, for a grant another feature binds to (`HOLDER_ACTIVE_EFFECT`). */
  keepAuthoredEffectId?: boolean
}) {
  const authored = input.effect ?? antitoxinVial.effects?.[0]
  if (!authored) throw new Error('The SRD Antitoxin has no effect.')
  const effectId = input.keepAuthoredEffectId ? authored.id : ACTION_EFFECT_ID
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
                  amount: input.rounds ?? 1
                },
                lifecycle: { ...path.resultBlock.lifecycle, ...input.lifecycle }
              }
            }
          ]
        : []
    )
  }
  const action = {
    ...characterActionDescriptor(
      compileEffect({ ...grantPath, id: effectId }),
      input.spellCastLevel
    ),
    effectId
  }
  const published = { ...grantPublishedIdentity(), id: effectId }
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
    sourceHidden: input.sourceHidden ?? false,
    currentActorId: input.currentActorId ?? null,
    target: {
      actorId: input.holderActorId,
      conditionIds: [],
      effectiveSize: 'MEDIUM',
      lifetimeScope: input.lifetimeScope ?? 'ENCOUNTER',
      activeEffects: []
    },
    activeEffectsByActorId: new Map(),
    activeEffectPlan: activeEffectPlan ?? null,
    published,
    execution,
    d20: input.resultPath
      ? {
          requestId: testUuid(0xc312),
          rollMode: 'NORMAL',
          keep: 'FIRST',
          derivedRollMode: 'NORMAL',
          rawFaces: [15],
          selectedNatural: 15,
          contributors: [],
          contributorChecksum: 'c'.repeat(64),
          modifier: 0,
          total: 15,
          defenseOrDc: 10,
          resultPath: input.resultPath
        }
      : null,
    applications: [],
    spellCastLevel: input.spellCastLevel
  })
  if (!recurringEffect) throw new Error('No grant effect was planned.')
  return recurringEffect
}
