import type { CharacterSheetActionsDto } from '@artificer-toolkit/schema/api/characterSheetSlices'
import { formatEnumLabel } from '#components/AuthoredDetail'
import {
  summarizeCharacterSheetMechanics,
  type CharacterSheetMechanic
} from '../shared/characterSheetMechanics.utils'

type SheetAction = CharacterSheetActionsDto['actions']['items'][number]
type SheetResource = CharacterSheetActionsDto['resources']['items'][number]

export type CharacterSheetPlayableAction = {
  id: string
  label: string
  kind: 'ACTION' | 'BONUS_ACTION' | 'REACTION' | 'ATTACK' | 'OTHER'
  sourceLabel?: string
  mechanics?: CharacterSheetMechanic[]
  playFacts?: {
    activation?: string
    range?: string
    hitOrDc?: string
    effect?: string
  }
  target?: CharacterSheetActionsDto['spells']['activeGroups'][number]['entries'][number]['target']
  description?: string
  resource?: {
    cost: number
    id: string
    max: number
    remaining: number
    used: number
  }
  limitedUseOnly?: boolean
  availability: SheetAction['availability']
}

export const CHARACTER_SHEET_ACTION_FILTERS = [
  { id: 'ALL', label: 'All' },
  { id: 'ATTACK', label: 'Attack' },
  { id: 'ACTION', label: 'Action' },
  { id: 'BONUS_ACTION', label: 'Bonus Action' },
  { id: 'REACTION', label: 'Reaction' },
  { id: 'OTHER', label: 'Other' },
  { id: 'LIMITED_USE', label: 'Limited Use' }
] as const

export type CharacterSheetActionFilter = (typeof CHARACTER_SHEET_ACTION_FILTERS)[number]['id']

export function getPlayableActions(
  sheet: CharacterSheetActionsDto
): CharacterSheetPlayableAction[] {
  const resourcesById = new Map(
    sheet.resources.items.map((resource) => [resource.id, resource] as const)
  )
  const explicitActions = sheet.actions.items.map((action) =>
    toPlayableSheetAction(
      action,
      action.resourceGrantId ? resourcesById.get(action.resourceGrantId) : undefined
    )
  )
  const spellActions: CharacterSheetPlayableAction[] = sheet.spells.activeGroups.flatMap((group) =>
    group.entries.flatMap((entry) => {
      const spell = sheet.spells.spells.find((candidate) => candidate.id === entry.spellId)
      const source = spell?.sources?.find(
        (candidate) =>
          candidate.source.spellId === entry.source.spellId &&
          candidate.source.sourceKind === entry.source.sourceKind &&
          candidate.source.sourceInstanceId === entry.source.sourceInstanceId
      )
      const displayLevel =
        source?.castMode === 'FIXED_LEVEL' && source.fixedLevel !== undefined
          ? source.fixedLevel
          : spell?.level
      if (!spell || !source?.displayAsAttack || entry.castLevel !== displayLevel) return []

      return [
        {
          id: `spell:${entry.rowId}`,
          label: entry.displayName,
          kind: 'ATTACK' as const,
          sourceLabel: entry.sourceLabel ?? source.label ?? entry.sourceQualifier,
          mechanics: entry.mechanics,
          playFacts: {
            activation: entry.activationLabel,
            range: entry.rangeLabel,
            hitOrDc: entry.hitOrDcLabel,
            effect: entry.primaryEffect
          },
          target: entry.target,
          availability: { status: 'AVAILABLE' }
        }
      ]
    })
  )
  const linkedResourceIds = new Set(
    [...explicitActions, ...spellActions].flatMap((action) =>
      action.resource ? [action.resource.id] : []
    )
  )
  const resourceActions = sheet.resources.items
    .filter((resource) => !linkedResourceIds.has(resource.id))
    .map(toResourceAction)

  return [...explicitActions, ...spellActions, ...resourceActions]
}

export function formatPlayableActionSummary(
  action: CharacterSheetPlayableAction
): string | undefined {
  if (action.kind === 'ATTACK') {
    return action.playFacts?.effect ?? summarizePlayableActionMechanic(action.mechanics)
  }

  return action.description ?? summarizePlayableActionMechanic(action.mechanics)
}

