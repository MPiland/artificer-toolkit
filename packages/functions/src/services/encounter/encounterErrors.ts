export class EncounterNotFoundError extends Error {
  constructor() {
    super('Encounter not found.')
    this.name = 'EncounterNotFoundError'
  }
}

export class EncounterConflictError extends Error {
  constructor(message = 'Encounter changed before this action completed.') {
    super(message)
    this.name = 'EncounterConflictError'
  }
}

export class EncounterValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EncounterValidationError'
  }
}
