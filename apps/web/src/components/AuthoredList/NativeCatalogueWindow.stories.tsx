import { api } from '@artificer-toolkit/apis/convex/api'
import {
  authoredCatalogueReadInputSchema,
  authoredCatalogueSummaryInputSchema,
  type AuthoredCataloguePage
} from '@artificer-toolkit/schema/api/authoredCatalogue'
import { convexQuery } from '@convex-dev/react-query'
import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { useQueryClient } from '@tanstack/react-query'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { buildBackgroundListFilters } from '#app/data/backgrounds/backgroundListMapper'
import {
  buildEquipmentListFilters,
  equipmentListAttributeColumns,
  equipmentListSortOptions
} from '#app/data/equipment/equipmentListMapper'
import { Shell, platformNavigation } from '#app/shell'
import { AuthoredListPage } from './AuthoredListPage'
import { useNativeAuthoredCatalogWindow } from './useNativeAuthoredCatalogWindow'

const rows: AuthoredCataloguePage['page'] = Array.from({ length: 336 }, (_, index) => ({
  id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  publicId: `background-${index + 1}`,
  systemId: '00000000-0000-4000-8000-000000001000',
  label: `Background ${String(index + 1).padStart(3, '0')}`,
  category: index % 2 === 0 ? 'WEAPON' : 'ADVENTURING_GEAR',
  description: 'Synthetic catalogue summary for native window interaction checks.',
  activeUpdatedAt: '2026-09-05T00:00:00.000Z',
  status: 'ACTIVE',
  provenance: {
    kind: index < 168 ? 'MASTER' : 'OWNED',
    ownerUserId: index < 168 ? null : 'story-owner'
  },
  permissions: { canView: true, canCopy: true, canEdit: index >= 168, canDelete: index >= 168 }
}))
const readPage = fn(
  async ({ queryKey }: { queryKey: readonly unknown[] }): Promise<AuthoredCataloguePage> => {
    const { source, category, sort, paginationOpts } = authoredCatalogueReadInputSchema.parse(
      queryKey[2]
    )
    const matching = rows.filter(
      (row) =>
        (!source || row.provenance.kind === source) && (!category || row.category === category)
    )
    if (sort === 'category')
      matching.sort(
        (a, b) => a.category!.localeCompare(b.category!) || a.label.localeCompare(b.label)
      )
    const start = Number(paginationOpts.cursor ?? 0)
    const end = Number(paginationOpts.endCursor ?? start + paginationOpts.numItems)
    // Model asynchronous native responses, including the re-read when a range is pinned.
    await new Promise((resolve) => setTimeout(resolve, 100))
    return {
      page: matching.slice(start, end),
      isDone: end >= matching.length,
      continueCursor: String(end)
    }
  }
)

const meta = {
  title: 'Platform/Authored List/Native Catalogue Window',
  component: AuthoredListPage,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Synthetic native query responses exercise the real bounded window and list UI; not a managed backend acceptance proof.'
      }
    }
  },
  args: {
    title: 'Backgrounds',
    createLabel: 'Create Background',
    items: [],
    summary: '',
    filters: buildBackgroundListFilters(),
    onCreate: fn(),
    onView: fn()
  },
  decorators: [
    (Story) => {
      const client = useQueryClient()
      client.setQueryDefaults(
        convexQuery(api.content.catalogue.list, {
          subjectKind: 'BACKGROUND',
          paginationOpts: { cursor: null, numItems: 48 }
        }).queryKey.slice(0, 2),
        { queryFn: readPage }
      )
      client.setQueryDefaults(
        convexQuery(api.content.catalogue.summary, { subjectKind: 'BACKGROUND' }).queryKey.slice(
          0,
          2
        ),
        {
          queryFn: ({ queryKey }) => {
            const input = authoredCatalogueSummaryInputSchema.parse(queryKey[2])
            return {
              activeCount: 336,
              masterCount: 168,
              ownedCount: 168,
              totalCount: rows.filter(
                (row) =>
                  (!input.source || row.provenance.kind === input.source) &&
                  (!input.category || row.category === input.category)
              ).length,
              categories: input.subjectKind === 'EQUIPMENT' ? ['ADVENTURING_GEAR', 'WEAPON'] : []
            }
          }
        }
      )
      return <Story />
    }
  ],
  render: function NativeCatalogueStory(args) {
    const equipment = args.title === 'Equipment'
    const listing = useNativeAuthoredCatalogWindow(equipment ? 'EQUIPMENT' : 'BACKGROUND')
    return (
      <Shell
        navigation={platformNavigation}
        currentPath='/backgrounds'
        isAuthenticated
        userEmail='creator@example.test'
      >
        <AuthoredListPage
          {...args}
          {...listing}
          filters={
            equipment
              ? buildEquipmentListFilters(listing.summary?.categories ?? [])
              : buildBackgroundListFilters()
          }
          attributeColumns={equipment ? equipmentListAttributeColumns : undefined}
          sortOptions={equipment ? equipmentListSortOptions : undefined}
          summary={
            listing.summary
              ? `${listing.summary.activeCount} backgrounds / ${listing.summary.masterCount} SRD / ${listing.summary.ownedCount} homebrew`
              : 'Loading backgrounds…'
          }
        />
      </Shell>
    )
  }
} satisfies Meta<typeof AuthoredListPage>

