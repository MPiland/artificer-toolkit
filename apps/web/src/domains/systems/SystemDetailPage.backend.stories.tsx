import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { definitionReferences } from '@artificer-toolkit/apis/convex/definition-references'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { SRD_SENSE_DEFINITIONS } from '@artificer-toolkit/source-data/srd/senses.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { writesTo } from '#app/test/storybook/storyWrites'
import { Route } from '#routes/_authed/systems/$systemId'
import { STORY_DEFINITIONS } from '../../../../apis/tests/developmentReviewDataScenarios'

const darkvision = SRD_SENSE_DEFINITIONS.find(({ label }) => label === 'Darkvision')
if (!darkvision) throw new Error('The SRD defines no Darkvision sense.')

// Reads the seeded SRD System as the story account (D218, D221): its capability, Rules Catalogue and
// reusable definitions, among them the platform senses and the account's own Sense definitions that
// `seedStoryData` authors, one new, one with a saved draft and one published. A story ends at its
// write; writes are spies.
const meta = {
  title: 'Domains/Systems/System Detail',
  parameters: {
    layout: 'fullscreen',
    tanstack: {
      router: {
        route: Route,
        path: '/systems/$systemId' as const,
        params: { systemId: srdSystemRecord.id }
      }
    }
  }
} satisfies Meta<typeof Route>

export default meta

type Story = StoryObj<typeof meta>

/**
 * Selects the definition named `label` in the list, paging forward until it shows. The list pages
 * ten at a time across the platform and the account's own definitions.
 */
async function openDefinition(canvas: ReturnType<typeof within>, label: RegExp) {
  const entries = () => canvas.queryAllByRole('button', { name: /(New|Draft|Published)$/ })
  await waitFor(() => expect(entries().length).toBeGreaterThan(0))
  for (;;) {
    const entry = canvas.queryByRole('button', { name: label })
    if (entry) {
      await userEvent.click(entry)
      return
    }
    const [first] = entries()
    const next = canvas.getByRole('button', { name: 'Next definitions page' })
    // The last page leaves Next disabled, so a label that never shows fails here.
    await expect(next).toBeEnabled()
    await userEvent.click(next)
    await waitFor(() => expect(first).not.toBeInTheDocument())
    await waitFor(() => expect(entries().length).toBeGreaterThan(0))
  }
}

/** The System, its capability and Rules Catalogue, and a new definition up to its save-draft write. */
export const DefinitionAuthoring: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByRole('heading', { name: srdSystemRecord.label }, { timeout: 15_000 })
    ).toBeVisible()
    await expect(await canvas.findByText(SRD_RULES_CATALOGUE.label)).toBeVisible()
    await expect(
      await canvas.findAllByRole('heading', { name: 'Reusable definitions' })
    ).toHaveLength(2)

    await openDefinition(canvas, new RegExp(`^${STORY_DEFINITIONS.fresh.label}`))
    await expect(await canvas.findByLabelText('Channel')).toHaveValue('VISUAL')
    await userEvent.click(await canvas.findByRole('button', { name: 'Save draft' }))
    await waitFor(() => expect(writesTo(definitionReferences.saveDraft)).toHaveLength(1))
    const [write] = writesTo(definitionReferences.saveDraft)
    expect(write).toMatchObject({
      expectedDefinitionVersion: 0,
      expectedDraftVersion: null,
      document: { kind: 'SENSE', gameSystemId: srdSystemRecord.id }
    })
  }
}

/** A definition with a saved draft offers Publish, which the story ends at. */
export const DraftSaved: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await openDefinition(canvas, new RegExp(`^${STORY_DEFINITIONS.drafted.label}Draft$`))
    const publish = await canvas.findByRole('button', { name: 'Publish' })
    await waitFor(() => expect(publish).toBeEnabled())
    await userEvent.click(publish)
    await waitFor(() => expect(writesTo(definitionReferences.publish)).toHaveLength(1))
    expect(writesTo(definitionReferences.publish)[0]).toMatchObject({
      expectedDefinitionVersion: 0,
      expectedDraftVersion: 0
    })
  }
}

/** A published definition has no draft to publish. */
export const Published: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await openDefinition(canvas, new RegExp(`^${STORY_DEFINITIONS.published.label}Published$`))
    await expect(await canvas.findByRole('button', { name: 'Save draft' })).toBeEnabled()
    await expect(canvas.getByRole('button', { name: 'Publish' })).toBeDisabled()
  }
}

/** A platform definition is readable and offers no edit. */
export const PlatformDefinition: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await openDefinition(canvas, new RegExp(`^${darkvision.label}`))
    await expect(
      await canvas.findByText('Platform definitions are readable here but cannot be edited.')
    ).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'Save draft' })).not.toBeInTheDocument()
  }
}
