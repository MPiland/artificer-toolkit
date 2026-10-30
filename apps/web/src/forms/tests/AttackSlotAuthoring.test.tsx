import { useEffect, useState } from 'react'
import { useStore } from '@tanstack/react-form'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getFunctionName } from 'convex/server'
import { api } from '@artificer-toolkit/apis/convex/api'
import { nodeRuntimeNormalizeValuesRequestDtoSchema } from '@artificer-toolkit/schema/api/nodeRuntime'
import type { NodeRuntimeResolveResponseDto } from '@artificer-toolkit/schema/api/nodeRuntime'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { brownBear } from '@artificer-toolkit/source-data/srd/creatures/brown-bear.js'
import {
  normalizeFixtureNodeRuntimeValues,
  resolveFixtureNodeRuntime
} from '#test/nodeRuntimeResolver'
import { TestRouterProvider } from '#test/TestRouterProvider'
import { useAppForm } from '../app-form/AppForm'
import { AuthoringLayout } from '../layout/AuthoringLayout'
import { FormRenderer } from '../rendering/FormRenderer'

type FormValues = Record<string, unknown>

// The structural-change guard verifies each edit with the native normalizer; run the real one.
vi.mock('convex/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('convex/react')>()),
  useConvex: () => ({
    query: async (reference: Parameters<typeof getFunctionName>[0], input: unknown) => {
      if (getFunctionName(reference) !== getFunctionName(api.authoring.nodeRuntime.normalizeValues))
        throw new Error('Expected native node-runtime normalization.')
      return normalizeFixtureNodeRuntimeValues({
        ...nodeRuntimeNormalizeValuesRequestDtoSchema.parse(input),
        ancestors: [creature]
      })
    }
  })
}))

const Renderer = FormRenderer<FormValues>({ defaultValues: {} })
const creature = brownBear as unknown as FormValues
const multiattack = brownBear.features?.find(({ label }) => label === 'Multiattack')
const bite = brownBear.features?.find(({ label }) => label === 'Bite')
const claws = brownBear.features?.find(({ label }) => label === 'Claws')
if (!multiattack?.attackSlots || !bite || !claws)
  throw new Error('Expected the Brown Bear actions.')
const { attackSlots: authoredSet, ...bareMultiattack } = multiattack

afterEach(cleanup)

/** The Creature feature editor, resolved by the real resolver as the server does, with a Save button. */
function FeatureEditor({
  initialModel,
  onSave
}: {
  initialModel: NodeRuntimeResolveResponseDto
  onSave: (values: FormValues) => void
}) {
  const form = useAppForm({
    defaultValues: bareMultiattack as FormValues,
    onSubmit: async ({ value }) => onSave(value)
  })
  const values = useStore(form.store, (state) => state.values)
  const [model, setModel] = useState(initialModel)
  useEffect(() => {
    void resolveFixtureNodeRuntime({
      mapId: 'creatureFeature',
      values,
      ancestors: [creature]
    }).then(setModel)
  }, [values])

  return (
    <AuthoringLayout>
      <form.AppForm>
        <Renderer
          form={form}
          mapId={model.mapId}
          model={model}
          renderAllSteps
          resolveModel={false}
          systemId={srdSystemRecord.id}
          updateAuthoringState={false}
        />
        <button type='button' onClick={() => void form.handleSubmit()}>
          Save feature
        </button>
      </form.AppForm>
    </AuthoringLayout>
  )
}

async function pick(
  user: ReturnType<typeof userEvent.setup>,
  name: RegExp,
  index: number,
  option: string
) {
  await user.click((await screen.findAllByRole('combobox', { name }))[index]!)
  await user.click(await screen.findByRole('option', { name: option }))
}

describe('Authoring a Multiattack attack slot set (ATTACK-11.3)', () => {
  it('authors the Brown Bear set from the Creature’s own actions and saves it', async () => {
    const user = userEvent.setup()
    const saved: FormValues[] = []
    render(
      <TestRouterProvider>
        <FeatureEditor
          initialModel={await resolveFixtureNodeRuntime({
            mapId: 'creatureFeature',
            values: bareMultiattack as FormValues,
            ancestors: [creature]
          })}
          onSave={(values) => saved.push(values)}
        />
      </TestRouterProvider>
    )

    await user.click(await screen.findByRole('button', { name: /^add attack slots$/i }))
    await screen.findByRole('button', { name: /^add slots$/i })
    await pick(user, /^filled by/i, 0, 'One of this Creature’s actions')
    await pick(user, /^action/i, 0, bite.label)

    await user.click(screen.getByRole('button', { name: /^add slots$/i }))
    await user.click(await screen.findByRole('button', { name: /^slot 2/i }))
    await pick(user, /^filled by/i, 0, 'One of this Creature’s actions')
    await pick(user, /^action/i, 0, claws.label)

    await user.click(screen.getByRole('button', { name: /^save feature$/i }))

    await waitFor(() => expect(saved).toHaveLength(1))
    expect(saved[0]?.attackSlots).toEqual(authoredSet)
  }, 30_000)
})
