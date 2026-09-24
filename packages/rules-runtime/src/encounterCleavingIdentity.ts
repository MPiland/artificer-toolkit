import { v5 as uuidv5 } from 'uuid'

const NAMESPACE = 'f14e5297-ff30-5b22-9182-6cb2d5e3f5ed'

export function cleavingChildOccurrenceIdentity(parentOccurrenceId: string, chainStep: number) {
  return uuidv5(`${parentOccurrenceId}:${chainStep}:optional-combat-cleaving`, NAMESPACE)
}

export function cleavingChildCommandIdentity(occurrenceId: string) {
  return uuidv5(`${occurrenceId}:command`, NAMESPACE)
}
