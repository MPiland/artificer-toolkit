import { Button, Group, Text } from '@mantine/core'
import { ExternalLink, Gamepad2 } from 'lucide-react'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import {
  buildTabletopHref,
  openAuxiliaryWindow,
  tabletopWindowName
} from './CampaignTabletopWindow.model'
import * as styles from '../campaignSessions.css'

export function CampaignTabletopLauncher({ campaign }: { campaign: CampaignDetailDto }) {
  const href = buildTabletopHref(campaign.publicId)

  return (
    <section className={styles.sessionUtilityPanel} aria-labelledby='session-tabletop-title'>
      <Group align='center' justify='space-between' wrap='wrap'>
        <div>
          <Group gap='xs'>
            <Gamepad2 aria-hidden size={20} />
            <Text fw={650} id='session-tabletop-title'>
              Live tabletop
            </Text>
          </Group>
          <Text c='dimmed' size='sm'>
            Open the Campaign's live table in its own window so this workspace stays available.
          </Text>
        </div>
        <Button
          component='a'
          href={href}
          leftSection={<ExternalLink aria-hidden size={16} />}
          rel='noopener noreferrer'
          target='_blank'
          onClick={(event) => openAuxiliaryWindow(event, tabletopWindowName(campaign.publicId))}
        >
          Open tabletop window
        </Button>
      </Group>
    </section>
  )
}
