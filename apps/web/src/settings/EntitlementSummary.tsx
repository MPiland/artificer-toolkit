import { Badge, Group, Table, Text, Title } from '@mantine/core'
import type { EntitlementProjectionDto } from '@artificer-toolkit/schema/api/campaignCore'
import * as styles from './settings.css'

const tierLabels = {
  FREE: 'Free',
  PLAYER: 'Player',
  GM: 'GM',
  PRO_GM: 'Pro GM'
} as const

export function EntitlementSummary({ entitlements }: { entitlements: EntitlementProjectionDto }) {
  const { limits, pricing, tier, usage } = entitlements
  const rows = [
    ['Personal Characters', usage.personalCharacters, limits.personalCharacters],
    ['Owned homebrew roots', usage.homebrewRoots, limits.homebrewRoots],
    ['Storage', formatBytes(usage.storageBytes), formatLimit(limits.storageBytes, formatBytes)],
    ['Active hosted Campaigns', usage.activeHostedCampaigns, limits.activeHostedCampaigns],
    ['Public listings', usage.publicListings, limits.publicListings],
    ['Saved Encounters', usage.savedEncounters, limits.savedEncounters]
  ]

  return (
    <section className={styles.accountSection} aria-labelledby='plan-settings-title'>
      <Group justify='space-between' align='flex-start'>
        <div className={styles.settingCopy}>
          <Title order={3} className={styles.settingTitle} id='plan-settings-title'>
            Plan
          </Title>
          <Text className={styles.settingDescription}>
            Current limits used by Characters, homebrew, storage, and Campaign hosting.
          </Text>
        </div>
        <Badge size='lg'>{tierLabels[tier]}</Badge>
      </Group>
      <Text>
        {pricing.monthlyPriceCents === 0 ? '$0' : formatUsd(pricing.monthlyPriceCents) + '/month'} ·{' '}
        {pricing.annualPriceCents === 0 ? '$0/year' : formatUsd(pricing.annualPriceCents) + '/year'}
      </Text>
      <Table.ScrollContainer minWidth={520}>
        <Table striped withRowBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Capability</Table.Th>
              <Table.Th>Usage</Table.Th>
              <Table.Th>Limit</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map(([label, used, limit]) => (
              <Table.Tr key={String(label)}>
                <Table.Th scope='row'>{label}</Table.Th>
                <Table.Td>{used}</Table.Td>
                <Table.Td>{formatLimit(limit)}</Table.Td>
              </Table.Tr>
            ))}
            <Table.Tr>
              <Table.Th scope='row'>Player seats per Campaign</Table.Th>
              <Table.Td>—</Table.Td>
              <Table.Td>{limits.playerSeatsPerCampaign}</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Th scope='row'>Campaign entries per Campaign</Table.Th>
              <Table.Td>—</Table.Td>
              <Table.Td>{formatLimit(limits.campaignEntriesPerCampaign)}</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Th scope='row'>Scenes per Campaign</Table.Th>
              <Table.Td>—</Table.Td>
              <Table.Td>{formatLimit(limits.scenesPerCampaign)}</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Th scope='row'>Paid tables</Table.Th>
              <Table.Td>—</Table.Td>
              <Table.Td>{limits.paidTablesEnabled ? 'Enabled' : 'Not included'}</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Th scope='row'>Platform fee</Table.Th>
              <Table.Td>—</Table.Td>
              <Table.Td>
                {limits.paidTablesEnabled
                  ? `${limits.platformFeeBasisPoints / 100}%`
                  : 'Not applicable'}
              </Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      {limits.paidTablesEnabled ? (
        <Text c='dimmed' size='xs'>
          Payment-processing costs still apply.
        </Text>
      ) : null}
    </section>
  )
}

function formatUsd(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 ** 3) return `${trimNumber(bytes / 1024 ** 3)} GB`
  return `${trimNumber(bytes / 1024 ** 2)} MB`
}

function trimNumber(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1)
}

function formatLimit(value: string | number | null, formatter?: (value: number) => string) {
  if (value === null) return 'Unlimited'
  return typeof value === 'number' && formatter ? formatter(value) : value
}
