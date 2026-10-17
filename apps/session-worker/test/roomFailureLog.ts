import { beforeEach } from 'vitest'

/**
 * A room failure reaches its member only as a generic refusal such as UNAVAILABLE; the room logs the
 * cause with `console.error`. The tests and the room share one isolate, so this setup file keeps what
 * the room logged during each test and adds it to that test's failure. Production output is unchanged.
 */
const logged: unknown[][] = []

/** What `console.error` received during the current test, one argument list per call. */
export const roomFailureLog = (): readonly unknown[][] => logged

const describeArgument = (value: unknown) =>
  value instanceof Error
    ? (value.stack ?? `${value.name}: ${value.message}`)
    : typeof value === 'string'
      ? value
      : JSON.stringify(value)

beforeEach(({ onTestFailed }) => {
  logged.length = 0
  const log = console.error
  console.error = (...args: unknown[]) => {
    logged.push(args)
    log(...args)
  }
  onTestFailed(({ task }) => {
    if (logged.length === 0) return
    task.result?.errors?.push({
      name: 'RoomFailureLog',
      message: `The room logged ${logged.length} failure(s) during this test:\n${logged
        .map((args) => args.map(describeArgument).join(' '))
        .join('\n')}`
    })
  })
  return () => {
    console.error = log
  }
})
