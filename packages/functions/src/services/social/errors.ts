export class SocialAccessError extends Error {
  constructor(message = 'You cannot perform this Social Hub action.') {
    super(message)
    this.name = 'SocialAccessError'
  }
}

export class SocialEligibilityError extends Error {
  constructor() {
    super('Accept the Social Hub eligibility statement before continuing.')
    this.name = 'SocialEligibilityError'
  }
}

export class SocialNotFoundError extends Error {
  constructor() {
    super('Social Hub item not found.')
    this.name = 'SocialNotFoundError'
  }
}

export class SocialConflictError extends Error {
  constructor(message = 'The Social Hub item changed before this action completed.') {
    super(message)
    this.name = 'SocialConflictError'
  }
}

export class SocialValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SocialValidationError'
  }
}

export class SocialRateLimitError extends Error {
  constructor() {
    super('Too many Social Hub actions. Try again later.')
    this.name = 'SocialRateLimitError'
  }
}
