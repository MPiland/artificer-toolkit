import { getFunctionName } from 'convex/server'
import { ConvexReactClient, useConvex } from 'convex/react'
import { fn, mocked } from 'storybook/test'
import { characterRestPreviewInputSchema } from '@artificer-toolkit/schema/api/characterSheetCommands'
import { createCharacterRestPreviewFixture } from './characterRest.fixtures'

export function mockSheetRestPreview() {
  const client = new ConvexReactClient('https://story-fixture.convex.cloud', { logger: false })
  Object.defineProperty(client, 'query', {
    value: fn<ConvexReactClient['query']>().mockImplementation(async (...[reference, args]) => {
      if (getFunctionName(reference) !== 'characters/rest:preview') {
        throw new Error('Unexpected Convex query in the character sheet rest fixture.')
      }

      const parsed = characterRestPreviewInputSchema.parse(args)
      return createCharacterRestPreviewFixture(parsed.input)
    })
  })
  mocked(useConvex).mockReturnValue(client)
  return () => client.close()
}
