import { getFunctionName } from 'convex/server'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { api } from '@artificer-toolkit/apis/convex/api'
import {
  characterSheetSliceReadResultDtoSchema,
  type CharacterSheetSlice,
  type CharacterSheetSliceDtoMap
} from '@artificer-toolkit/schema/api/characterSheetSlices'
import {
  characterSheetPanelDtoSchema,
  type CharacterSheetPanelDto
} from '@artificer-toolkit/schema/api/characterSheetPanel'
import type { StoryQueryOverride } from '#app/test/storybook/storyQueryOverride'
import { writesTo } from '#app/test/storybook/storyWrites'
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

/** Opens a Sheet section as the viewport offers it: the desktop's tab, or the phone's section menu. */
export async function openSheetSection(canvasElement: HTMLElement, label: string, phone: boolean) {
  if (phone) return openMobileSheetPage(canvasElement, label)
  await userEvent.click(
    await within(canvasElement).findByRole('tab', { name: new RegExp(`^${label}$`) })
  )
}

/** Waits for an open inspector's first panel read, which crosses the network to the seeded deployment. */
export async function expectInspectorReady(
  canvasElement: HTMLElement,
  title: string,
  readyLabel: string
) {
  const inspector = await within(canvasElement.ownerDocument.body).findByRole(
    'dialog',
    { name: title },
    { timeout: 15_000 }
  )
  await expect(inspector).toBeVisible()
  await expect(
    within(inspector).queryByLabelText('Loading character details')
  ).not.toBeInTheDocument()
  await expect(await within(inspector).findByText(readyLabel, { exact: true })).toBeVisible()
  return inspector
}

type AbilityPanel = Extract<CharacterSheetPanelDto, { kind: 'ABILITY' }>

/**
 * The ability panel a composed story serves: what the seeded deployment reads, changed by derive
 * and parsed through the real panel contract.
 */
export function abilityPanelOverride(
  ability: string,
  derive: (panel: AbilityPanel) => AbilityPanel
): StoryQueryOverride {
  return {
    query: getFunctionName(api.characters.panels.get),
    args: { target: { kind: 'ABILITY', ability } },
    derive: (served) => {
      const panel = characterSheetPanelDtoSchema.parse(served)
      if (panel.kind !== 'ABILITY')
        throw new Error(`The deployment read ${panel.kind}, not ABILITY.`)
      return characterSheetPanelDtoSchema.parse(derive(panel))
    }
  }
}

/** Opens a Character's Sheet, then one of its rest dialogs. */
export async function opensRestDialog(
  canvasElement: HTMLElement,
  character: StoryCharacter,
  restName: 'Short Rest' | 'Long Rest'
) {
  await findSeededSheetCharacter(canvasElement, character)
  await userEvent.click(await within(canvasElement).findByRole('button', { name: restName }))
  return within(canvasElement.ownerDocument.body).findByRole('dialog', { name: restName })
}

/** Adds a d10 and a d6 hit die to the seeded multiclass's Short Rest, which leaves its roll and rest buttons ready. */
export async function addsMulticlassHitDice(canvasElement: HTMLElement) {
  const dialog = await opensRestDialog(canvasElement, STORY_CHARACTERS.multiclass, 'Short Rest')
  await expect(
    await within(dialog).findByLabelText('Remove the current Max HP adjustment')
  ).toBeInTheDocument()
  await userEvent.click(await within(dialog).findByRole('button', { name: 'Add one d10 hit die' }))
  const addD6 = within(dialog).getByRole('button', { name: 'Add one d6 hit die' })
  await waitFor(() => expect(addD6).toBeEnabled())
  await userEvent.click(addD6)
  await waitFor(() =>
    expect(within(dialog).getByRole('button', { name: 'Roll 1d10 + 1d6 + 2' })).toBeVisible()
  )
  await waitFor(() =>
    expect(within(dialog).getByRole('button', { name: 'Take Short Rest' })).toBeVisible()
  )
  return dialog
}

/** Rolls the dice the Short Rest dialog offers, which the story spies and records as a write. */
export async function rollsHitDice(dialog: HTMLElement, expression: string, label: string) {
  await userEvent.click(within(dialog).getByRole('button', { name: `Roll ${expression}` }))
  await waitFor(() =>
    expect(writesTo(api.rolls.execute)).toEqual([
      {
        characterId: expect.any(String),
        expression,
        source: { kind: 'HIT_DIE', label }
      }
    ])
  )
}
