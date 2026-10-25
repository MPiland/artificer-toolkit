import { Alert, Badge, Button, Group, Loader, Text, Title } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { convexQuery } from '@convex-dev/react-query'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { SocialApplicationDialog } from './components/SocialApplicationDialog'
import { SocialDetailField } from './components/SocialDetailField'
import { SocialReportDialog } from './components/SocialReportDialog'
import { formatEnumLabel } from '#components/AuthoredDetail'
import { formatListingLocation, formatSocialSchedule, safetyPracticeOptions } from './socialModels'
import * as styles from './SocialListingDetailPage.css'

export function SocialListingDetailPage({ listingPublicId }: { listingPublicId: string }) {
  const navigate = useNavigate()
  const listing = useQuery(
    convexQuery(convexApi.social.discovery.getListing, {
      listingPublicId: listingPublicId.toLowerCase()
    })
  )
  const eligibility = useQuery(convexQuery(convexApi.social.profiles.getEligibility, {}))

  if (listing.isPending) return <Loader aria-label='Loading listing' size='sm' />
  if (listing.isError) {
    return <Alert color='red'>This listing is unavailable.</Alert>
  }

  const data = listing.data
  const isHost = eligibility.data?.profilePublicId === data.host.profilePublicId
  return (
    <article className={styles.page} aria-labelledby='social-listing-title'>
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <Group gap='xs' wrap='wrap'>
            <Title id='social-listing-title' order={1}>
              {data.title}
            </Title>
            <Badge variant='light'>{formatEnumLabel(data.format)}</Badge>
            <Badge variant='light'>{formatEnumLabel(data.contentMaturity)}</Badge>
            <Badge variant='light'>{formatListingLocation(data)}</Badge>
          </Group>
          <Text className={styles.prose}>{data.summary}</Text>
        </div>
        {eligibility.data?.eligible && !isHost ? (
          <Group gap='xs'>
            <SocialApplicationDialog listing={data} />
            <SocialReportDialog
              target={{ targetKind: 'LISTING', targetPublicId: data.listingPublicId }}
            />
          </Group>
        ) : null}
      </header>

      <div className={styles.detailGrid}>
        <div className={styles.panel}>
          <Title order={2}>What to expect</Title>
          <SocialDetailField
            label='Tone'
            value={[data.toneTags.map(formatEnumLabel).join(', '), data.toneDetails]
              .filter(Boolean)
              .join(' — ')}
          />
          <SocialDetailField label='Content guidance' value={data.expectations.contentGuidance} />
          <SocialDetailField label='Attendance policy' value={data.expectations.attendancePolicy} />
          <SocialDetailField
            label='Allowed content and rules'
            value={data.expectations.allowedContentRules}
          />
          <SocialDetailField label='Table conduct' value={data.expectations.tableConduct} />
          <SocialDetailField
            label='Content boundaries'
            value={data.expectations.contentBoundaries}
          />
          <SocialDetailField
            label='How safety practices are used'
            value={data.expectations.safetyDetails}
          />
        </div>
        <aside className={styles.panel} aria-label='Table details'>
          <Title order={2} size='h3'>
            Table details
          </Title>
          <Text>
            <strong>System:</strong> {data.system.label}
          </Text>
          <Text>
            <strong>Ruleset:</strong> {data.system.rulesetCode} {data.system.rulesetVersion}
          </Text>
          <Text>
            <strong>Schedule:</strong> {formatSocialSchedule(data.schedule)}
          </Text>
          <Text>
            <strong>Timezone:</strong> {data.schedule.timeZone}
          </Text>
          <Text>
            <strong>Location:</strong> {formatListingLocation(data)}
          </Text>
          <Text>
            <strong>Age:</strong> 13+
          </Text>
          <Text>
            <strong>Price:</strong> Free
          </Text>
          <Text>
            <strong>Seats:</strong> {data.availableSeats} of {data.capacity} available
          </Text>
          <div>
            <Text fw={600}>Safety practices</Text>
            <div className={styles.metadata}>
              {data.expectations.safetyPractices.map((practice) => (
                <Badge key={practice} variant='light'>
                  {safetyPracticeOptions.find((option) => option.value === practice)?.label ??
                    practice}
                </Badge>
              ))}
            </div>
          </div>
          <Text>
            Hosted by{' '}
            <Link
              params={{ profilePublicId: data.host.profilePublicId }}
              to='/social/profiles/$profilePublicId'
            >
              @{data.host.username}
            </Link>
          </Text>
          <Button
            variant='default'
            onClick={() => navigate({ to: '/social', search: { view: 'discover' } })}
          >
            Back to discovery
          </Button>
        </aside>
      </div>
    </article>
  )
}
