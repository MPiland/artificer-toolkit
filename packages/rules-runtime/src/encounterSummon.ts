import { evaluateNumericExpr } from '@artificer-toolkit/shared/core'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import type { LiveSessionSummonedToken } from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import type { CompiledActionSummonPlacement } from '@artificer-toolkit/schema/projections/characterMechanics'
import {
  encounterRunActorStateSchema,
  type EncounterRunActorState
} from '@artificer-toolkit/schema/projections/encounterRunState'

/**
 * The creature a cast summons: a Run actor owned by the caster, built from the spell's stat block,
 * and the Scene token that stands at `point`. The summon fights on the caster's side and is
 * controlled through its owner, so its own controller list is empty. Hit points the stat block
 * leaves out, or ties to a caster maximum the cast does not carry, are 0.
 */
export function buildEncounterSummon(input: {
  summon: Pick<CompiledActionSummonPlacement, 'statBlock'>
  caster: EncounterRunActorState
  /** The caster's hit point maximum, when the Run holds it (a Character's lives on the Sheet). */
  casterHitPointMaximum: number | null
  /** The creature's name: the stat block's own, else the spell's. */
  label: string
  point: ScenePoint
  /** The edge of the square the creature fills, in Scene coordinates. */
  edgeLength: number
  occurredAt: string
}): LiveSessionSummonedToken {
  const { summon, caster, casterHitPointMaximum, label, point, edgeLength, occurredAt } = input
  const { hitPoints } = summon.statBlock
  const maxHitPoints =
    (hitPoints &&
      evaluateNumericExpr(hitPoints, { hitPointMaximum: casterHitPointMaximum ?? undefined })) ||
    0
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
    owner: { ownerActorId: caster.id },
    snapshot: { kind: 'CUSTOM', label, maxHitPoints, systemId: caster.systemId },
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
