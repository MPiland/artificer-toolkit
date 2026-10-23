import { Badge, Group, Switch, Text } from '@mantine/core'
import { Gamepad2 } from 'lucide-react'
import { useEffect } from 'react'
import { useCampaignDetail } from '#app/data/campaigns/queries'
import { useAutoRollDicePreference } from '#app/settings/useAutoRollDicePreference'
import { CampaignGmRoller } from '../components/CampaignGmRoller'
import { CampaignTabletopFullscreenButton } from './CampaignTabletopFullscreenButton'
import { CampaignSceneShowingControl } from './CampaignSceneShowingControl'
import { CampaignShownSceneViewer } from './CampaignShownSceneViewer'
import { CampaignVttStage } from './CampaignVttStage'
import * as styles from './CampaignTabletopWindow.css'

export function CampaignTabletopWindow({
  campaignId,
  currentUserId
}: {
  campaignId: string
  currentUserId: string
}) {
  const campaign = useCampaignDetail(campaignId)
  const autoRoll = useAutoRollDicePreference()

  useEffect(() => {
    const previousTitle = document.title
    document.title = `Tabletop · ${campaign.name}`
    return () => {
      document.title = previousTitle
    }
  }, [campaign.name])

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Group gap='sm' wrap='nowrap'>
          <Gamepad2 aria-hidden size={21} />
          <div className={styles.identity}>
            <Text fw={650} lineClamp={1}>
              {campaign.name}
            </Text>
          </div>
          <Badge size='sm' variant='light'>
            {campaign.role === 'OWNER' ? 'GM' : 'Player'}
          </Badge>
        </Group>
        <Group gap='md' wrap='nowrap'>
          {campaign.role === 'OWNER' ? (
            <CampaignSceneShowingControl campaignId={campaign.id} />
          ) : null}
          <CampaignTabletopFullscreenButton />
          <Switch
            aria-label='Roll my dice automatically'
            checked={autoRoll.autoRollDice}
            disabled={autoRoll.disabled}
            error={
              autoRoll.loadFailed || autoRoll.updateError ? 'Auto-roll is unavailable.' : undefined
            }
            label='Auto-roll'
            size='xs'
            onChange={(event) => autoRoll.setAutoRollDice(event.currentTarget.checked)}
          />
          <Text c='dimmed' size='xs'>
            {campaign.role === 'OWNER' ? 'Live editing available' : 'Play view'}
          </Text>
        </Group>
      </header>
      <div className={styles.stage}>
        <CampaignVttStage campaign={campaign} currentUserId={currentUserId} />
      </div>
      {campaign.role === 'OWNER' ? (
        <CampaignGmRoller campaignId={campaign.id} rollModes={campaign.rollModes} />
      ) : (
        <CampaignShownSceneViewer campaignId={campaign.id} currentUserId={currentUserId} />
      )}
    </main>
  )
}
