import { Button, Text, Title } from '@mantine/core'
import { Link } from '@tanstack/react-router'
import { Gamepad2, RotateCw } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTabletopDevice } from '#ui'
import * as styles from './CampaignTabletopDeviceGate.css'

export function CampaignTabletopDeviceGate({
  campaignRouteParams,
  children
}: {
  campaignRouteParams: { campaignPublicId: string; campaignSlug: string }
  children: ReactNode
}) {
  const device = useTabletopDevice()

  if (device === null) return null

  if (device === 'unsupported') {
    return (
      <main className={styles.notice}>
        <Gamepad2 aria-hidden size={28} />
        <Title order={1} size='h3'>
          The live tabletop needs a larger screen
        </Title>
        <Text c='dimmed' maw='34rem'>
          Open it on a large tablet or a computer. Everything else in Artificer Toolkit works on
          this device.
        </Text>
        <Button
          component={Link}
          params={campaignRouteParams}
          to='/campaigns/$campaignPublicId/$campaignSlug'
        >
          Back to the Campaign
        </Button>
      </main>
    )
  }

  return (
    <>
      <div inert={device === 'too-narrow'}>{children}</div>
      {device === 'too-narrow' ? (
        <section
          aria-labelledby='tabletop-too-narrow-title'
          aria-modal='true'
          className={styles.cover}
          role='dialog'
        >
          <RotateCw aria-hidden size={28} />
          <Title id='tabletop-too-narrow-title' order={1} size='h3'>
            Make the window wider
          </Title>
          <Text c='dimmed' maw='34rem'>
            Turn your tablet to landscape or widen this window. The tabletop comes back as soon as
            it fits.
          </Text>
        </section>
      ) : null}
    </>
  )
}
