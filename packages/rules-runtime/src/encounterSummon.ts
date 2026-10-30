import type { SpellSummonStatBlockValues } from '@artificer-toolkit/shared/authored'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import type { LiveSessionSummonedToken } from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import type { SummonStatBlockDto } from '@artificer-toolkit/schema/effects/manifest'
import {
  encounterRunActorStateSchema,
  type EncounterRunActorState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { creatureSnapshotSize } from './encounterActionEffects.js'
import { summonBody } from './encounterActorBody.js'
import type { EncounterActorFormCreature } from './encounterActorForm.js'
import { snapshotStatBlock } from './encounterProjection.js'
import type { FormSummonStats } from './spellSummonStatBlock.js'
import { summonHitPoints } from './summonHitPoints.js'

/**
 * The stat values a form summon lists, read from the System Creature the caster chose. It lives on
 * the Encounter side so the Sheet-reachable `resolveSpellSummonStatBlock` imports no Encounter module.
 */
export function formSummonStats(
  creature: Pick<EncounterActorFormCreature, 'systemId' | 'snapshot'>
): FormSummonStats {
  const stats = snapshotStatBlock({ kind: 'CREATURE', ...creature })
  const size = creatureSnapshotSize(creature)
  const { snapshot } = creature
  const payload =
    typeof snapshot === 'object' && snapshot !== null && 'payload' in snapshot
      ? snapshot.payload
      : null
  const passivePerception =
    typeof payload === 'object' && payload !== null && 'passivePerception' in payload
      ? payload.passivePerception
      : null
  return {
    ...(size ? { size } : {}),
    armorClass: stats?.armorClass ?? null,
    ...(stats?.abilityScores ? { abilityScores: stats.abilityScores } : {}),
    ...(stats?.speeds.length ? { speeds: stats.speeds } : {}),
    ...(typeof passivePerception === 'number' ? { passivePerception } : {})
  }
}

/**
 * The creature a cast summons: a Run actor owned by the caster, built from the spell's stat block or
 * from the System Creature of the form the caster chose, and the Scene token that stands at `point`.
 * The summon fights on the caster's side and is controlled through its owner, so its own controller
 * list is empty. A stat block summon's snapshot keeps its body rules (`encounterActorBody`); a form
 * summon is that Creature, of the Creature Type the caster chose when the spell offers one, and
 * keeps body rules only when its summon says it cannot attack. Either keeps the values a spell cast
 * resolved, which the owner's Sheet lists it by (`ownedEncounterSpellSummons`).
 */
export function buildEncounterSummon(input: {
  summon:
    | { kind: 'STAT_BLOCK'; statBlock: SummonStatBlockDto }
    | { kind: 'CREATURE'; creature: EncounterActorFormCreature; creatureTypeId: string | null }
  /**
   * The values a spell cast resolved for the creature (`resolveSpellSummonStatBlock`); null when no
   * spell made it, and no Sheet lists it.
   */
  spellSummon: SpellSummonStatBlockValues | null
  /** The summon says its creature makes no attack of its own. */
  cannotAttack?: boolean
  /** When the creature acts, if apart from its owner's turn (D200). */
  turnTiming?: NonNullable<EncounterRunActorState['owner']>['turnTiming']
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
    spellSummon,
    cannotAttack,
    turnTiming,
    caster,
    casterHitPointMaximum,
    label,
    sourceEffectId,
    point,
    edgeLength,
    occurredAt
  } = input
  const body =
    summon.kind === 'STAT_BLOCK'
      ? statBlockSummonBody({
          statBlock: summon.statBlock,
          maxHitPoints: summonHitPoints(summon.statBlock, casterHitPointMaximum),
          systemId: caster.systemId,
          label
        })
      : creatureSummonBody(summon.creature, summon.creatureTypeId)
  const { maxHitPoints } = body
  const statBlock = summon.kind === 'STAT_BLOCK' ? summon.statBlock : { occupiesSpace: true }
  const actor = encounterRunActorStateSchema.parse({
    id: crypto.randomUUID(),
    encounterId: caster.encounterId,
    sideId: caster.sideId,
    kind: body.kind,
    sourceId: body.sourceId,
    sourceRevision: body.sourceRevision,
    label,
    systemId: body.systemId,
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
    owner: { ownerActorId: caster.id, sourceEffectId, ...(turnTiming ? { turnTiming } : {}) },
    snapshot: {
      ...body.snapshot,
      ...(cannotAttack ? { body: summonBody(statBlock, true) } : {}),
      ...(spellSummon ? { summon: spellSummon } : {})
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

function statBlockSummonBody(input: {
  statBlock: SummonStatBlockDto
  maxHitPoints: number
  systemId: string | null
  label: string
}) {
  const { statBlock, maxHitPoints, systemId, label } = input
  return {
    kind: 'CUSTOM' as const,
    sourceId: null,
    sourceRevision: null,
    systemId,
    maxHitPoints,
    snapshot: { kind: 'CUSTOM', label, maxHitPoints, systemId, body: summonBody(statBlock) }
  }
}

/** The chosen Creature as it stands, but of the Creature Type the caster chose, when one was. */
function creatureSummonBody(creature: EncounterActorFormCreature, creatureTypeId: string | null) {
  const snapshot = creature.snapshot as { payload: Record<string, unknown> }
  return {
    kind: 'CREATURE' as const,
    sourceId: creature.sourceId,
    sourceRevision: creature.sourceRevision,
    systemId: creature.systemId,
    maxHitPoints: creature.maxHitPoints,
    snapshot:
      creatureTypeId === null
        ? snapshot
        : { ...snapshot, payload: { ...snapshot.payload, creatureTypeId } }
  }
}
