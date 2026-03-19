import {
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_KIND,
  GRANT_KIND,
  PROFICIENCY_KIND,
  SCALING,
  SCALING_AMOUNT_KIND,
  SUBJECT,
  type BackgroundAuthored
} from '@artificer-toolkit/shared'
import { BACKGROUND_IDS } from '../ids.js'
import { SRD_SKILLS, SRD_SYSTEM_ID, SRD_USER_ID } from '../vocabulary.js'

function skillId(code: string): string {
  const entry = SRD_SKILLS.find((s) => s.code === code)
  if (!entry) throw new Error(`SRD skill vocabulary entry for ${code} required for background source data.`)
  return entry.id
}

function bgId(bgIndex: number, group: number, entry: number): string {
  const bb = bgIndex.toString(16).padStart(2, '0')
  const gg = group.toString(16).padStart(2, '0')
  const nn = entry.toString(16).padStart(2, '0')
  return `00000000-0000-0000-8040-${bb}${gg}${nn}0000000`
}

export const acolyte: BackgroundAuthored = {
  kind: SUBJECT.BACKGROUND,
  id: BACKGROUND_IDS.ACOLYTE,
  label: 'Acolyte',
  description: 'You have spent your life in the service of a temple to a specific god or pantheon of gods.',
  proficiencies: [
    {
      id: bgId(1, 1, 1),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.SKILL,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      skillIds: [skillId('INSIGHT'), skillId('RELIGION')],
      order: 0
    },
    {
      id: bgId(1, 1, 2),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.LANGUAGE,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
      scalingKind: SCALING.NONE,
      count: 2,
      authoringModeKind: AUTHORING_MODE_KIND.ALL,
      order: 1
    }
  ],
  features: [
    {
      id: bgId(1, 2, 1),
      label: 'Shelter of the Faithful',
      description: 'As an acolyte, you command the respect of those who share your faith and can perform the religious ceremonies of your deity.',
      detail: 'You and your companions can expect free healing and care at a temple, shrine, or other established presence of your faith.',
      order: 0
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
