import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// D85 / ADR 0035 Decision 9 and Amendment 9: live-play cost measured from the V15 run. Inputs are
// the native Convex execution log written by scripts/runLocalConvexProof.ps1 and the room meter's
// totals from its development-only read (`GET /internal/live-sessions/meter/<campaignId>`).
const MB = 1024 * 1024

// Q16 (docs/handoffs/phase-08-2-decisions.md): 100 Free users, 20 of them hosting four 4-hour
// sessions a month, with 50% headroom against the free allowances.
const SESSIONS_PER_MONTH = 20 * 4
const DAYS_PER_MONTH = 30
const HEADROOM = 1.5
const sessionsPerDay = SESSIONS_PER_MONTH / DAYS_PER_MONTH
const perSessionFromDaily = (limit) => limit / HEADROOM / sessionsPerDay
const perSessionFromMonthly = (limit) => limit / HEADROOM / SESSIONS_PER_MONTH

const budgets = {
  // docs/roadmap/tier-research-2026-09-27.md:137-143: 1 GB/month of Convex database I/O, about
  // 683 MB usable with headroom, half to live play: about 341 MB / 80 sessions = 4.3 MB per session.
  convexIoBytesPerSession: 4.3 * MB,
  // Same table: 1M function calls a month, about 667k usable, over 80 sessions.
  convexCallsPerSession: perSessionFromMonthly(1_000_000),
  // ADR 0035 Amendment 9 (Decision 9), Workers Free Durable Objects, per day: 100,000 requests,
  // 13,000 GB-s, 5M rows read and 100,000 rows written; WebSocket messages count 20:1. Divided by
  // the Q16 session rate (80 sessions a month, about 2.7 a day) with the same 50% headroom.
  durableObjectRequestsPerSession: perSessionFromDaily(100_000),
  durableObjectGbSecondsPerSession: perSessionFromDaily(13_000),
  durableObjectRowsReadPerSession: perSessionFromDaily(5_000_000),
  durableObjectRowsWrittenPerSession: perSessionFromDaily(100_000)
}
const WEBSOCKET_MESSAGES_PER_REQUEST = 20
// A Durable Object bills duration at its 128 MB memory limit.
const DURABLE_OBJECT_GB = 128 / 1024

const root = fileURLToPath(new URL('..', import.meta.url))
const executionsSuffix = '.native-executions.jsonl'

// Convex functions the room and its Worker routes call, by what they are for.
const classes = {
  checkpointIngestion: new Set([
    'liveSessions/checkpoint:publish',
    'liveSessions/checkpointStaging:begin',
    'liveSessions/checkpointStaging:part',
    'liveSessions/checkpointStaging:commit'
  ]),
  authRefresh: new Set(['liveSessions/roomAuthorization:read', 'liveSessions/transientCapture:capture']),
  lifecycle: new Set([
    'liveSessions/bootstrap:bootstrap',
    'liveSessions/state:activate',
    'liveSessions/authority:recoverStorage',
    'liveSessions/authority:beginDrain',
    'liveSessions/authority:release',
    'liveSessions/roomInputs:read',
    'scenes/presentations:setFromRoom'
  ])
}
const livePlayClasses = Object.keys(classes)
const classOf = (identifier) =>
  livePlayClasses.find((name) => classes[name].has(identifier)) ?? 'other'

const isSuccessful = (execution, identifier) =>
  execution.identifier === identifier && execution.error == null
const readBytes = (execution) => execution.usageStats.databaseIoReadBytes
const writeBytes = (execution) => execution.usageStats.databaseIoWriteBytes

function tally(executions) {
  const byFunction = {}
  const byClass = {}
  for (const execution of executions) {
    const identifier = execution.identifier
    const name = classOf(identifier)
    for (const [table, key] of [
      [byFunction, identifier],
      [byClass, name]
    ]) {
      const row = (table[key] ??= { calls: 0, readBytes: 0, writeBytes: 0 })
      row.calls += 1
      row.readBytes += readBytes(execution)
      row.writeBytes += writeBytes(execution)
    }
  }
  return { byFunction, byClass }
}

