import { z } from 'zod'
import { socialListingDtoSchema } from '@artificer-toolkit/schema/api/socialHub'

/** The test id of the frame the seeded listing components render around the listing they found. */
export const seededListingTestId = 'seeded-listing'

/** The listing a seeded frame carries, as the deployment returned it. */
export async function readSeededListing(canvas: {
  findByTestId: (id: string) => Promise<HTMLElement>
}) {
  const frame = await canvas.findByTestId(seededListingTestId)
  return socialListingDtoSchema.parse(JSON.parse(z.string().parse(frame.dataset.listing)))
}
