import { Button, Modal, Stack } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useQuery } from '@tanstack/react-query'
import { getCampaignClockRecoveryPrompts } from '#app/data/campaigns/queries'
import { CampaignClockRecoveryPromptCard } from './CampaignClockRecoveryPromptCard'
import { CLOCK_RECOVERY_BOUNDARY_LABELS } from './campaignClockRecovery'

/** GM-only: combat held the clock past a recovery boundary, so the GM decides each Character's refresh. */
export function CampaignClockRecoveryPrompts({ campaignId }: { campaignId: string }) {
  const { data: prompts = [] } = useQuery(getCampaignClockRecoveryPrompts(campaignId))
  const [opened, { close, open }] = useDisclosure(false)
  const [first] = prompts
  if (!first) return null
  const summary =
    prompts.length === 1
      ? CLOCK_RECOVERY_BOUNDARY_LABELS[first.boundaryKind].passed
      : `Time passed during combat for ${prompts.length} Characters`

  return (
    <>
      <Button color='yellow' size='compact-xs' variant='light' onClick={open}>
        {summary} · review charges
      </Button>
      <Modal centered opened={opened} title='Review charges after combat time' onClose={close}>
        <Stack gap='sm'>
          {prompts.map((prompt) => (
            <CampaignClockRecoveryPromptCard key={prompt.id} prompt={prompt} />
          ))}
        </Stack>
      </Modal>
    </>
  )
}
