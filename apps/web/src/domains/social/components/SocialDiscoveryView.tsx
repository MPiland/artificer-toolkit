import { Alert, Button, Drawer, Group, Loader, TextInput } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useInfiniteQuery } from '@tanstack/react-query'
import type { SocialDiscoveryInput } from '#app/lib/api'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import * as inputStyles from '#ui/primitives/Select/Select.css'
import type { SocialHubSearch } from '../socialSearch'
import { toSocialDiscoveryInput } from '../socialDiscovery'
import { SocialDiscoveryFilters } from './SocialDiscoveryFilters'
import { SocialEmptyState } from './SocialEmptyState'
import { SocialListingRow } from './SocialListingRow'
import * as styles from './SocialDiscoveryView.css'
import * as listStyles from './SocialHubViews.css'

export function SocialDiscoveryView({
  search,
  onSearchChange
}: {
  search: SocialHubSearch
  onSearchChange: (next: SocialHubSearch) => void
}) {
  const [drawerOpened, { close: closeDrawer, open: openDrawer }] = useDisclosure(false)
  const filters = toSocialDiscoveryInput(search)
  const activeFilterCount = [
    search.systemId,
    search.format,
    search.contentMaturity,
    search.toneTags?.length ? search.toneTags : undefined,
    search.playMode,
    search.timeZone,
    search.scheduleKind,
    search.weekday === undefined ? undefined : search.weekday,
    search.stateCode,
    search.city,
    search.minimumAvailableSeats,
    search.safetyPractice
  ].filter((value) => value !== undefined).length
  const clearFilters = () => onSearchChange({ query: search.query, view: 'discover' })
  const listings = useInfiniteQuery({
    queryKey: queryKeys.socialHub.discovery(filters),
    queryFn: ({ pageParam }) => api.socialHub.discovery.search({ ...filters, cursor: pageParam }),
    initialPageParam: undefined as SocialDiscoveryInput['cursor'] | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined
  })
  const items = listings.data?.pages.flatMap((page) => page.items)

  return (
    <>
      <div className={styles.discoveryTools} aria-label='Discovery search and filters'>
        <TextInput
          aria-label='Search table titles and summaries'
          classNames={{
            input: inputStyles.input,
            label: inputStyles.label,
            root: styles.searchField
          }}
          label='Search tables'
          placeholder='Title or summary'
          value={search.query ?? ''}
          onChange={(event) =>
            onSearchChange({ ...search, query: event.currentTarget.value || undefined })
          }
        />
        <Button
          aria-haspopup='dialog'
          className={styles.filterButton}
          variant='default'
          onClick={openDrawer}
        >
          {activeFilterCount ? `Filters (${activeFilterCount})` : 'Filters'}
        </Button>
        {activeFilterCount ? (
          <Button className={styles.clearFilters} variant='subtle' onClick={clearFilters}>
            Clear filters
          </Button>
        ) : null}
      </div>
      <Drawer
        classNames={{
          body: styles.drawerBody,
          content: styles.drawerContent,
          header: styles.drawerHeader,
          title: styles.drawerTitle
        }}
        opened={drawerOpened}
        position='right'
        size='min(24rem, 92vw)'
        title='Discovery filters'
        closeButtonProps={{ 'aria-label': 'Close discovery filters' }}
        onClose={closeDrawer}
      >
        <div className={styles.drawerFields}>
          <SocialDiscoveryFilters search={search} onSearchChange={onSearchChange} />
          <Group justify='space-between'>
            <Button disabled={!activeFilterCount} variant='subtle' onClick={clearFilters}>
              Clear filters
            </Button>
            <Button onClick={closeDrawer}>Show results</Button>
          </Group>
        </div>
      </Drawer>
      {listings.isPending ? <Loader aria-label='Loading listings' size='sm' /> : null}
      {listings.isError ? <Alert color='red'>Could not load listings. Try again.</Alert> : null}
      {items?.length === 0 ? (
        <SocialEmptyState
          title='No tables match'
          body='Try clearing a filter or checking again later.'
        />
      ) : null}
      {items?.length ? (
        <div className={listStyles.rows} aria-label='Open public tables'>
          {items.map((listing) => (
            <SocialListingRow listing={listing} key={listing.listingPublicId} />
          ))}
        </div>
      ) : null}
      {listings.hasNextPage ? (
        <Button
          loading={listings.isFetchingNextPage}
          variant='default'
          onClick={() => listings.fetchNextPage()}
        >
          Load more tables
        </Button>
      ) : null}
      <span className={styles.srStatus} aria-live='polite'>
        {listings.isFetching ? 'Updating table results.' : 'Table results updated.'}
      </span>
    </>
  )
}
