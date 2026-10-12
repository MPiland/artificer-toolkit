import { getFunctionName } from 'convex/server'
import { ConvexReactClient, useConvex } from 'convex/react'
import { fn, mocked } from 'storybook/test'
import { api } from '@artificer-toolkit/apis/convex/api'
import { characterRestPreviewInputSchema } from '@artificer-toolkit/schema/api/characterSheetCommands'
import {
  createMulticlassRestPreview,
  createMulticlassSheet,
  createRestPreview
} from './playedCharacters.fixture'

const multiclassCharacterId = createMulticlassSheet().meta.characterId

export function mockSheetRestPreview() {
  const client = new ConvexReactClient('https://story-fixture.convex.cloud', { logger: false })
  Object.defineProperty(client, 'query', {
    value: fn<ConvexReactClient['query']>().mockImplementation(async (...[reference, args]) => {
      if (getFunctionName(reference) !== getFunctionName(api.characters.rest.preview)) {
        throw new Error('Unexpected Convex query in the character sheet rest fixture.')
      }

      const parsed = characterRestPreviewInputSchema.parse(args)
      return parsed.id === multiclassCharacterId
        ? createMulticlassRestPreview(parsed.input)
        : createRestPreview(parsed.input)
    })
  })
  mocked(useConvex).mockReturnValue(client)
  return () => client.close()
}
