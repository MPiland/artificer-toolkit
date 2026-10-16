import type {
  EncounterActorForm,
  EncounterRunActorState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { nextEncounterActorDefeated } from './encounterActorDefeat.js'

type FormableActor = Extract<EncounterRunActorState, { kind: 'CREATURE' | 'CUSTOM' }>

/** The Creature a form swaps in: its snapshot, source and full hit points. */
export type EncounterActorFormCreature = {
  sourceId: string
  sourceRevision: number
  snapshot: EncounterRunActorState['snapshot']
  maxHitPoints: number
}

/**
 * Swaps a Creature in for the actor (D130): the form's snapshot, source and hit points replace the
 * actor's, and the actor's own state becomes the form's origin. Conditions, concealment, absence and
 * the rest of the play state stay with the actor.
 */
export function enterActorForm(
  actor: FormableActor,
  input: Pick<EncounterActorForm, 'effectId' | 'excessDamageCarriesOver'> & {
    creature: EncounterActorFormCreature
  }
): FormableActor {
  if (actor.form !== null) throw new Error('The actor already has a form.')
  return {
    ...actor,
    sourceId: input.creature.sourceId,
    sourceRevision: input.creature.sourceRevision,
    snapshot: input.creature.snapshot,
    currentHitPoints: input.creature.maxHitPoints,
    maxHitPoints: input.creature.maxHitPoints,
    tempHitPoints: 0,
    defeated: false,
    form: {
      effectId: input.effectId,
      excessDamageCarriesOver: input.excessDamageCarriesOver,
      origin: {
        sourceId: actor.sourceId,
        sourceRevision: actor.sourceRevision,
        snapshot: actor.snapshot,
        currentHitPoints: actor.currentHitPoints,
        maxHitPoints: actor.maxHitPoints,
        tempHitPoints: actor.tempHitPoints
      }
    }
  }
}

/**
 * The one way a form ends (D130): the form dropping to 0 hit points, the effect running out, a
 * dismissal and a cast undo all restore the origin exactly as it was. Damage past the form's last
 * hit point (`excessDamage`) reduces the origin's temporary then current hit points only when the
 * form was authored to carry it over. An actor without a form is returned unchanged, so ending a
 * form twice is harmless.
 */
export function revertActorForm(actor: FormableActor, excessDamage = 0): FormableActor {
  const { form } = actor
  if (form === null) return actor
  const { origin } = form
  const carried = form.excessDamageCarriesOver ? excessDamage : 0
  const temporaryLost = Math.min(origin.tempHitPoints, carried)
  const currentHitPoints = Math.max(0, origin.currentHitPoints - (carried - temporaryLost))
  return {
    ...actor,
    sourceId: origin.sourceId,
    sourceRevision: origin.sourceRevision,
    snapshot: origin.snapshot,
    currentHitPoints,
    maxHitPoints: origin.maxHitPoints,
    tempHitPoints: origin.tempHitPoints - temporaryLost,
    defeated: nextEncounterActorDefeated(
      { currentHitPoints: origin.currentHitPoints, defeated: false },
      currentHitPoints
    ),
    form: null
  }
}
