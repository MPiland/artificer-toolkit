import type { ConsequenceRollTriggerDto } from '@artificer-toolkit/schema/shared/consequenceRolls'

/** A met consequence trigger in the GM's words. */
export function consequenceRollTriggerText(trigger: ConsequenceRollTriggerDto): string {
  switch (trigger.event) {
    case 'DAMAGED':
      return trigger.critical ? 'took a critical hit' : 'took damage'
    case 'HIT_POINTS_ZERO':
      return 'dropped to 0 hit points'
    case 'DEATH_SAVE_FAILED':
      return `failed a death save by ${trigger.byAtLeast} or more`
  }
}
