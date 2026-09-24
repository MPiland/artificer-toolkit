import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { fn } from 'storybook/test'
import {
  authoredCatalogueSearchInputSchema,
  type AuthoredCataloguePage
} from '@artificer-toolkit/schema/api/authoredCatalogue'
import { getAuthoredCatalogueSearch } from '#app/data/authoredCatalogue'
import { Shell, platformNavigation } from '#app/shell'
import { AuthoredListPage } from './AuthoredListPage'
import type { AuthoredListFilterValues } from './AuthoredList.types'

const meta = {
  title: 'Platform/Authored List/Native Catalogue Search',
  component: AuthoredListPage,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Synthetic search projections for layout and client paging; not SRD content or native-ranking proof.'
      }
    }
  },
  args: {
    title: 'Feats',
    summary: '5 feats / 3 SRD / 2 homebrew',
    createLabel: 'Create Feat',
    onCreate: fn(),
    onView: fn(),
    onEdit: fn(),
    onCopy: fn(),
    onDelete: fn(),
    items: [],
    filters: [
      {
        key: 'source',
        label: 'Source',
        placeholder: 'Any source',
        options: [
          { value: 'MASTER', label: 'SRD' },
          { value: 'OWNED', label: 'Homebrew' }
        ]
      }
    ]
  },
  decorators: [
    (Story) => {
      const client = useQueryClient()
      const key = getAuthoredCatalogueSearch({
        subjectKind: 'FEAT',
        query: 'ward',
        source: 'MASTER',
        paginationOpts: { cursor: null, numItems: 48 }
      }).queryKey.slice(0, 2)
      client.setQueryDefaults(key, {
        queryFn: async ({ queryKey }) => {
          const input = authoredCatalogueSearchInputSchema.parse(queryKey[2])
          const labels =
            input.source === 'MASTER'
              ? input.paginationOpts.cursor
                ? ['Warding Adept']
                : ['Shield Warden', 'Arcane Ward']
              : ['Hearth Ward', 'Storm Warden']
          return {
            page: labels
              .filter((label) => label.toLowerCase().includes(input.query.toLowerCase()))
              .map((label, index) => ({
                id: `00000000-0000-4000-8000-00000000000${index + (input.source === 'OWNED' ? 3 : input.paginationOpts.cursor ? 5 : 1)}`,
                publicId: label.toLowerCase().replaceAll(' ', '-'),
                systemId: '00000000-0000-4000-8000-000000000010',
                label,
                description: 'Protect your allies with a ward that lasts until your next turn.',
                activeUpdatedAt: '2026-09-04T00:00:00.000Z',
                status: 'ACTIVE',
                provenance: {
                  kind: input.source,
                  ownerUserId: input.source === 'OWNED' ? 'story-owner' : null
                },
                permissions: {
                  canView: true,
                  canCopy: true,
                  canEdit: input.source === 'OWNED',
                  canDelete: input.source === 'OWNED'
                }
              })),
            isDone: input.source === 'OWNED' || Boolean(input.paginationOpts.cursor),
            continueCursor: 'next-page'
          } satisfies AuthoredCataloguePage
        }
      })
      return <Story />
    }
  ],
  render: function NativeSearchStory(args) {
    const [query, setQuery] = useState('ward')
    const [filterValues, setFilters] = useState<AuthoredListFilterValues>({})
    return (
      <Shell
        navigation={platformNavigation}
        currentPath='/feats'
        isAuthenticated
        userEmail='creator@example.test'
      >
        <AuthoredListPage
          {...args}
          catalog={{
            searchSubjectKind: 'FEAT',
            activeCount: 5,
            totalCount: 5,
            controls: {
              query,
              sort: 'name',
              filterValues,
              onQueryChange: setQuery,
              onSortChange: () => {},
              onClearFilters: () => setFilters({}),
              onFilterChange: (key, value) =>
                setFilters((current) => ({ ...current, [key]: value }))
            },
            hasNextPage: false,
            hasPreviousPage: false,
            isFetchingNextPage: false,
            isFetchingPreviousPage: false,
            fetchNextPage: () => {},
            fetchPreviousPage: () => {}
          }}
        />
      </Shell>
    )
  }
} satisfies Meta<typeof AuthoredListPage>

export default meta
type Story = StoryObj<typeof meta>

export const RankedGroups: Story = {}
export const Cards: Story = { args: { initialViewMode: 'cards' } }