const livePlayTotals = (byClass) =>
  livePlayClasses.reduce(
    (total, name) => ({
      calls: total.calls + (byClass[name]?.calls ?? 0),
      ioBytes: total.ioBytes + (byClass[name]?.readBytes ?? 0) + (byClass[name]?.writeBytes ?? 0)
    }),
    { calls: 0, ioBytes: 0 }
  )

/**
 * A session runs from its bootstrap to its release. The command loop is what follows the last
 * activation call until the drain begins: ADR 0035 expects it to make only checkpoint ingestion and
 * authorization refresh calls. The container clock is not the host's, so both are partitioned by log
 * order alone.
 */
function convexSessions(executions, failures) {
  const sessions = []
  let open = null
  for (const execution of executions) {
    if (!open && isSuccessful(execution, 'liveSessions/bootstrap:bootstrap')) open = []
    if (!open) continue
    open.push(execution)
    if (isSuccessful(execution, 'liveSessions/authority:release')) {
      sessions.push(open)
      open = null
    }
  }
  if (open) failures.push('The native log ends inside a session that never released.')
  if (sessions.length === 0) failures.push('The native log holds no complete live session.')
  return sessions.map((session, index) => {
    const { byFunction, byClass } = tally(session)
    const total = livePlayTotals(byClass)
    const lastActivation = session.findLastIndex((execution) =>
      isSuccessful(execution, 'liveSessions/state:activate')
    )
    const drain = session.findIndex((execution) =>
      isSuccessful(execution, 'liveSessions/authority:beginDrain')
    )
    const loop = session.slice(lastActivation + 1, drain === -1 ? undefined : drain)
    const result = {
      session: index + 1,
      livePlayCalls: total.calls,
      livePlayIoBytes: total.ioBytes,
      byClass,
      byFunction,
      commandLoop: { executions: loop.length, byClass: tally(loop).byClass },
      failedExecutions: session.filter((execution) => execution.error != null).length
    }
    if (total.ioBytes > budgets.convexIoBytesPerSession)
      failures.push(
        `Convex session ${index + 1}: ${total.ioBytes} B of live-play I/O exceeds ${Math.round(budgets.convexIoBytesPerSession)} B.`
      )
    if (total.calls > budgets.convexCallsPerSession)
      failures.push(
        `Convex session ${index + 1}: ${total.calls} live-play calls exceed ${Math.round(budgets.convexCallsPerSession)}.`
      )
    return result
  })
}

const sum = (rows, pick) => rows.reduce((total, row) => total + pick(row), 0)

function roomSessions(meter, failures) {
  const released = meter.released.filter((totals) => totals.endedAt !== null)
  if (released.length === 0) failures.push('The room meter file holds no released epoch.')
  return released.map((totals, index) => {
    const checkpoints = Object.entries(totals.checkpoints)
    const requestsBilled =
      totals.requests.HTTP +
      totals.requests.ALARM +
      Math.ceil(totals.requests.WEBSOCKET_MESSAGE / WEBSOCKET_MESSAGES_PER_REQUEST)
    // startedAt is the room's construction or its previous release, so this assumes the object never
    // hibernates; the active figure counts only command and checkpoint handling.
    const residentSeconds = (totals.endedAt - totals.startedAt) / 1000
    const activeSeconds = (totals.commands.wallMs + sum(checkpoints, ([, row]) => row.wallMs)) / 1000
    const result = {
      session: index + 1,
      epoch: totals.epoch,
      durableObject: {
        requests: totals.requests,
        requestsBilled,
        rowsRead: totals.sql.rowsRead,
        rowsWritten: totals.sql.rowsWritten,
        estimatedGbSecondsResident: residentSeconds * DURABLE_OBJECT_GB,
        estimatedGbSecondsActive: activeSeconds * DURABLE_OBJECT_GB
      },
      commands: totals.commands,
      checkpointsByReason: totals.checkpoints,
      checkpointTotals: {
        count: sum(checkpoints, ([, row]) => row.count),
        payloadBytes: sum(checkpoints, ([, row]) => row.payloadBytes),
        convexIoBytes: sum(
          checkpoints,
          ([, row]) => row.convex.bytesRead + row.convex.bytesWritten
        )
      },
      sockets: {
        admissions: totals.admissions,
        peakSocketsPerMember: totals.peakSocketsPerMember,
        peakSockets: Math.max(0, ...totals.peakSocketsPerMember),
        messagesByType: totals.messagesByType,
        framesByType: totals.framesByType,
        framesTotal: sum(Object.values(totals.framesByType), (count) => count)
      }
    }
    for (const [label, value, limit] of [
      ['requests', requestsBilled, budgets.durableObjectRequestsPerSession],
      ['rows read', totals.sql.rowsRead, budgets.durableObjectRowsReadPerSession],
      ['rows written', totals.sql.rowsWritten, budgets.durableObjectRowsWrittenPerSession],
      [
        'GB-s (resident)',
        result.durableObject.estimatedGbSecondsResident,
        budgets.durableObjectGbSecondsPerSession
      ]
    ])
      if (value > limit)
        failures.push(`Room session ${index + 1}: ${label} ${value} exceed ${Math.round(limit)}.`)
    return result
  })
}

