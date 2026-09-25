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
