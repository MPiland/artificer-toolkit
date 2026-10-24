import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { ActiveRuleEffectLifecycleDto } from '@artificer-toolkit/schema/shared/activeRuleEffectLifecycle'
import type {
  EncounterActorForm,
  EncounterRunActorState,
  EncounterRunCharacterActorState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { jsonValueSchema, type JsonValue } from '@artificer-toolkit/schema/projections/identity'
import { nextEncounterActorDefeated } from './encounterActorDefeat.js'
import { abilityScoreCapabilityRegistry } from './platformPolicyModules.js'

function jsonRecord(value: unknown): Record<string, JsonValue> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error('The creature form snapshot is malformed.')
  return value as Record<string, JsonValue>
}

/**
 * The Creature's snapshot with the origin's retained ability scores (`scores` by ability definition
 * id) in place of its own, in both the stat block (by code) and the rule facts (by definition id).
 * What a form keeps is authored on the form effect (Wild Shape keeps the mental scores, Polymorph
 * none).
 */
function withRetainedAbilities(
  input: FormInput,
  originScores: () => Readonly<Record<string, JsonValue>>
): EncounterRunActorState['snapshot'] {
  const { creature, retainedAbilityIds } = input
  if (retainedAbilityIds.length === 0) return creature.snapshot
  const abilities = abilityScoreCapabilityRegistry.require(creature.systemId)
  const scores = originScores()
  const root = jsonRecord(creature.snapshot)
  const payload = jsonRecord(root.payload)
  const ruleFacts = jsonRecord(root.ruleFacts)
  const byCode = { ...jsonRecord(payload.abilityScores) }
  const byId = { ...jsonRecord(ruleFacts.abilityScores) }
  for (const id of retainedAbilityIds) {
    const score = scores[id]
    if (typeof score !== 'number') throw new Error('A retained ability score is unavailable.')
    byCode[abilities.abilityCode(id)] = score
    byId[id] = score
  }
  return {
    ...root,
    payload: { ...payload, abilityScores: byCode },
    ruleFacts: { ...ruleFacts, abilityScores: byId }
  }
}

type FormableActor = Extract<EncounterRunActorState, { kind: 'CREATURE' | 'CUSTOM' }>
type FormInput = Pick<EncounterActorForm, 'effectId' | 'excessDamageCarriesOver'> & {
  creature: EncounterActorFormCreature
  /** The origin's ability scores the form keeps, by ability definition id. */
  retainedAbilityIds: readonly string[]
}

/** The Creature a form swaps in: its Game System, snapshot, source and full hit points. */
export type EncounterActorFormCreature = {
  systemId: string
  sourceId: string
  sourceRevision: number
  snapshot: EncounterRunActorState['snapshot']
  maxHitPoints: number
}

/**
 * Swaps a Creature in for the actor (D130): the form's snapshot, source and hit points replace the
 * actor's, and the actor's own state becomes the form's origin. The form keeps the actor's retained
 * ability scores from its own stat block. Conditions, concealment, absence and the rest of the play
 * state stay with the actor.
 */
