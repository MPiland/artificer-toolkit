import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, vi } from 'vitest'
import { useQueryClient } from '@tanstack/react-query'
import { getSystemListPage } from '#app/data/systems/queries'
import { authoredRouteStorySystems } from '#domains/authoredRouteStory.fixtures'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { LibraryImportPage } from './LibraryImportPage'

const previewId = '00000000-0000-4000-8000-000000000222'
const mocks = vi.hoisted(() => ({ commitImport: vi.fn(), previewImport: vi.fn() }))
// Each response a test supplies passes through the real DTO schema before the page sees it.
vi.mock('#app/data/imports/importClient', async () => {
  const { importResultReportDtoSchema } = await import('@artificer-toolkit/schema/api/imports')
  const { importPreviewResultSchema } = await import('@artificer-toolkit/schema/api/importJobs')
  return {
    previewImport: async (...args: unknown[]) =>
      importPreviewResultSchema.parse(await mocks.previewImport(...args)),
    commitImport: async (...args: unknown[]) =>
      importResultReportDtoSchema.parse(await mocks.commitImport(...args))
  }
})

function NativeSystemImportPage() {
  const queryClient = useQueryClient()
  queryClient.setQueryDefaults(getSystemListPage().queryKey, {
    queryFn: async () => ({
      page: [
        {
          ...authoredRouteStorySystems[0]!,
          rulesCatalogues: [
            { id: '00000000-0000-4000-8000-000000000301', label: '2014 SRD', description: null }
          ]
        }
      ],
      isDone: true,
      continueCursor: ''
    })
  })
  return <LibraryImportPage />
}

beforeEach(() => {
  mocks.commitImport.mockReset()
  mocks.previewImport.mockReset()
})

it('previews selected entries, requires replacement confirmation, and commits only selected entries', async () => {
  mocks.previewImport.mockResolvedValue({
    source: 'DND_BEYOND',
    items: [
      {
        entryId: 'link-1',
        name: 'sheet',
        status: 'READY',
        issues: [],
        collision: {
          subjectKind: 'SPELL',
          subjectId: 'spell-1',
          label: 'Spell',
          hasExistingDraft: true,
          allowedChoices: ['COPY', 'UPDATE_DRAFT'],
          defaultChoice: 'UPDATE_DRAFT'
        }
      }
    ],
    summary: { ready: 1, needsReview: 0, unable: 0 },
    previewId,
    expiresAt: '2026-09-20T00:00:00.000Z'
  })
  mocks.commitImport.mockResolvedValue({
    source: 'DND_BEYOND',
    items: [
      {
        entryId: 'link-1',
        name: 'sheet',
        label: 'Spell',
        outcome: 'UPDATED',
        issues: [],
        destination: { kind: 'AUTHORED_DRAFT', subjectKind: 'SPELL', subjectId: 'spell-1' },
        publicId: '1001'
      }
    ],
    summary: { created: 0, updated: 1, skipped: 0, failed: 0 }
  })
  renderWithAppProviders(<NativeSystemImportPage />)
  fireEvent.change(screen.getByLabelText('Character-sheet links'), {
    target: { value: 'https://www.dndbeyond.com/characters/1' }
  })
  const previewButton = screen.getByRole('button', { name: 'Preview import' })
  await waitFor(() => expect(previewButton).toBeEnabled())
  fireEvent.click(previewButton)
  await screen.findByText('A matching owned item already exists.')
  expect(screen.getByRole('button', { name: 'Confirm import' })).toBeDisabled()
  fireEvent.click(screen.getByLabelText('Replace the existing edit draft'))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm import' }))
  await waitFor(() =>
    expect(mocks.commitImport).toHaveBeenCalledWith(
      expect.objectContaining({ selectedEntryIds: ['link-1'] }),
      previewId,
      expect.anything()
    )
  )
  expect(await screen.findByText(/0 created, 1 updated/i)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Open' })).toHaveAttribute(
    'href',
    '/spells/1001/spell/edit'
  )
})