export default meta
type Story = StoryObj<typeof meta>

export const CategoryControls: Story = {
  args: { title: 'Equipment', createLabel: 'Create Equipment' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const screen = within(canvasElement.ownerDocument.body)
    await expect(await canvas.findByText('Background 001')).toBeVisible()
    const category = await screen.findByRole('combobox', { name: 'Category' })
    await userEvent.click(category)
    await userEvent.type(category, 'Weapon')
    await userEvent.keyboard('{ArrowDown}{Enter}')
    await expect(await canvas.findByText('Background 003')).toBeVisible()
    await expect(canvas.queryByText('Background 002')).not.toBeInTheDocument()
    const sort = screen.getByRole('combobox', { name: 'Sort' })
    await userEvent.click(sort)
    await userEvent.click(await screen.findByRole('option', { name: 'Category' }))
    await waitFor(() =>
      expect(
        readPage.mock.calls.some(([{ queryKey }]) => {
          const input = authoredCatalogueReadInputSchema.parse(queryKey[2])
          return (
            input.category === 'WEAPON' &&
            input.sort === 'category' &&
            input.paginationOpts.cursor === null
          )
        })
      ).toBe(true)
    )
    await expect(await canvas.findByText('Background 001')).toBeVisible()
    await expect(canvas.queryByText('Background 002')).not.toBeInTheDocument()
    await userEvent.click(category)
    await userEvent.clear(category)
    await userEvent.type(category, 'Adventuring gear')
    await userEvent.keyboard('{ArrowDown}{Enter}')
    await expect(await canvas.findByText('Background 002')).toBeVisible()
    await expect(canvas.queryByText('Background 001')).not.toBeInTheDocument()
  }
}

export const ScrollAndReload: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Background 001')).toBeVisible()
    const viewport = canvas.getByRole('table', { name: 'Authored content table' }).parentElement!
    for (let page = 1; page < 7; page++) {
      viewport.scrollTop = viewport.scrollHeight
      viewport.dispatchEvent(new Event('scroll'))
      await waitFor(() =>
        expect({
          requested: readPage.mock.calls.map(
            ([{ queryKey }]) =>
              authoredCatalogueReadInputSchema.parse(queryKey[2]).paginationOpts.cursor
          ),
          scrollTop: viewport.scrollTop,
          height: viewport.clientHeight,
          scrollHeight: viewport.scrollHeight
        }).toMatchObject({ requested: expect.arrayContaining([String(page * 48)]) })
      )
      await waitFor(() =>
        expect(canvas.queryByText('Loading more backgrounds.')).not.toBeInTheDocument()
      )
    }
    await expect(canvas.getByText('Active (336)')).toBeVisible()
    for (const cursor of ['48', null]) {
      const previousReads = readPage.mock.calls.filter(
        ([{ queryKey }]) =>
          authoredCatalogueReadInputSchema.parse(queryKey[2]).paginationOpts.cursor === cursor
      ).length
      viewport.scrollTop = 0
      viewport.dispatchEvent(new Event('scroll'))
      await waitFor(() =>
        expect(
          readPage.mock.calls.filter(
            ([{ queryKey }]) =>
              authoredCatalogueReadInputSchema.parse(queryKey[2]).paginationOpts.cursor === cursor
          ).length,
          JSON.stringify({
            cursor,
            previousReads,
            scrollTop: viewport.scrollTop,
            attached: viewport.isConnected,
            requested: readPage.mock.calls.map(
              ([{ queryKey }]) => authoredCatalogueReadInputSchema.parse(queryKey[2]).paginationOpts
            )
          })
        ).toBeGreaterThan(previousReads)
      )
      await waitFor(() =>
        expect(canvas.queryByText('Loading more backgrounds.')).not.toBeInTheDocument()
      )
    }
    viewport.scrollTop = 0
    viewport.dispatchEvent(new Event('scroll'))
    await expect(await canvas.findByText('Background 001')).toBeVisible()
  }
}
