import type { SystemResponseDto } from '@artificer-toolkit/schema/api/systems'

export function getAuthoringStatus(mode: string, isDraft: boolean) {
  if (mode === 'create') return { label: 'Draft' }
  if (isDraft) return { label: 'Draft' }
  return { label: 'Active' }
}

export function getRulesetLabel(
  system:
    | Pick<NonNullable<SystemResponseDto>, 'label' | 'rulesetCode' | 'rulesetVersion'>
    | null
    | undefined
): string | undefined {
  if (!system) return undefined

  const rulesetName = system.rulesetCode === 'dnd5e' ? 'D&D 5e' : system.label
  return rulesetName.includes(system.rulesetVersion)
    ? rulesetName
    : `${rulesetName} ${system.rulesetVersion}`
}
