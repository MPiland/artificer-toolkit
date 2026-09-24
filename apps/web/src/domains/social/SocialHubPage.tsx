import { Button, Text, Title } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { SocialApplicationsView } from './components/SocialApplicationsView'
import { SocialDiscoveryView } from './components/SocialDiscoveryView'
import { SocialHostingView } from './components/SocialHostingView'
import { SocialHubNavigation } from './components/SocialHubNavigation'
import { SocialInvitationsView } from './components/SocialInvitationsView'
import type { SocialHubSearch } from './socialSearch'
import * as styles from './SocialHubPage.css'

export function SocialHubPage({
  search,
  onSearchChange
}: {
  search: SocialHubSearch
  onSearchChange: (next: SocialHubSearch) => void
}) {
  const navigate = useNavigate()
  const entitlements = useQuery(convexQuery(convexApi.accountEntitlements.get, {}))
  const canCreatePost = (entitlements.data?.usage.activeHostedCampaigns ?? 0) > 0

  return (
    <section className={styles.page} aria-labelledby='social-hub-title'>
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <Title id='social-hub-title' order={1}>
            Social Hub
          </Title>
          <Text c='dimmed'>
            Find or host free tables without exposing private Campaign details.
          </Text>
        </div>
        <Button
          disabled={entitlements.isPending || !canCreatePost}
          leftSection={<Plus size={16} aria-hidden='true' />}
          onClick={() => navigate({ to: '/social/hosting/new' })}
        >
          New Post
        </Button>
      </header>
      <SocialHubNavigation
        view={search.view}
        onChange={(view) => onSearchChange({ ...search, view })}
      />
      {search.view === 'discover' ? (
        <SocialDiscoveryView search={search} onSearchChange={onSearchChange} />
      ) : null}
      {search.view === 'applications' ? (
        <SocialApplicationsView applicationPublicId={search.applicationPublicId} />
      ) : null}
      {search.view === 'invitations' ? (
        <SocialInvitationsView invitePublicId={search.invitePublicId} />
      ) : null}
      {search.view === 'hosting' ? <SocialHostingView /> : null}
    </section>
  )
}
