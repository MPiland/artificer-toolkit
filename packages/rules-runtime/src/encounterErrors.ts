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

/** An issued movement reaction option no longer matches its source's current facts. */
export class StaleMovementReactionError extends EncounterConflictError {
  constructor(message: string) {
    super(message)
    this.name = 'StaleMovementReactionError'
  }
}
