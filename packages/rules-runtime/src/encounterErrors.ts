export class EncounterValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EncounterValidationError'
  }
}

/** The actor holds a spellcasting lock, so it may not hold Concentration (D113). */
export class SpellcastingLockedError extends EncounterValidationError {
  constructor() {
    super("You can't hold Concentration right now.")
    this.name = 'SpellcastingLockedError'
  }
}

/** The holder is at its Concentration capacity with several held; the caster must choose which one ends. */
export class MaintainedReplacementRequiredError extends EncounterValidationError {
  constructor(
    readonly definitionId: string,
    readonly heldStateIds: readonly string[]
  ) {
    super('Choose which Concentration ends before this spell takes effect.')
    this.name = 'MaintainedReplacementRequiredError'
  }
}

export class EncounterConflictError extends Error {
  constructor(message = 'Encounter changed before this action completed.') {
    super(message)
    this.name = 'EncounterConflictError'
  }
}

/** A Character action request no longer matches the Character's current facts, such as a used-up item. */
export class StaleCharacterActionError extends EncounterConflictError {
  constructor(message = 'The committed Character action resource is unavailable or stale.') {
    super(message)
    this.name = 'StaleCharacterActionError'
  }
}

/** A cast names no option, or one its action does not offer, of a pick made at cast (D148). */
export class CastChoiceUnavailableError extends Error {
  constructor() {
    super('Pick one of the options this action offers.')
    this.name = 'CastChoiceUnavailableError'
  }
}

/** An ammunition attack names no ammunition when several fit, or one that does not fit its weapon. */
export class AmmunitionChoiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AmmunitionChoiceError'
  }
}

/** A Creature action whose authored mechanics cannot run was chosen; discovery lists it unavailable with the reason. */
export class UnavailableCreatureActionError extends Error {
  constructor(label: string, reason: string) {
    super(`${label} is unavailable: ${reason}`)
    this.name = 'UnavailableCreatureActionError'
  }
}

/** An attack's weapon needs a hand that only the creatures its actor holds occupy (D107, D152). */
export class HandReleaseRequiredError extends Error {
  constructor() {
    super('Release a held creature first: your hands are full.')
    this.name = 'HandReleaseRequiredError'
  }
}

/** An issued movement reaction option no longer matches its source's current facts. */
export class StaleMovementReactionError extends EncounterConflictError {
  constructor(message: string) {
    super(message)
    this.name = 'StaleMovementReactionError'
  }
}
