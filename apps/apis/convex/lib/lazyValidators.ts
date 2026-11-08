import type {
  ArgsArrayForOptionalValidator,
  ArgsArrayToObject,
  DefaultArgsForOptionalValidator,
  DefaultFunctionArgs,
  FunctionVisibility,
  RegisteredMutation,
  RegisteredQuery,
  ReturnValueForOptionalValidator
} from 'convex/server'
import type { GenericValidator, PropertyValidators } from 'convex/values'

type Handler<Ctx> = (ctx: Ctx, ...args: never) => unknown

type Registered<
  Kind extends 'query' | 'mutation',
  Visibility extends FunctionVisibility,
  Args extends DefaultFunctionArgs,
  Returns
> = Kind extends 'query'
  ? RegisteredQuery<Visibility, Args, Returns>
  : RegisteredMutation<Visibility, Args, Returns>

function builtOnFirstRead(build: (() => unknown) | undefined): PropertyDescriptor {
  let built: { value: unknown } | undefined
  return { enumerable: true, get: () => build && (built ??= { value: build() }).value }
}

/**
 * A Convex function builder that builds `args` and `returns` validators on first read. Convex reads
 * them only when it exports a function's validators (at push and analysis, and in convex-test), and
 * the backend checks arguments and return values against that export. Convex evaluates a module on
 * every call (D59), so validators built at module top level would be rebuilt by every call (PERF-6).
 * Every handler passes through `wrapHandler`.
 */
export function withLazyValidators<
  Kind extends 'query' | 'mutation',
  Ctx,
  Visibility extends FunctionVisibility
>(
  register: (definition: { handler: Handler<Ctx> }) => unknown,
  wrapHandler: (handler: Handler<Ctx>) => Handler<Ctx>
) {
  // Convex's own builder signature, with `args` and `returns` given as thunks.
  return <
    ArgsValidator extends PropertyValidators | GenericValidator | void,
    ReturnsValidator extends PropertyValidators | GenericValidator | void,
    ReturnValue extends ReturnValueForOptionalValidator<ReturnsValidator>,
    OneOrZeroArgs extends ArgsArrayForOptionalValidator<ArgsValidator> =
      DefaultArgsForOptionalValidator<ArgsValidator>
  >(definition: {
    args?: () => ArgsValidator
    returns?: () => ReturnsValidator
    handler: (ctx: Ctx, ...args: OneOrZeroArgs) => ReturnValue
  }) =>
    // Convex registers the function its own builder would type from the same definition.
    register(
      Object.defineProperties(
        { handler: wrapHandler(definition.handler) },
        { args: builtOnFirstRead(definition.args), returns: builtOnFirstRead(definition.returns) }
      )
    ) as Registered<Kind, Visibility, ArgsArrayToObject<OneOrZeroArgs>, ReturnValue>
}
