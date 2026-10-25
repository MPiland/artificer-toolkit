import { z, lazySchema } from '../zod.js'
import { equipmentPropertyCodeSchema } from '../shared/enums.js'
import { systemCoreCodeSchema } from '../shared/systemCoreCode.js'
import { serverUuidIdentityDtoSchema } from '../shared/serverUuidIdentity.js'
import { projectionIdentifierSchema } from './identity.js'

/**
 * Server-derived facts retained with the immutable Character projection for
 * System policy that needs an actor's physical source data. These are source
 * identities/codes, never display labels or VTT-token inference.
 */
export const characterInitiativeActorFactsSchema = lazySchema(() =>
  z
    .strictObject({
      effectiveSize: z.nullable(systemCoreCodeSchema),
      checkTotals: z._default(z.record(serverUuidIdentityDtoSchema, z.number().check(z.int())), {}),
      equippedItems: z
        .array(
          z.strictObject({
            itemInstanceId: projectionIdentifierSchema,
            equipmentDefinitionId: projectionIdentifierSchema,
            properties: z.array(equipmentPropertyCodeSchema).check(z.maxLength(64))
          })
        )
        .check(z.maxLength(500))
    })
    .check(
      z.superRefine((value, context) => {
        const itemIds = new Set<string>()
        for (const [index, item] of value.equippedItems.entries()) {
          if (itemIds.has(item.itemInstanceId)) {
            context.addIssue({
              code: 'custom',
              path: ['equippedItems', index, 'itemInstanceId'],
              message: 'Initiative item facts must use unique item instances.'
            })
          }
          itemIds.add(item.itemInstanceId)
          if (
            item.properties.some(
              (property, propertyIndex) =>
                propertyIndex > 0 && item.properties[propertyIndex - 1]! >= property
            )
          ) {
            context.addIssue({
              code: 'custom',
              path: ['equippedItems', index, 'properties'],
              message: 'Initiative item property codes must be unique and sorted.'
            })
          }
        }
        if (
          value.equippedItems.some(
            (item, index) =>
              index > 0 && value.equippedItems[index - 1]!.itemInstanceId >= item.itemInstanceId
          )
        ) {
          context.addIssue({
            code: 'custom',
            path: ['equippedItems'],
            message: 'Initiative item facts must use ascending item identity order.'
          })
        }
      })
    )
)
export type CharacterInitiativeActorFacts = z.infer<typeof characterInitiativeActorFactsSchema>
