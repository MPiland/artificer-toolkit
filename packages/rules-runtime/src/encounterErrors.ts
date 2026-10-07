export class EncounterValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EncounterValidationError'
  }
}

export class EncounterConflictError extends Error {
  constructor(message = 'Encounter changed before this action completed.') {
    super(message)
    this.name = 'EncounterConflictError'
  }
}

/** An issued movement reaction option no longer matches its source's current facts. */
export class StaleMovementReactionError extends EncounterConflictError {
  constructor(message: string) {
    super(message)
    this.name = 'StaleMovementReactionError'
  }
}
