import { getVisibleCampaignConditions } from '@artificer-toolkit/rules-runtime/character/campaignConditionVisibility'
import type { CampaignCharacterState } from '@artificer-toolkit/schema/projections/campaignCharacterState'
import type { EncounterProjectionCharacterStates } from '@artificer-toolkit/schema/projections/encounterProjectionInput'
import {
  encounterRunActorStateSchema,
  type EncounterRunCharacterActorState,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { clampCharacterCurrentHitPoints } from '@artificer-toolkit/shared/character'
import type { CharacterPlayState } from '@artificer-toolkit/schema/projections/characterPlayState'
import { readCharacterMaximumHitPoints } from './characterMaximumHitPoints.js'
import { readEncounterCharacterPlay } from './characterPlay.js'
import { readRunActors, replaceRunActor } from './documents.js'
import type { EncounterPersistenceTransaction, EncounterProjectionTransaction } from './ports.js'
import type { EncounterDocument, EncounterWriteContext } from './store.js'

/**
 * Projects a Character's hit points over its effective maximum, as the Sheet shows them, and its
 * Sheet conditions with their System labels.
 */
export function characterProjectionState(
  { hitpoints, conditions = [] }: Pick<CharacterPlayState, 'hitpoints' | 'conditions'>,
  maximumHitPoints: number,
  conditionTypes: SystemAuthoredDto['conditionTypes']
) {
  return {
    current: clampCharacterCurrentHitPoints(hitpoints.current, maximumHitPoints),
    temporary: Math.max(hitpoints.temp ?? 0, 0),
    maximum: maximumHitPoints,
    conditions: conditions.map((condition) => {
      const definition = conditionTypes.find((entry) => entry.id === condition.conditionTypeId)
      return {
        conditionTypeId: condition.conditionTypeId,
        label: definition?.label ?? 'Unknown condition',
        ...(definition?.description ? { description: definition.description } : {}),
        ...(condition.notes ? { notes: condition.notes } : {})
      }
    })
  }
}

/**
 * Reads each Character actor's current hit points and conditions for a Run projection (ADR 0034
 * decision 4). A completed Run, and an open Run whose Character left the Campaign, show the values
 * frozen when the Run stopped reading it: a detached Character grants no current Sheet access.
 * `campaignConditions` layers the Campaign's own conditions, as the viewer may see them, over each
 * live Character's Sheet conditions.
 */
export async function readEncounterCharacterStates(
  ctx: EncounterProjectionTransaction,
  state: Pick<EncounterRunState, 'campaignId' | 'gameSystemId' | 'status'>,
  actors: readonly (
    | Pick<EncounterRunCharacterActorState, 'kind' | 'sourceId' | 'frozenState'>
    | { kind: 'CREATURE' | 'CUSTOM' }
  )[],
  campaignConditions?: {
    viewer: 'CAMPAIGN_OWNER' | 'CHARACTER_OWNER'
    read(characterId: string): Promise<CampaignCharacterState['conditions']>
  }
): Promise<EncounterProjectionCharacterStates> {
  const states = new Map<
    string,
    { current: number; temporary: number; maximum: number; conditions: unknown }
  >()
  let conditionTypes: SystemAuthoredDto['conditionTypes'] | null = null
  for (const actor of actors) {
    if (actor.kind !== 'CHARACTER') continue
    const characterId = actor.sourceId
    // A frozen actor stays frozen: reassigning its Character does not resume the Run reading it.
    if (actor.frozenState) {
      states.set(characterId, {
        current: actor.frozenState.currentHitPoints,
        temporary: actor.frozenState.tempHitPoints,
        maximum: actor.frozenState.maxHitPoints,
        conditions: actor.frozenState.conditions
      })
      continue
    }
    const assignment =
      state.status === 'COMPLETED'
        ? null
        : await ctx.db
            .query('campaignCharacterAssignments')
            .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
            .unique()
    if (assignment?.campaignId !== state.campaignId)
      throw new Error('Encounter Character state is unavailable.')
    const play = await readEncounterCharacterPlay(ctx, characterId)
    if (!play || play.userId !== assignment.userId)
      throw new Error('Stored Encounter Character source is unavailable.')
    conditionTypes ??= (await ctx.ports.requireSystem(state.gameSystemId)).conditionTypes
    states.set(
      characterId,
      await readCharacterPlayProjection(
        ctx,
        play,
        conditionTypes,
        campaignConditions
          ? getVisibleCampaignConditions({
              conditions: await campaignConditions.read(characterId),
              viewer: campaignConditions.viewer
            })
          : []
      )
    )
  }
  return states
}

/** A Character's current projected values, read from its play record alone. */
export async function readCharacterPlayProjection(
  ctx: EncounterProjectionTransaction,
  play: EncounterDocument<'characterPlayStates'>,
  conditionTypes: SystemAuthoredDto['conditionTypes'],
  campaignConditions: Array<{ conditionTypeId: string; notes?: string }> = []
) {
  const sheet = ctx.ports.readCharacterPlay(play)
  return characterProjectionState(
    { ...sheet, conditions: [...(sheet.conditions ?? []), ...campaignConditions] },
    await readCharacterMaximumHitPoints(ctx, play),
    conditionTypes
  )
}

/**
 * Freezes Character actors' current projected values into the actors, for an open Run that stops
 * reading those Characters: every Character when the Run completes, or `characterId` alone when it
 * leaves the Campaign. The Run version is unchanged: the projection shows the same values before
 * and after.
 */
export async function freezeEncounterCharacterStates(
  ctx: EncounterPersistenceTransaction,
  state: EncounterRunState,
  characterId?: string
): Promise<void> {
  const targets = (await readRunActors(ctx, state)).flatMap((actor) =>
    actor.kind === 'CHARACTER' && (characterId === undefined || actor.sourceId === characterId)
      ? [actor]
      : []
  )
  const current = await readEncounterCharacterStates(ctx, state, targets)
  for (const actor of targets)
    await freezeEncounterCharacterActor(ctx, actor, current.get(actor.sourceId)!)
}

/** Writes the Character actor's frozen values; an actor already holding them is left untouched. */
export async function freezeEncounterCharacterActor(
  ctx: EncounterWriteContext,
  actor: EncounterRunCharacterActorState,
  values: {
    current: number
    temporary: number
    maximum: number
    conditions: unknown
  }
): Promise<void> {
  const frozen = encounterRunActorStateSchema.parse({
    ...actor,
    frozenState: {
      currentHitPoints: values.current,
      maxHitPoints: values.maximum,
      tempHitPoints: values.temporary,
      conditions: values.conditions
    }
  })
  if (checksumCanonicalJson(frozen) !== checksumCanonicalJson(actor))
    await replaceRunActor(ctx, actor, frozen)
}