export async function verifyV15Budgets(executionsPath, meterPath) {
  const [log, meter] = await Promise.all([
    readFile(resolve(root, executionsPath), 'utf8'),
    readFile(resolve(root, meterPath), 'utf8').then(JSON.parse)
  ])
  const executions = log
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((execution) => execution.kind === 'Completion')
    .sort((a, b) => a.timestamp - b.timestamp)
  const failures = []
  const summary = {
    executionsPath,
    meterPath,
    unit: 'bytes of Convex database I/O (read + write); 1 MB = 1024 * 1024 bytes',
    budgets,
    convexSessions: convexSessions(executions, failures),
    roomSessions: roomSessions(meter, failures),
    verdict: 'passed',
    failures
  }
  if (failures.length > 0) summary.verdict = 'failed'
  const outputPath = executionsPath.endsWith(executionsSuffix)
    ? `${executionsPath.slice(0, -executionsSuffix.length)}.v15-budgets.json`
    : `${executionsPath}.v15-budgets.json`
  await writeFile(resolve(root, outputPath), JSON.stringify(summary, null, 2))
  return { summary, outputPath }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [executionsPath, meterPath] = process.argv.slice(2)
  if (!executionsPath || !meterPath) {
    console.error(
      'Usage: node scripts/v15Budgets.mjs <proof>.native-executions.jsonl <room-meter-totals>.json'
    )
    process.exit(2)
  }
  try {
    const { summary, outputPath } = await verifyV15Budgets(executionsPath, meterPath)
    for (const session of summary.convexSessions)
      console.log(
        `Convex session ${session.session}: ${session.livePlayIoBytes} B live-play I/O in ${session.livePlayCalls} calls (ingestion ${session.byClass.checkpointIngestion?.calls ?? 0}, auth ${session.byClass.authRefresh?.calls ?? 0}, lifecycle ${session.byClass.lifecycle?.calls ?? 0}); command loop ${session.commandLoop.executions} executions.`
      )
    for (const session of summary.roomSessions)
      console.log(
        `Room session ${session.session}: ${session.durableObject.requestsBilled} billed requests, ${session.durableObject.rowsRead} rows read, ${session.durableObject.rowsWritten} written, about ${session.durableObject.estimatedGbSecondsResident.toFixed(0)} GB-s; ${session.sockets.admissions} admissions, peak ${session.sockets.peakSockets} sockets per member, ${session.sockets.framesTotal} frames.`
      )
    console.log(`Summary written to ${outputPath}.`)
    if (summary.failures.length > 0) {
      console.error(`V15 budgets failed:\n${summary.failures.join('\n')}`)
      process.exit(1)
    }
    console.log('V15 budgets passed.')
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}
