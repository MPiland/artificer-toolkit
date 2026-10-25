import { Badge, Group, Text, Title } from '@mantine/core'
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import type { SocialListingDto } from '@artificer-toolkit/schema/api/socialHub'
import { formatEnumLabel } from '#components/AuthoredDetail'
import {
  buildSocialListingRouteParams,
  formatListingLocation,
  formatSocialSchedule
} from '../socialModels'
import * as styles from './SocialHubViews.css'

export function SocialListingRow({
  actions,
  listing,
  showHost = true
}: {
  actions?: ReactNode
  listing: SocialListingDto
  showHost?: boolean
}) {
  const params = buildSocialListingRouteParams(listing)

  return (
    <article className={styles.row}>
      <div className={styles.rowBody}>
        <Group gap='xs' wrap='wrap'>
          <Title order={2} size='h3'>
            {listing.status === 'OPEN' ? (
              <Link
                className={styles.clickableTitle}
                params={params}
                to='/social/listings/$listingPublicId/$slug'
              >
                {listing.title}
              </Link>
            ) : (
              listing.title
            )}
          </Title>
          <Badge color={listing.status === 'OPEN' ? 'green' : 'gray'} variant='light'>
            {formatEnumLabel(listing.status)}
          </Badge>
          <Badge variant='outline'>{listing.audience === 'PUBLIC' ? 'Public' : 'Private'}</Badge>
        </Group>
        <Text className={styles.prose} lineClamp={3}>
          {listing.summary}
        </Text>
        <div className={styles.metadata}>
          <Badge variant='light'>{listing.system.label}</Badge>
          <Badge variant='light'>{formatEnumLabel(listing.format)}</Badge>
          <Badge variant='light'>{formatEnumLabel(listing.contentMaturity)}</Badge>
          <Badge variant='light'>{formatListingLocation(listing)}</Badge>
          <Badge variant='light'>
            {listing.availableSeats} {listing.availableSeats === 1 ? 'seat' : 'seats'} open
          </Badge>
        </div>
        <Text c='dimmed' size='sm'>
          {formatSocialSchedule(listing.schedule)}
        </Text>
        {showHost ? (
          <Text size='sm'>
            Hosted by{' '}
            <Link
              params={{ profilePublicId: listing.host.profilePublicId }}
              to='/social/profiles/$profilePublicId'
            >
              @{listing.host.username}
            </Link>
          </Text>
        ) : null}
      </div>
      {actions ? <div className={styles.rowActions}>{actions}</div> : null}
    </article>
  )
}
