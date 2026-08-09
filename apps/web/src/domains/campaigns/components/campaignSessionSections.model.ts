import type { CampaignSessionNoteSectionDto } from '#app/lib/api'

export type CampaignSessionSectionKind = CampaignSessionNoteSectionDto['kind']

export const prepareSessionSectionKinds: readonly CampaignSessionSectionKind[] = [
  'AGENDA',
  'SCENE',
  'SECRET',
  'REWARD',
  'SCRATCHPAD'
]

export const runSessionSectionKinds: readonly CampaignSessionSectionKind[] = [
  'AGENDA',
  'SCENE',
  'SECRET',
  'REWARD',
  'SCRATCHPAD'
]

export const closeoutSessionSectionKinds: readonly CampaignSessionSectionKind[] = [
  'RECAP',
  'ENDING_STATE',
  'CANON',
  'RULING',
  'REWARD',
  'FOLLOW_UP'
]

export function campaignSessionSectionLabel(kind: CampaignSessionSectionKind): string {
  if (kind === 'AGENDA') return 'Agenda'
  if (kind === 'SCENE') return 'Scenes & beats'
  if (kind === 'SECRET') return 'Secrets & clues'
  if (kind === 'REWARD') return 'Rewards & milestones'
  if (kind === 'SCRATCHPAD') return 'Scratchpad'
  if (kind === 'RECAP') return 'Recap'
  if (kind === 'ENDING_STATE') return 'Ending state'
  if (kind === 'CANON') return 'Canon established'
  if (kind === 'RULING') return 'Rulings'
  if (kind === 'FOLLOW_UP') return 'Follow-ups'
  return 'Shared notes'
}

export function campaignSessionSectionDescription(kind: CampaignSessionSectionKind): string {
  if (kind === 'AGENDA') return 'The table’s intended flow and priorities.'
  if (kind === 'SCENE') return 'Scenes, reveals, and beats you may call on.'
  if (kind === 'SECRET') return 'Clues and information that remain GM-only.'
  if (kind === 'REWARD') return 'Treasure, milestones, or other planned outcomes.'
  if (kind === 'SCRATCHPAD') return 'Fast private capture while preparing or running.'
  if (kind === 'RECAP') return 'A concise record of what happened.'
  if (kind === 'ENDING_STATE') return 'Where the party, world, and active threats ended.'
  if (kind === 'CANON') return 'Facts established at the table.'
  if (kind === 'RULING') return 'Table rulings worth carrying forward.'
  if (kind === 'FOLLOW_UP') return 'Open threads and preparation for next time.'
  return 'Notes shared with the active party.'
}
