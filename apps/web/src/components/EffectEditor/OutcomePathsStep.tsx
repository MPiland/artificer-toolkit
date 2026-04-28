import { ActionIcon, Button, Group, Stack, Text, Tooltip } from '@mantine/core'
import type { PathDto } from '@artificer-toolkit/schema'
import { IExternalLink } from '#assets/icons/IExternalLink'
import ITrash from '#assets/icons/ITrash'
import { destructiveActionIcon, outcomeList, pathStatus, pathSummaryRow } from './EffectEditor.css'
import { EffectCollapse } from './EffectCollapse'
import { createDefaultPath, getPathOutcomes, pathCodeOptions } from './effectEditor.utils'

export function OutcomePathsStep({
  paths,
  readOnly,
  onOpen,
  onChange
}: {
  paths: PathDto[]
  readOnly?: boolean
  onOpen: (pathIndex: number) => void
  onChange: (paths: PathDto[]) => void
}) {
  return (
    <EffectCollapse title='Outcome Paths' id='outcome-paths-list-heading'>
      <div className={outcomeList}>
        {paths.map((path, index) => (
          <div key={path.id} className={pathSummaryRow}>
            <Stack gap={2}>
              <Text fw={600}>{pathCodeOptions.find((option) => option.value === path.pathCode)?.label ?? path.pathCode}</Text>
              <Text c='dimmed' size='sm'>{describePath(path)}</Text>
            </Stack>
            <Text className={pathStatus}>{describePathStatus(path)}</Text>
            <Group gap='xs' justify='flex-end'>
              <Tooltip label='Open path'>
                <ActionIcon aria-label={`Open ${pathCodeOptions.find((option) => option.value === path.pathCode)?.label ?? path.pathCode}`} variant='subtle' onClick={() => onOpen(index)}>
                  <IExternalLink size={18} />
                </ActionIcon>
              </Tooltip>
              {!readOnly && paths.length > 1
                ? (
                    <Tooltip label='Remove path'>
                      <ActionIcon
                        aria-label={`Remove ${pathCodeOptions.find((option) => option.value === path.pathCode)?.label ?? path.pathCode}`}
                        className={destructiveActionIcon}
                        variant='subtle'
                        onClick={() => onChange(paths.filter((item) => item.id !== path.id))}
                      >
                        <ITrash size={18} />
                      </ActionIcon>
                    </Tooltip>
                  )
                : null}
            </Group>
          </div>
        ))}
      </div>
      {!readOnly
        ? (
            <Button
              variant='default'
              onClick={() => onChange([...paths, createDefaultPath(paths.length + 1, getNextPathCode(paths))])}
            >
              + Add path
            </Button>
          )
        : null}
    </EffectCollapse>
  )
}

function describePath(path: PathDto) {
  if (path.selectionKind === 'ROLL_TABLE') return 'Randomized outcomes using roll ranges.'
  if (path.selectionKind === 'CHOICE') return 'Choose from available outcomes at play time.'
  const outcomes = getPathOutcomes(path).length
  return outcomes > 0
    ? `Apply ${outcomes} direct outcome${outcomes === 1 ? '' : 's'}.`
    : 'Apply direct results when this path resolves.'
}

function describePathStatus(path: PathDto) {
  const resolution = path.selectionKind === 'ROLL_TABLE'
    ? 'Roll table'
    : path.selectionKind === 'CHOICE'
      ? 'Choice'
      : 'Direct'
  const outcomes = getPathOutcomes(path)
  const firstOutcome = outcomes[0]?.effectKind
  return firstOutcome ? `${resolution}, ${String(firstOutcome).toLowerCase()}` : `${resolution}, no outcomes`
}

function getNextPathCode(paths: PathDto[]) {
  const existingCodes = new Set(paths.map((path) => path.pathCode))
  const nextOption = pathCodeOptions.find((option) => !existingCodes.has(option.value))

  return nextOption?.value ?? 'ON_USE'
}
