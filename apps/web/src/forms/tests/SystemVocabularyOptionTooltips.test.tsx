import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import type { NodeRuntimeResolveResponseDto } from '@artificer-toolkit/schema/api/nodeRuntime'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { resolveFixtureNodeRuntime } from '#test/nodeRuntimeResolver'
import { TestRouterProvider } from '#test/TestRouterProvider'
import { useAppForm } from '../app-form/AppForm'
import { AuthoringLayout } from '../layout/AuthoringLayout'
import { FormRenderer } from '../rendering/FormRenderer'

const emptyValues: Record<string, unknown> = {}
const VocabularyRenderer = FormRenderer<Record<string, unknown>>({ defaultValues: emptyValues })

afterEach(cleanup)

describe('System vocabulary option tooltips in the authoring form', () => {
  it('shows the vocabulary description when a single-select option is hovered', async () => {
    const user = userEvent.setup()
    const speed = srdSystemRecord.speeds.find((entry) => entry.description)
    if (!speed?.description) throw new Error('Expected an SRD speed with a description.')

    render(
      <TestRouterProvider>
        <VocabularyHarness
          model={await resolveFixtureNodeRuntime({ mapId: 'speed', values: {} })}
        />
      </TestRouterProvider>
    )

    await user.click(await screen.findByRole('combobox', { name: /^speed/i }))
    await user.hover(await findOptionText(speed.label))

    expect(await screen.findByRole('tooltip')).toHaveTextContent(speed.description)
  }, 10_000)

  it('shows the vocabulary description when a multi-select option is hovered', async () => {
    const user = userEvent.setup()
    const damageType = srdSystemRecord.damageTypes.find((entry) => entry.description)
    if (!damageType?.description) throw new Error('Expected an SRD damage type description.')

    render(
      <TestRouterProvider>
        <VocabularyHarness
          model={await resolveFixtureNodeRuntime({
            mapId: 'creatureQualifiedDamageDefense',
            values: {}
          })}
        />
      </TestRouterProvider>
    )

    await user.click(await screen.findByRole('combobox', { name: /^damage types/i }))
    await user.hover(await findOptionText(damageType.label))

    expect(await screen.findByRole('tooltip')).toHaveTextContent(damageType.description)
  }, 10_000)
})

async function findOptionText(label: string) {
  return within(await screen.findByRole('option', { name: label })).getByText(label)
}

function VocabularyHarness({ model }: { model: NodeRuntimeResolveResponseDto }) {
  const form = useAppForm({ defaultValues: emptyValues, onSubmit: async () => undefined })

  return (
    <AuthoringLayout>
      <form.AppForm>
        <VocabularyRenderer
          form={form}
          mapId={model.mapId}
          model={model}
          renderAllSteps
          resolveModel={false}
          updateAuthoringState={false}
        />
      </form.AppForm>
    </AuthoringLayout>
  )
}
