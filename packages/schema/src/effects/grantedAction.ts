import { z, lazySchema } from '../zod.js'
import { activationCodeSchema } from '../shared/enums.js'
import {
  authoredIdentifierSchema,
  authoredReferenceCollectionSchema
} from '../shared/authoredLimits.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'

/** The most granted actions one held effect offers. */
const MAX_GRANTED_ACTIONS = 4
/** The most uses a granted action may allow in one turn. */
const MAX_GRANTED_ACTION_USES_PER_TURN = 10

export interface GrantedAction {
  activation: z.infer<typeof activationCodeSchema>
  usesPerTurn?: number
  actionDefinitionIds: string[]
  weaponAttack?: boolean
}

/**
 * One offer of a held effect (D160): the holder may take the named basic actions, and a weapon attack
 * when `weaponAttack`, charged to `activation`. A `FREE` offer spends no allowance, only its own
 * `usesPerTurn`, which everything it offers shares. A Reaction cannot be granted this way.
 */
function grantedActionSchema(
  actionDefinitionId: z.ZodMiniType<string>
): z.ZodMiniType<GrantedAction> {
  return z
    .strictObject({
      activation: activationCodeSchema,
      usesPerTurn: z.optional(
        z.number().check(z.int()).check(z.gte(1)).check(z.lte(MAX_GRANTED_ACTION_USES_PER_TURN))
      ),
      actionDefinitionIds: authoredReferenceCollectionSchema(actionDefinitionId),
      weaponAttack: z.optional(z.boolean())
    })
    .check(
      z.refine(
        (offer) =>
          offer.activation !== 'REACTION' &&
          (offer.activation !== 'FREE' || offer.usesPerTurn !== undefined) &&
          (offer.actionDefinitionIds.length > 0 || offer.weaponAttack === true),
        {
          message:
            'A granted action offers at least one action, is not a Reaction, and a FREE one states its uses per turn.'
        }
      )
    )
}

/** The offers as authored on a result block's lifecycle. */
export const grantedActionsDtoSchema = lazySchema(() =>
  z
    .array(grantedActionSchema(authoredIdentifierSchema))
    .check(z.minLength(1))
    .check(z.maxLength(MAX_GRANTED_ACTIONS))
)

/** The offers frozen onto a stored effect, naming the catalogue's basic actions by id. */
export const storedGrantedActionsSchema = lazySchema(() =>
  z
    .array(grantedActionSchema(postgresUuidSchema))
    .check(z.minLength(1))
    .check(z.maxLength(MAX_GRANTED_ACTIONS))
)
