import { expect, mocked } from 'storybook/test'
import { createVttSceneRenderer, type VttSceneRenderer } from './vttSceneRenderer'
import {
  maxStatusSegments,
  statusCategoryColours,
  statusOverflowColour,
  type VttTokenPresentation
} from './vttSceneRenderer.model'
import type { VttSceneRendererDiagnostics } from './vttSceneRendererDiagnostics'

type DrawnToken = VttSceneRendererDiagnostics['tokens'][number]

export function drawnToken(diagnostics: VttSceneRendererDiagnostics, id: string): DrawnToken {
  const drawn = diagnostics.tokens.find((token) => token.id === id)
  if (!drawn) throw new Error(`Token ${id} is not drawn.`)
  return drawn
}

/**
 * Asserts the live display objects against the real presentation: the outer ring draws one segment
 * per status in the model's order, ends in a distinct overflow segment past the cap, and the inner
 * ring, halo and fill carry the presentation's colours.
 */
export async function expectDrawnPresentation(
  drawn: DrawnToken,
  presentation: VttTokenPresentation
): Promise<void> {
  const statuses = presentation.statuses
  const overflowing = statuses.length > maxStatusSegments
  await expect(drawn.statusSegments.length).toBe(Math.min(statuses.length, maxStatusSegments))
  const categorySegments = drawn.statusSegments.filter((segment) => !segment.overflow)
  await expect(categorySegments.map((segment) => segment.color)).toEqual(
    statuses
      .slice(0, categorySegments.length)
      .map((status) => statusCategoryColours[status.category])
  )
  await expect(drawn.statusSegments.filter((segment) => segment.overflow)).toEqual(
    overflowing ? [{ color: statusOverflowColour, overflow: true }] : []
  )
  await expect(drawn.statusSegments.at(-1)?.overflow ?? false).toBe(overflowing)
  await expect(drawn.halo).toEqual(
    presentation.halo ? { color: presentation.halo.color, label: presentation.halo.label } : null
  )
  await expect(drawn.bodyFillColor).toBe(presentation.fillColor)
  await expect(drawn.ringColor).toBe(presentation.outlineColor)
}

/** The renderer the Stage under test created most recently (the module is spied in preview.tsx). */
export async function latestStageRenderer(): Promise<VttSceneRenderer> {
  const result = mocked(createVttSceneRenderer).mock.results.at(-1)
  if (!result) throw new Error('The Stage has not created a renderer.')
  return result.value
}
