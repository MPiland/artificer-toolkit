import { expect, within } from 'storybook/test'
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