function summarizePlayableActionMechanic(
  mechanics: CharacterSheetPlayableAction['mechanics']
): string | undefined {
  const items = mechanics ?? []
  const summaries = summarizeCharacterSheetMechanics(items)
  const mechanicIndex = Math.max(
    items.findIndex((mechanic) => mechanic.outcomes.some((outcome) => outcome.kind === 'DAMAGE')),
    0
  )
  const mechanic = items[mechanicIndex]
  const mechanicSummary = summaries[mechanicIndex]
  if (!mechanic || !mechanicSummary) return undefined

  const outcomeIndex = Math.max(
    mechanic.outcomes.findIndex((outcome) => outcome.kind === 'DAMAGE'),
    0
  )
  const summary = [mechanicSummary.facts, mechanicSummary.outcomes[outcomeIndex]]
    .filter(Boolean)
    .join(' · ')

  return summary || undefined
}

function toPlayableSheetAction(
  action: SheetAction,
  resource: SheetResource | undefined
): CharacterSheetPlayableAction {
  const mechanic = action.mechanic
  return {
    id: action.id,
    label: action.label,
    kind: action.mechanic?.attackBonus == null ? action.kind : 'ATTACK',
    sourceLabel: action.sourceLabel,
    mechanics: mechanic ? [mechanic] : undefined,
    playFacts: mechanic ? toPlayableActionFacts(mechanic) : undefined,
    description: action.description ? toPlainText(action.description) : undefined,
    resource: toPlayableResource(resource, action.resourceCost),
    availability: action.availability
  }
}

function toPlayableActionFacts(
  mechanic: CharacterSheetMechanic
): CharacterSheetPlayableAction['playFacts'] {
  const damage = mechanic.outcomes.find((outcome) => outcome.kind === 'DAMAGE')
  const condition = mechanic.outcomes.find((outcome) => outcome.kind === 'CONDITION')
  const effect = mechanic.outcomes.find((outcome) => outcome.kind === 'EFFECT' && outcome.label)
  const activation = mechanic.activation
    ? `${mechanic.activation.amount === 1 ? '' : `${mechanic.activation.amount} `}${formatEnumLabel(mechanic.activation.kind)}`
    : undefined
  const hitOrDc =
    mechanic.attackBonus == null
      ? mechanic.save?.dc == null
        ? undefined
        : `${mechanic.save.ability.slice(0, 3)} ${mechanic.save.dc}`
      : `${mechanic.attackBonus >= 0 ? '+' : ''}${mechanic.attackBonus}`

  return {
    activation,
    range: mechanic.rangeLabel,
    hitOrDc,
    effect:
      damage?.kind === 'DAMAGE'
        ? `${damage.expression} ${damage.damageTypeLabel}`
        : condition?.kind === 'CONDITION'
          ? condition.label
          : effect?.kind === 'EFFECT'
            ? effect.label
            : undefined
  }
}

function toResourceAction(resource: SheetResource): CharacterSheetPlayableAction {
  return {
    id: `resource:${resource.id}`,
    label: resource.label,
    kind: 'OTHER',
    sourceLabel: resource.sourceLabel,
    resource: toPlayableResource(resource),
    description: resource.description ? toPlainText(resource.description) : undefined,
    limitedUseOnly: true,
    availability: { status: 'AVAILABLE' }
  }
}

export function formatActionUnavailableReason(
  reasonCode: Extract<SheetAction['availability'], { status: 'UNAVAILABLE' }>['reasonCode']
): string {
  switch (reasonCode) {
    case 'SOURCE_NOT_EQUIPPED':
      return 'Equip this item to use this action.'
    case 'SOURCE_NOT_ATTUNED':
      return 'Attune to this item to use this action.'
    case 'SOURCE_REQUIREMENTS_NOT_MET':
      return 'This action’s requirements are not currently met.'
    case 'RESOURCE_MISSING':
      return 'The required resource is unavailable.'
    case 'INSUFFICIENT_RESOURCE':
      return 'Not enough uses remain.'
  }
}

function toPlayableResource(
  resource: SheetResource | undefined,
  cost = 1
): CharacterSheetPlayableAction['resource'] {
  return resource
    ? {
        cost,
        id: resource.id,
        max: resource.max,
        remaining: resource.remaining,
        used: resource.used
      }
    : undefined
}

function toPlainText(value: string): string {
  const withoutScriptOrStyle = value.replace(
    /<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>/giu,
    ' '
  )
  const withoutTags = withoutScriptOrStyle.replace(/<[^>]*>/gu, ' ')

  return decodeHtmlEntities(withoutTags.replace(/\s+/gu, ' ').trim())
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/giu, ' ')
    .replace(/&amp;/giu, '&')
    .replace(/&lt;/giu, '<')
    .replace(/&gt;/giu, '>')
    .replace(/&quot;/giu, '"')
    .replace(/&apos;/giu, "'")
    .replace(/&#x([0-9a-f]+);/giu, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
    .replace(/&#([0-9]+);/giu, (_, code) => String.fromCharCode(Number.parseInt(code, 10)))
}
