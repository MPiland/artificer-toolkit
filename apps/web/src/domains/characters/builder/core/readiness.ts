import type { CharacterBuilderResolutionDto } from '@artificer-toolkit/schema/api/characters'
import type { CharacterFormValues } from './characterBuilder.types'

export function totalClassLevel(character: CharacterFormValues): number {
  return character.intent.classes.reduce((total, classRecord) => total + classRecord.classLevel, 0)
}

export function getReadinessMessages(resolution: CharacterBuilderResolutionDto): string[] {
  return [
    ...resolution.readiness.blockingIssues,
    ...resolution.readiness.outstandingRequiredChoices,
    ...resolution.validations.map((validation) => validation.message)
  ]
}
