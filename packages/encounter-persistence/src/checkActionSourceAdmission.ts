import type { LiveSessionEncounterBasicActionCommitInput } from '@artificer-toolkit/schema/api/liveSessionEncounterBasicAction'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { ReusableDefinitionCurrentDto } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import type { CheckActionSourceDto } from '@artificer-toolkit/schema/shared/ruleExecutionCheckAction'
import { resolveEncounterActionSource } from '@artificer-toolkit/rules-runtime/encounterActionSources'
import {
  isEncounterBasicActionId,
  readEncounterBasicActionEffect
} from '@artificer-toolkit/rules-runtime/encounterBasicActionCapabilityDiscovery'
import { requireEncounterBasicActionDefinition } from '@artificer-toolkit/rules-runtime/encounterBasicActions'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { readEncounterSpellPins } from './spellPins.js'
import type { EncounterWriteTransaction } from './ports.js'

/**
 * Re-resolves what made the room's check action from current authoritative sources (D173): the
 * System's published basic action entry, or the Creature feature on the acting creature's snapshot.
 * A Creature feature's charge receipt must spend exactly the feature's authored cost, or the charges
 * that remained under an acknowledged "Do it anyway". Returns the source as the check records it, the
 * action's label and its authored check.
 */
export async function admitCheckActionSource(
  ctx: EncounterWriteTransaction,
  input: {
    state: EncounterRunState
    actor: EncounterRunActorState
    commit: LiveSessionEncounterBasicActionCommitInput
    readDefinition(id: string, userId: string): Promise<ReusableDefinitionCurrentDto | null>
  }
) {
  const { state, actor, commit } = input
  const { source, command } = commit
  if (source.kind === 'BASIC_ACTION') {
    // The System's catalogue is its platform-published entries (user-authored Systems are deferred).
    const entry = requireEncounterBasicActionDefinition(
      state,
      await input.readDefinition(source.definition.id, commit.expectedUserId)
    )
    const { definition } = entry
    const effect = readEncounterBasicActionEffect(entry, command.actionId)
    if (
      effect?.invocation.triggerCode !== 'CHECK' ||
      !isEncounterBasicActionId(actor.id, command.actionId) ||
      definition.version !== source.definition.version ||
      definition.checksum !== source.definition.checksum ||
      commit.featureResourceConsumption !== null
    )
      throw new Error('Live Session basic action scope mismatch.')
    return {
      source: {
        kind: 'BASIC_ACTION',
        definition: {
          id: definition.id,
          version: definition.version,
          checksum: definition.checksum
        }
      } satisfies CheckActionSourceDto,
      label: definition.label,
      check: effect.invocation.check
    }
  }
  if (actor.kind !== 'CREATURE') throw new Error('Live Session check action source mismatch.')
  const resolved = resolveEncounterActionSource({
    actor,
    actionId: command.actionId,
    gameSystemId: state.gameSystemId,
    system: await ctx.ports.requireSystem(state.gameSystemId),
    spells: await readEncounterSpellPins(ctx, state.id)
  })
  if (resolved.kind !== 'CREATURE') throw new Error('Live Session check action source mismatch.')
  const { capability } = resolved
  const { invocation } = capability.compiledEffect
  const admitted = {
    kind: 'CREATURE_FEATURE',
    ownerFeatureId: capability.ownerFeatureId,
    effectId: capability.effectId,
    compiledEffectChecksum: capability.compiledEffectChecksum
  } satisfies CheckActionSourceDto
  if (
    invocation.triggerCode !== 'CHECK' ||
    invocation.check.dc.kind !== 'FIXED' ||
    checksumCanonicalJson(admitted) !== checksumCanonicalJson(source)
  )
    throw new Error('Live Session check action source mismatch.')
  const use = capability.featureResourceUse
  const receipt = commit.featureResourceConsumption
  const shortOfCharges = commit.ruleOverrides.some(({ code }) => code === 'RESOURCE_UNAVAILABLE')
  if (
    receipt
      ? !use ||
        receipt.ownerActorId !== actor.id ||
        receipt.ownerFeatureId !== capability.ownerFeatureId ||
        receipt.chargeId !== use.chargeId ||
        receipt.cost > use.cost ||
        (receipt.cost < use.cost && !shortOfCharges)
      : use !== null && !shortOfCharges
  )
    throw new Error('Live Session feature resource receipt mismatch.')
  return { source: admitted, label: capability.label, check: invocation.check }
}
