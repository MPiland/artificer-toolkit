import type { LiveSessionPlacedSpatialEffect } from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import type { EffectAuthored, ManifestAuthored } from '@artificer-toolkit/shared/authored'
import { compileEffect } from '@artificer-toolkit/shared/compilers'
import type { SceneGrid, ScenePoint } from '@artificer-toolkit/shared/vtt'

import { normalizeCharacterActionMechanicFacts } from './character/characterActionRuleFacts.js'
import { CharacterRuleActionUnsupportedCompilationError } from './characterRuleActionSystemAdapter.js'
import { evaluateEncounterZoneTarget } from './encounterAreaAction.js'
import { bindEncounterEffect } from './encounterFeatureActionCapabilityDiscovery.js'
import { compilePassiveZone } from './encounterFeatureActionCapabilityDiscoveryRegistry.js'
import { planEncounterPlacedZone } from './encounterPlacedZone.js'
import { characterRuleActionSystemAdapterRegistry } from './platformEncounterPolicy.js'

/**
 * The Scene zone a GM places as an environmental trap (MOVE-3.2, ADR 0038): the authored zone,
 * compiled by the Run's System exactly as an item or spell that leaves it would be, fixed to the
 * Scene with its origin at `point`. It has no source creature, so it is a placed-space zone whose
 * saves use their authored fixed DC and whose rules follow no source; any other zone is refused as
 * unsupported.
 */
export function planEncounterEnvironmentalZone(input: {
  gameSystemId: string
  conditionDefinitionIds: readonly string[]
  abilityDefinitions: readonly { id: string; code: string }[]
  zone: ManifestAuthored
  point: ScenePoint
  grid: SceneGrid
  /** The placed zone's id. */
  id: string
  encounterId: string
  /** The GM command that places the zone; it is also the id of the Effect that leaves it. */
  rootCommandId: string
}): LiveSessionPlacedSpatialEffect {
  const { zone, rootCommandId: effectId } = input
  if (zone.manifestKind !== 'ZONE' || zone.attachmentKind !== 'PLACED_SPACE')
    throw new CharacterRuleActionUnsupportedCompilationError(
      'An environmental zone is a zone placed in the Scene.'
    )
  // The Effect an item leaving the zone authors, used anywhere in the Scene by no one.
  const effect: EffectAuthored = {
    id: effectId,
    order: 1,
    invocation: {
      kind: 'PASSIVE',
      triggerCode: 'ACTIVATED',
      range: { id: effectId, rangeKind: 'UNLIMITED' },
      targeting: { selectionKind: 'AREA_CONTENTS', dispositionKind: 'ANY' }
    },
    paths: [
      {
        id: zone.id,
        order: 1,
        pathCode: 'ON_USE',
        groupType: 'SINGLE',
        originKind: 'SOURCE',
        selectionKind: 'FIXED',
        resultBlock: { id: `${zone.id}__result`, resultKind: 'SINGLE', outcomes: [zone] }
      }
    ]
  }
  const compiledEffect = compileEffect(effect)
  const bound = bindEncounterEffect({
    gameSystemId: input.gameSystemId,
    compiledEffect,
    conditionDefinitionIds: input.conditionDefinitionIds,
    abilityDefinitions: input.abilityDefinitions
  })
  if (bound === null)
    throw new CharacterRuleActionUnsupportedCompilationError(
      'The Game System cannot run this zone.'
    )
  const compiled = compilePassiveZone(
    characterRuleActionSystemAdapterRegistry.require(input.gameSystemId),
    {
      kind: 'ENVIRONMENTAL_ZONE',
      gameSystemId: input.gameSystemId,
      authoredRootKind: 'effect',
      entryPointDefinitionId: effectId,
      effectId,
      actionId: effectId,
      sourceId: effectId,
      mechanicFacts: normalizeCharacterActionMechanicFacts(compiledEffect),
      conditionDefinitionIds: bound.conditionDefinitionIds ?? input.conditionDefinitionIds,
      savingThrowAbilityDefinitionId: bound.savingThrowAbilityDefinitionId ?? null,
      compiledEffect
    }
  )
  if (
    compiled.maintenance ||
    compiled.entry.castSaveDcFactKey ||
    compiled.sourceGrant ||
    compiled.retaliatesMeleeHits ||
    compiled.choosesUnaffected ||
    compiled.requiredSight ||
    (compiled.heldCondition?.escape && compiled.heldCondition.escape.dc.kind !== 'FIXED') ||
    compiled.camouflage?.spotDc.kind === 'SOURCE_SAVE_DC' ||
    compiled.turnTriggers?.includes('START_OF_SOURCE_TURN') ||
    compiled.occupantSaveBonus?.amount.kind === 'SOURCE_ABILITY_MODIFIER'
  )
    throw new CharacterRuleActionUnsupportedCompilationError(
      'An environmental zone has no creature behind it: its saves use a fixed DC, and nothing in it follows a source.'
    )
  const area = evaluateEncounterZoneTarget({
    zone: compiled,
    range: { id: effectId, rangeKind: 'UNLIMITED' },
    target: { kind: 'POINT', point: input.point },
    grid: input.grid,
    sourceToken: null,
    aimSeen: true
  })
  if ('refusal' in area || area.regions.length)
    throw new CharacterRuleActionUnsupportedCompilationError(
      'An environmental zone is a circle or a square placed at a point.'
    )
  return planEncounterPlacedZone({
    id: input.id,
    zone: compiled,
    maintainedEffectStateId: null,
    encounterId: input.encounterId,
    occurrenceId: effectId,
    rootCommandId: effectId,
    sourceActorId: null,
    point: input.point,
    area: area.shape,
    sourceToken: null,
    saveDc: null,
    ...(area.distanceStep ? { distanceStep: area.distanceStep } : {})
  })
}