it('groups preview outcomes and commits individual active or draft choices', async () => {
  mocks.previewImport.mockResolvedValue({
    source: 'DND_BEYOND',
    items: [
      {
        entryId: 'link-1',
        name: 'sheet',
        label: 'Varen',
        status: 'READY',
        issues: [
          {
            severity: 'INFO',
            code: 'DND_BEYOND_MECHANICS_NOT_IMPORTED',
            message: 'D&D Beyond-specific mechanics are not imported.',
            path: [],
            attemptedMatch: 'internal matching detail',
            correctionRequired: false
          }
        ],
        destination: { kind: 'CHARACTER_BUILDER_DRAFT', subjectId: 'character-1' },
        existingMatches: [
          {
            sourceLabel: 'Wizard',
            matchedLabel: 'Wizard',
            subjectKind: 'CLASS',
            count: 1
          }
        ],
        notImported: [
          {
            label: 'Bladesinging',
            subjectKind: 'CLASS',
            count: 1
          }
        ],
        relatedContent: [
          {
            externalId: 'feat-1',
            label: 'Boon of the Baroness',
            subjectKind: 'FEAT',
            activationEligible: true,
            destination: {
              kind: 'ACTIVE_AUTHORED_CONTENT',
              subjectKind: 'FEAT',
              subjectId: 'feat-1'
            }
          },
          {
            externalId: 'equipment-1',
            label: 'Magic Pocket',
            subjectKind: 'EQUIPMENT',
            activationEligible: false,
            destination: {
              kind: 'AUTHORED_DRAFT',
              subjectKind: 'EQUIPMENT',
              subjectId: 'equipment-1'
            }
          }
        ]
      }
    ],
    summary: { ready: 1, needsReview: 0, unable: 0 },
    previewId,
    expiresAt: '2026-09-20T00:00:00.000Z'
  })
  mocks.commitImport.mockResolvedValue({
    source: 'DND_BEYOND',
    items: [],
    summary: { created: 0, updated: 0, skipped: 0, failed: 0 }
  })

  renderWithAppProviders(<NativeSystemImportPage />)
  fireEvent.change(screen.getByLabelText('Character-sheet links'), {
    target: { value: 'https://www.dndbeyond.com/characters/1' }
  })
  const previewButton = screen.getByRole('button', { name: 'Preview import' })
  await waitFor(() => expect(previewButton).toBeEnabled())
  fireEvent.click(previewButton)

  const entryControl = await screen.findByRole('button', {
    name: /Varen.*1 existing match.*1 ready to activate.*1 draft required.*1 not imported/i
  })
  expect(entryControl).toHaveAttribute('aria-expanded', 'true')
  expect(screen.queryByText('internal matching detail')).not.toBeInTheDocument()

  const existingMatchesControl = screen.getByRole('button', {
    name: 'Existing Library matches (1)'
  })
  const readyControl = screen.getByRole('button', { name: 'Ready to activate (1)' })
  const draftsControl = screen.getByRole('button', { name: 'Drafts required (1)' })
  const notImportedControl = screen.getByRole('button', { name: 'Not imported (1)' })
  expect(existingMatchesControl).toHaveAttribute('aria-expanded', 'false')
  expect(readyControl).toHaveAttribute('aria-expanded', 'false')
  expect(draftsControl).toHaveAttribute('aria-expanded', 'false')
  expect(notImportedControl).toHaveAttribute('aria-expanded', 'false')

  fireEvent.click(existingMatchesControl)
  expect(await screen.findByText('Wizard → Wizard')).toBeInTheDocument()
  fireEvent.click(notImportedControl)
  expect(
    await screen.findByText(
      'No matches were found and there wasn’t enough data to import the following:'
    )
  ).toBeInTheDocument()
  expect(screen.getByText('Bladesinging')).toBeInTheDocument()

  fireEvent.click(readyControl)
  fireEvent.click(await screen.findByRole('radio', { name: 'Draft' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm import' }))

  await waitFor(() =>
    expect(mocks.commitImport).toHaveBeenCalledWith(
      expect.objectContaining({
        customContentChoices: [
          {
            entryId: 'link-1',
            externalId: 'feat-1',
            subjectKind: 'FEAT',
            choice: 'DRAFT'
          },
          {
            entryId: 'link-1',
            externalId: 'equipment-1',
            subjectKind: 'EQUIPMENT',
            choice: 'DRAFT'
          }
        ]
      }),
      previewId,
      expect.anything()
    )
  )
})

it('collapses every top-level entry in a batch', async () => {
  mocks.previewImport.mockResolvedValue({
    source: 'DND_BEYOND',
    items: [
      { entryId: 'link-1', name: 'one', label: 'Aria', status: 'READY', issues: [] },
      { entryId: 'link-2', name: 'two', label: 'Borin', status: 'READY', issues: [] }
    ],
    summary: { ready: 2, needsReview: 0, unable: 0 },
    previewId,
    expiresAt: '2026-09-20T00:00:00.000Z'
  })

  renderWithAppProviders(<NativeSystemImportPage />)
  fireEvent.change(screen.getByLabelText('Character-sheet links'), {
    target: {
      value: 'https://www.dndbeyond.com/characters/1\nhttps://www.dndbeyond.com/characters/2'
    }
  })
  const previewButton = screen.getByRole('button', { name: 'Preview import' })
  await waitFor(() => expect(previewButton).toBeEnabled())
  fireEvent.click(previewButton)

  expect(await screen.findByRole('button', { name: /Aria.*No related content/i })).toHaveAttribute(
    'aria-expanded',
    'false'
  )
  expect(screen.getByRole('button', { name: /Borin.*No related content/i })).toHaveAttribute(
    'aria-expanded',
    'false'
  )
})
