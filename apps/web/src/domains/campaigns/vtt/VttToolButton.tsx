import { ActionIcon, Tooltip } from '@mantine/core'
import type { CampaignVttToolDefinition } from './CampaignVttStage.model'
import type { CampaignVttTool } from './vttSceneRenderer'

/** One tabletop tool in the stage's tool rail. */
export function VttToolButton({
  definition,
  onSelect,
  selected
}: {
  definition: CampaignVttToolDefinition
  onSelect: (tool: CampaignVttTool) => void
  selected: boolean
}) {
  const Icon = definition.icon
  return (
    <Tooltip label={definition.label} position='right'>
      <ActionIcon
        aria-label={definition.label}
        aria-pressed={selected}
        color={selected ? 'brand' : undefined}
        size='lg'
        variant={selected ? 'filled' : 'subtle'}
        onClick={() => onSelect(definition.value)}
      >
        <Icon aria-hidden size={19} />
      </ActionIcon>
    </Tooltip>
  )
}
