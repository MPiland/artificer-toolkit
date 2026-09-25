import type { AutomationModeDto } from '@artificer-toolkit/schema/api/campaignSettings'

/**
 * How a rules step obtains dice: the server rolls for a roller who auto-rolls, a prompt waits for a
 * roller who enters or rolls their own dice, and Manual Encounters resolve no mechanics.
 */
export type EncounterEvidenceMode = 'AUTO_ROLL' | 'PROMPT' | 'MANUAL'

export function encounterEvidenceMode(
  automationMode: AutomationModeDto,
  autoRoll: boolean
): EncounterEvidenceMode {
  return automationMode === 'MANUAL' ? 'MANUAL' : autoRoll ? 'AUTO_ROLL' : 'PROMPT'
}

/**
 * Each actor's roller preference during one command: a roll goes to the controllers of the actor
 * it belongs to, and an actor whose roller auto-rolls is never prompted (ADR 0034 decision 3). An
 * actor missing from the map prompts.
 */
export type EncounterAutoRollByActorId = Readonly<Record<string, boolean>>
