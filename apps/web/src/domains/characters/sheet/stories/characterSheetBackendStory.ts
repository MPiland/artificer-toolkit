import { getFunctionName } from 'convex/server'
import { expect, userEvent, within } from 'storybook/test'
import { api } from '@artificer-toolkit/apis/convex/api'
import {
  characterSheetSliceReadResultDtoSchema,
  type CharacterSheetSlice,
  type CharacterSheetSliceDtoMap
} from '@artificer-toolkit/schema/api/characterSheetSlices'
import type { StoryQueryOverride } from '#app/test/storybook/storyQueryOverride'
import { buildCharacterRouteParams } from '#app/routing/authoredRouteParams'
import { Route } from '#routes/_authed/characters/$characterPublicId/$characterSlug/index'
import { STORY_CHARACTERS } from '../../../../../../apis/tests/developmentReviewDataScenarios'

export type StoryCharacter = (typeof STORY_CHARACTERS)[keyof typeof STORY_CHARACTERS]

/** The Sheet route opened at a story Character's id, which the loader redirects to its canonical handle. */
export function sheetRouter({ characterId, label }: StoryCharacter) {
  return {
    route: Route,
    path: '/characters/$characterPublicId/$characterSlug/' as const,
    params: buildCharacterRouteParams(characterId, label)
  }
}

/** Waits for a backend story's first Sheet read, which crosses the network to the seeded deployment. */
export async function findSeededSheetCharacter(
  canvasElement: HTMLElement,
  { label }: StoryCharacter
) {
  expect(
    (await within(canvasElement).findAllByText(label, {}, { timeout: 15_000 })).length
  ).toBeGreaterThan(0)
}

/** Opens a section of the mobile Sheet through its section menu, as a player on a phone does. */
export async function openMobileSheetPage(canvasElement: HTMLElement, label: string) {
  await userEvent.click(
    await within(canvasElement).findByRole('button', { name: 'Open sheet section menu' })
  )
  const menu = await within(canvasElement.ownerDocument.body).findByRole('dialog', {
    name: 'Sheet sections'
  })
  await userEvent.click(within(menu).getByRole('button', { name: label }))
}

/**
 * The Sheet slice a composed story serves: what the seeded deployment reads for `slice`, changed by
 * `derive` and parsed through the real slice contract, so the variant is a state the contract allows.
 */
export function sheetSliceOverride<Slice extends CharacterSheetSlice>(
  slice: Slice,
  dataSchema: { parse: (value: unknown) => CharacterSheetSliceDtoMap[Slice] },
  derive: (data: CharacterSheetSliceDtoMap[Slice]) => CharacterSheetSliceDtoMap[Slice]
): StoryQueryOverride {
  return {
    query: getFunctionName(api.characters.sheetSlices.get),
    args: { slice },
    derive: (served) => {
      const read = characterSheetSliceReadResultDtoSchema.parse(served)
      if (read.slice !== slice) throw new Error(`The deployment read ${read.slice}, not ${slice}.`)
      return characterSheetSliceReadResultDtoSchema.parse({
        slice,
        data: derive(dataSchema.parse(read.data))
      })
    }
  }
}
