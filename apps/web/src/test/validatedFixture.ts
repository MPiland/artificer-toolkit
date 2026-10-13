/**
 * Runs a fixture through its shared DTO schema and returns it unchanged, so the literal keeps its
 * narrow type (a discriminated-union member, a command subset) while a contract change still fails.
 * Curried so the schema fixes the contextual type before the literal is inferred.
 */
export function validated<Output>(schema: { parse(value: unknown): Output }) {
  return <Value extends Output>(value: Value): Value => {
    schema.parse(value)
    return value
  }
}
