import { getFunctionName } from 'convex/server'
import type { QueryCtx } from '../../convex/_generated/server'

/**
 * Query context that refuses a `runQuery` into an app function: that hop evaluates a second module
 * graph and repeats validation, identity and authority. Identity still reads the Better Auth
 * component, so only app functions are refused.
 */
export function inOwnTransaction(ctx: QueryCtx, db: QueryCtx['db'] = ctx.db) {
  return {
    ...ctx,
    db,
    runQuery: ((reference, ...args) => {
      // `getFunctionName` names this app's functions and refuses component references.
      let appQuery: string | null = null
      try {
        appQuery = getFunctionName(reference)
      } catch {
        appQuery = null
      }
      if (appQuery !== null)
        throw new Error(`The page reads in the public query transaction, not ${appQuery}.`)
      return ctx.runQuery(reference, ...args)
    }) satisfies QueryCtx['runQuery']
  } as QueryCtx
}

/** A registered function's handler, run in the caller's transaction (a mutation's takes `MutationCtx`). */
export function handlerOf<Result, Ctx = QueryCtx>(
  registered: object
): (ctx: Ctx, args: unknown) => Promise<Result> {
  if (!('_handler' in registered) || typeof registered._handler !== 'function')
    throw new Error('Missing registered query handler.')
  return registered._handler as (ctx: Ctx, args: unknown) => Promise<Result>
}
