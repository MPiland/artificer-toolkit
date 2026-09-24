import {
  authoredCatalogueSearchInputSchema,
  type AuthoredCatalogueSearchInput
} from '@artificer-toolkit/schema/api/authoredCatalogue'
import { Button, Group, Text } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { getAuthoredCatalogueSearch, mapAuthoredCatalogueItems } from '#app/data/authoredCatalogue'
import { AuthoredListCards } from './AuthoredListCards'
import { AuthoredListTable } from './AuthoredListTable'
import type {
  AuthoredListActionHandlers,
  AuthoredListAttributeColumn,
  AuthoredListItem,
  AuthoredListViewMode
} from './AuthoredList.types'
import * as styles from './AuthoredCatalogueSearch.css'

export function AuthoredCatalogueSearch({
  source,
  ...props
}: {
  subjectKind: AuthoredCatalogueSearchInput['subjectKind']
  query: string
  category?: string
  source?: string | null
  viewMode: AuthoredListViewMode
  cardColumnCount: number
  attributeColumns: AuthoredListAttributeColumn[]
  onView?: (item: AuthoredListItem) => void
  onViewIntent?: (item: AuthoredListItem) => void
  actionHandlers: AuthoredListActionHandlers
  useMenuActions: boolean
}) {
  const sources: AuthoredCatalogueSearchInput['source'][] =
    source === 'MASTER' || source === 'OWNED' ? [source] : ['MASTER', 'OWNED']
  return (
    <div className={styles.viewport}>
      {sources.map((sourceKind) => (
        <SearchGroup
          key={JSON.stringify([props.subjectKind, props.query, props.category, sourceKind])}
          {...props}
          source={sourceKind}
        />
      ))}
    </div>
  )
}

function SearchGroup({
  subjectKind,
  query,
  category,
  source,
  viewMode,
  cardColumnCount,
  attributeColumns,
  onView,
  onViewIntent,
  actionHandlers,
  useMenuActions
}: {
  subjectKind: AuthoredCatalogueSearchInput['subjectKind']
  query: string
  category?: string
  source: AuthoredCatalogueSearchInput['source']
  viewMode: AuthoredListViewMode
  cardColumnCount: number
  attributeColumns: AuthoredListAttributeColumn[]
  onView?: (item: AuthoredListItem) => void
  onViewIntent?: (item: AuthoredListItem) => void
  actionHandlers: AuthoredListActionHandlers
  useMenuActions: boolean
}) {
  const [cursors, setCursors] = useState<(string | null)[]>([null])
  const input = authoredCatalogueSearchInputSchema.safeParse({
    subjectKind,
    query,
    category,
    source,
    paginationOpts: { cursor: cursors.at(-1), numItems: 48 }
  })
  const result = useQuery(getAuthoredCatalogueSearch(input.success ? input.data : null))
  const items =
    result.data && !result.isError ? mapAuthoredCatalogueItems(result.data.page, subjectKind) : []
  const label = source === 'MASTER' ? 'SRD' : 'Homebrew'
  const rowCount = viewMode === 'cards' ? Math.ceil(items.length / cardColumnCount) : items.length
  const renderedRows = Array.from({ length: rowCount }, (_, index) => index)

  return (
    <section aria-label={`${label} search results`}>
      <Group className={styles.groupHeader} justify='space-between'>
        <Text component='h2' size='md' fw={700}>
          {label}
        </Text>
        <Text size='sm' c='dimmed' aria-live='polite'>
          {result.data && !result.isError
            ? `${items.length} loaded on this page · Relevance`
            : 'Relevance'}
        </Text>
      </Group>
      {!input.success ? (
        <Text role='status' p='md'>
          Enter 1–16 words, up to 160 characters.
        </Text>
      ) : result.isError ? (
        <Group className={styles.groupHeader}>
          <Text role='alert'>Couldn’t search {label}.</Text>
          <Button variant='default' onClick={() => void result.refetch()}>
            Try again
          </Button>
        </Group>
      ) : result.isPending ? (
        <Text role='status' p='md'>
          Searching {label}…
        </Text>
      ) : items.length === 0 ? (
        <Text role='status' p='md'>
          No matching {label} results on this page.
        </Text>
      ) : viewMode === 'cards' ? (
        <AuthoredListCards
          embedded
          cardColumnCount={cardColumnCount}
          filteredItems={items}
          attributeColumns={attributeColumns}
          renderedRows={renderedRows}
          paddingTop={0}
          paddingBottom={0}
          onView={onView}
          onViewIntent={onViewIntent}
          actionHandlers={actionHandlers}
          useMenuActions={useMenuActions}
        />
      ) : (
        <AuthoredListTable
          embedded
          filteredItems={items}
          attributeColumns={attributeColumns}
          hasAccentColumn={false}
          hasStatusColumn={false}
          hasBadgeColumn={false}
          renderedRows={renderedRows}
          paddingTop={0}
          paddingBottom={0}
          onView={onView}
          onViewIntent={onViewIntent}
          actionHandlers={actionHandlers}
        />
      )}
      {input.success ? (
        <Group className={styles.groupHeader} justify='space-between'>
          <Button
            variant='default'
            aria-label={`Previous ${label} results`}
            disabled={cursors.length === 1 || result.isFetching}
            onClick={() => setCursors((current) => current.slice(0, -1))}
          >
            Previous
          </Button>
          <Button
            variant='default'
            aria-label={`Next ${label} results`}
            disabled={!result.data || result.isError || result.data.isDone || result.isFetching}
            onClick={() => {
              if (result.data) setCursors((current) => [...current, result.data.continueCursor])
            }}
          >
            Next
          </Button>
        </Group>
      ) : null}
    </section>
  )
}
