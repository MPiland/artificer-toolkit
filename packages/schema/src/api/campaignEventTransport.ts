import { z } from '../zod.js'
import {
  campaignEventDtoSchema,
  campaignEventPageDtoSchema,
  type CampaignEventDto,
  type CampaignEventPageDto
} from './campaignLiveState.js'

// Convex validators cannot expand recursive JSON; domain consumers decode the unchanged payload.
export const campaignEventTransportDtoSchema = z.extend(
  z.omit(campaignEventDtoSchema, { payload: true }),
  { payloadJson: z.string() }
)
export const campaignEventPageTransportDtoSchema = z.extend(campaignEventPageDtoSchema, {
  events: z.array(campaignEventTransportDtoSchema)
})
export type CampaignEventPageTransportDto = z.infer<typeof campaignEventPageTransportDtoSchema>

export function encodeCampaignEvent(input: CampaignEventDto) {
  const { payload, ...event } = campaignEventDtoSchema.parse(input)
  return { ...event, payloadJson: JSON.stringify(payload) }
}

export function decodeCampaignEventPage(
  input: CampaignEventPageTransportDto
): CampaignEventPageDto {
  const { events, nextCursor } = campaignEventPageTransportDtoSchema.parse(input)
  return campaignEventPageDtoSchema.parse({
    events: events.map(({ payloadJson, ...event }) => {
      const payload: unknown = JSON.parse(payloadJson)
      return { ...event, payload }
    }),
    nextCursor
  })
}
