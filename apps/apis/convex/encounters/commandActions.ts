'use node'

import { makeFunctionReference } from 'convex/server'
import type { Validator } from 'convex/values'
import type { z } from 'zod'
import { zodToConvex } from 'convex-helpers/server/zod4'
import {
  encounterExecuteInputSchema,
  encounterCommandResultDtoSchema,
  type EncounterExecuteInput,
  type EncounterCommandResultDto,
  type ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import type { SceneGeometryBeginResult } from '@artificer-toolkit/schema/api/sceneGeometry'
import { internalAction, type ActionCtx } from '../_generated/server'
import { completeSceneGeometry } from '../scenes/geometryActions'

const beginResponse = makeFunctionReference<
  'mutation',
  ResolveRuleOccurrenceInputDto,
  SceneGeometryBeginResult | null
>('scenes/movementResolutionStaging:begin')
const responseResult = makeFunctionReference<
  'query',
  ResolveRuleOccurrenceInputDto,
  EncounterCommandResultDto
>('scenes/movementResolutionReads:result')
const executeCommand = makeFunctionReference<
  'mutation',
  EncounterExecuteInput,
  EncounterCommandResultDto
>('encounters/commands:execute')

const inputValidator: Validator<EncounterExecuteInput, 'required', string> = zodToConvex<
  z.core.$ZodType<EncounterExecuteInput>
>(encounterExecuteInputSchema)
const resultValidator: Validator<EncounterCommandResultDto, 'required', string> = zodToConvex<
  z.core.$ZodType<EncounterCommandResultDto>
>(encounterCommandResultDtoSchema)

/** Internal: browsers reach Encounter commands only through the Session room. */
export const execute = internalAction({
  args: inputValidator,
  returns: resultValidator,
  handler: (ctx, args): Promise<EncounterCommandResultDto> =>
    executeNativeEncounterCommand(ctx, encounterExecuteInputSchema.parse(args))
})

/** Runs one native Encounter command as the caller's identity, staging movement responses first. */
export async function executeNativeEncounterCommand(
  ctx: Pick<ActionCtx, 'runQuery' | 'runMutation'>,
  input: EncounterExecuteInput
): Promise<EncounterCommandResultDto> {
  if (input.command.type === 'RESOLVE_RULE_OCCURRENCE') {
    const begin = await ctx.runMutation(beginResponse, input.command)
    if (begin) {
      if (begin.kind === 'READY') await completeSceneGeometry(ctx, begin)
      return ctx.runQuery(responseResult, input.command)
    }
  }
  return ctx.runMutation(executeCommand, input)
}