export function enterActorForm(actor: FormableActor, input: FormInput): FormableActor {
  if (actor.form !== null) throw new Error('The actor already has a form.')
  // The origin keeps its amount but not its source: a form origin's pool belongs to no effect.
  const { tempHitPointsSourceEffectId: _originSource, ...own } = actor
  return {
    ...own,
    sourceId: input.creature.sourceId,
    sourceRevision: input.creature.sourceRevision,
    snapshot: withRetainedAbilities(input, () =>
      jsonRecord(jsonRecord(jsonRecord(actor.snapshot).ruleFacts).abilityScores)
    ),
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
 * Gives a Character actor the Creature's form (D130 amendment): the form's snapshot and full hit
 * points become the actor's own while the Character's Sheet state stays untouched. The Character
 * keeps the form's retained ability scores (`scalarValues` by ability definition id), baked into the
 * snapshot so the form presents and rolls with them; whether it keeps its own proficiencies is
 * authored on the effect (`formRetainsProficiencies`).
 */
export function enterCharacterForm(
  actor: EncounterRunCharacterActorState,
  input: FormInput,
  scalarValues: Readonly<Record<string, number>>
): EncounterRunCharacterActorState {
  if (actor.form !== null) throw new Error('The actor already has a form.')
  const { creature } = input
  return {
    ...actor,
    form: {
      effectId: input.effectId,
      excessDamageCarriesOver: input.excessDamageCarriesOver,
      sourceId: creature.sourceId,
      sourceRevision: creature.sourceRevision,
      snapshot: withRetainedAbilities(input, () => scalarValues),
      currentHitPoints: creature.maxHitPoints,
      maxHitPoints: creature.maxHitPoints,
      tempHitPoints: 0
    }
  }
}

type CharacterActorForm = NonNullable<EncounterRunCharacterActorState['form']>

/** The creature form a Character's effect holds (D130), or null when the effect holds none. */
export function creatureFormContribution(effect: Pick<ActiveRuleEffectRecord, 'definition'>) {
  const { definition } = effect
  for (const contribution of definition.stateContributions)
    if (contribution.kind === 'CREATURE_FORM') return contribution
  return null
}

/**
 * Whether a Character keeps its own proficiencies in its form, as the effect holding the form
 * authored (D191): Wild Shape and Shapechange do, Polymorph rolls with the form's stat block.
 */
export function formRetainsProficiencies(
  form: Pick<CharacterActorForm, 'effectId'>,
  effects: readonly Pick<ActiveRuleEffectRecord, 'id' | 'definition'>[]
): boolean {
  const effect = effects.find(({ id }) => id === form.effectId)
  const contribution = effect ? creatureFormContribution(effect) : null
  if (!contribution) throw new Error('The effect holding the creature form is unavailable.')
  return contribution.retainsProficiencies
}

/**
 * The form a Character takes out of its Run on the effect that holds it (D99, SPELLS-28.T4b): the
 * Creature and hit points the next Run's actor resumes.
 */
export function carriedCreatureForm(
  form: CharacterActorForm
): NonNullable<ActiveRuleEffectLifecycleDto['carriedCreatureForm']> {
  const { sourceId, sourceRevision, snapshot, currentHitPoints, maxHitPoints, tempHitPoints } = form
  return {
    sourceId,
    sourceRevision,
    snapshotJson: JSON.stringify(snapshot),
    currentHitPoints,
    maxHitPoints,
    tempHitPoints
  }
}

/**
 * The Creature a Character in a form acts as (SPELLS-28.T4d): the form's snapshot and hit points,
 * the Character's identity. Its action list is the form stat block's, found by the Creature action
 * discovery; null while the Character wears no form.
 */
export function characterFormCreatureView(
  actor: EncounterRunCharacterActorState
): FormableActor | null {
  const { form } = actor
  if (form === null) return null
  return {
    ...actor,
    kind: 'CREATURE',
    sourceId: form.sourceId,
    sourceRevision: form.sourceRevision,
    snapshot: form.snapshot,
    currentHitPoints: form.currentHitPoints,
    maxHitPoints: form.maxHitPoints,
    tempHitPoints: form.tempHitPoints,
    conditions: [],
    defeated: false,
    form: null
  }
}

/** A new Run's Character actor resumes the form its carried effect holds, with the hit points it kept. */
export function resumeCharacterForm(
  actor: EncounterRunCharacterActorState,
  effects: readonly ActiveRuleEffectRecord[]
): EncounterRunCharacterActorState {
  for (const effect of effects) {
    const { carriedCreatureForm: carried } = effect.lifecycle
    const contribution = creatureFormContribution(effect)
    if (carried && contribution)
      return {
        ...actor,
        form: {
          effectId: effect.id,
          excessDamageCarriesOver: contribution.excessDamageCarriesOver,
          sourceId: carried.sourceId,
          sourceRevision: carried.sourceRevision,
          snapshot: jsonValueSchema.parse(JSON.parse(carried.snapshotJson)),
          currentHitPoints: carried.currentHitPoints,
          maxHitPoints: carried.maxHitPoints,
          tempHitPoints: carried.tempHitPoints
        }
      }
  }
  return actor
}

/**
 * The one way a form ends (D130): the form dropping to 0 hit points, the effect running out, a
 * dismissal and a cast undo all restore the origin exactly as it was. Damage past the form's last
 * hit point (`excessDamage`) reduces the origin's temporary then current hit points only when the
 * form was authored to carry it over. An actor without a form is returned unchanged, so ending a
 * form twice is harmless.
 */
export function revertActorForm(
  actor: EncounterRunCharacterActorState
): EncounterRunCharacterActorState
export function revertActorForm(actor: FormableActor, excessDamage?: number): FormableActor
export function revertActorForm(
  actor: EncounterRunActorState,
  excessDamage?: number
): EncounterRunActorState
export function revertActorForm(
  actor: EncounterRunActorState,
  excessDamage = 0
): EncounterRunActorState {
  // A Character's Sheet was never touched, so leaving the form restores nothing; the batch plan
  // carries the excess onto the Sheet.
  if (actor.kind === 'CHARACTER') return { ...actor, form: null }
  const { form } = actor
  if (form === null) return actor
  const { origin } = form
  const carried = form.excessDamageCarriesOver ? excessDamage : 0
  const temporaryLost = Math.min(origin.tempHitPoints, carried)
  const currentHitPoints = Math.max(0, origin.currentHitPoints - (carried - temporaryLost))
  const { tempHitPointsSourceEffectId: _formSource, ...own } = actor
  return {
    ...own,
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
