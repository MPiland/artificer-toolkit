import type { RulesSystem } from './contracts/rulesSystem.js'
import { dnd5e2014RulesSystem } from './dnd5e2014/index.js'

export interface RulesSystemIdentity {
  code: string
  version: string
}

export class UnsupportedRulesSystemError extends Error {
  constructor(identity: RulesSystemIdentity) {
    super(`Unsupported rules system "${identity.code}" version "${identity.version}".`)
    this.name = 'UnsupportedRulesSystemError'
  }
}

export function resolveRulesSystem(identity: RulesSystemIdentity): RulesSystem {
  if (
    identity.code === dnd5e2014RulesSystem.identity.code &&
    identity.version === dnd5e2014RulesSystem.identity.version
  ) {
    return dnd5e2014RulesSystem
  }

  throw new UnsupportedRulesSystemError(identity)
}
