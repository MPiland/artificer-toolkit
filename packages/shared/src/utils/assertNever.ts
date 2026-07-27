export function assertNever(x: never, message?: string): never {
  throw new Error(message ?? `Unhandled discriminated union member: ${JSON.stringify(x)}`)
}
