import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import type { LiveSessionSummonedToken } from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import type { CompiledActionSummonPlacement } from '@artificer-toolkit/schema/projections/characterMechanics'
import {
  encounterRunActorStateSchema,
  type EncounterRunActorState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { summonBody } from './encounterActorBody.js'
import { summonHitPoints } from './summonHitPoints.js'

/**
 * The creature a cast summons: a Run actor owned by the caster, built from the spell's stat block,
 * and the Scene token that stands at `point`. The summon fights on the caster's side and is
 * controlled through its owner, so its own controller list is empty. Its snapshot keeps the stat
 * block's body rules (`encounterActorBody`).
 */
export function buildEncounterSummon(input: {
  summon: Pick<CompiledActionSummonPlacement, 'statBlock'>
  caster: EncounterRunActorState
  /** The caster's effective hit point maximum: a Character's from its Sheet, others' from the Run. */
  casterHitPointMaximum: number
  /** The creature's name: the stat block's own, else the spell's. */
  label: string
  /** The carrier effect on the caster whose end removes the summon. */
  sourceEffectId: string
  point: ScenePoint
  /** The edge of the square the creature fills, in Scene coordinates. */
  edgeLength: number
  occurredAt: string
}): LiveSessionSummonedToken {
  const {
    summon,
    caster,
    casterHitPointMaximum,
    label,
    sourceEffectId,
    point,
    edgeLength,
    occurredAt
  } = input
  const maxHitPoints = summonHitPoints(summon.statBlock, casterHitPointMaximum)
  const actor = encounterRunActorStateSchema.parse({
    id: crypto.randomUUID(),
    encounterId: caster.encounterId,
    sideId: caster.sideId,
    kind: 'CUSTOM',
    sourceId: null,
    sourceRevision: null,
    label,
    systemId: caster.systemId,
    stableTieKey: crypto.randomUUID(),
    public: caster.public,
    controllerUserIds: [],
    disposition: caster.disposition,
    healthDisplay: null,
    currentHitPoints: maxHitPoints,
    maxHitPoints,
    tempHitPoints: 0,
    conditions: [],
    defeated: false,
    form: null,
    absence: null,
    resources: {},
    gmNotes: null,
    initiative: null,
    manualOrder: null,
    owner: { ownerActorId: caster.id, sourceEffectId },
    snapshot: {
      kind: 'CUSTOM',
      label,
      maxHitPoints,
      systemId: caster.systemId,
      body: summonBody(summon.statBlock)
    },
    createdAt: occurredAt,
    updatedAt: occurredAt
  })
  return {
    actor,
    token: {
      assetId: null,
      controlledByUserIds: [...caster.controllerUserIds],
      height: edgeLength,
      hidden: false,
      id: crypto.randomUUID(),
      label,
      locked: false,
      position: point,
      rotationDegrees: 0,
      senses: [],
      vision: null,
      width: edgeLength
    }
  }
}
