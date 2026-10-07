import type { FunctionReference, FunctionReturnType, OptionalRestArgs } from 'convex/server'
import type { DevelopmentClient } from '../developmentClient'
import type { RoomCaller } from './localRoomWorker'

/**
 * A development proof client that runs every query and mutation in the convex-test caller's own
 * transaction. It serves proofs that never reach a room (Convex data and Convex-only commands);
 * a proof that sends Encounter commands, Scene bindings or Sheet commands to a held Run uses
 * `roomDevelopmentClient` instead, so the real room answers.
 */
export function convexDevelopmentClient(caller: RoomCaller): DevelopmentClient {
  return {
    query: (reference, ...args) => caller.run((ctx) => ctx.runQuery(reference, ...args)),
    mutation: <Reference extends FunctionReference<'mutation'>>(
      reference: Reference,
      ...args: OptionalRestArgs<Reference>
    ): Promise<FunctionReturnType<Reference>> =>
      caller.run((ctx) => ctx.runMutation(reference, ...args))
  }
}
