import { readFile, stat, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// D85 / ADR 0035 Decision 9 and Amendment 9: live-play cost measured from the V15 run. Inputs are
// what the `v15-workload` proof leaves behind: the native Convex execution log and metadata written
// by scripts/runLocalConvexProof.ps1, and `v15-room-evidence.json` from the driver, which holds the
// room meter's totals around each measured window (the meter is read from the Worker's
// development-only route) and the per-document sizes of what a checkpoint wrote.
const MB = 1024 * 1024

// Q16 (docs/handoffs/phase-08-2-decisions.md): 100 Free users, 20 of them hosting four 4-hour
// sessions a month, with 50% headroom against the free allowances.
const SESSIONS_PER_MONTH = 20 * 4
const SESSION_HOURS = 4
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
  durableObjectRowsWrittenPerSession: perSessionFromDaily(100_000),
  // Convex stores a document of at most 1 MiB; a checkpoint document keeps the same headroom.
  convexDocumentBytes: MB / HEADROOM
}
const WEBSOCKET_MESSAGES_PER_REQUEST = 20
// A Durable Object bills duration at its 128 MB memory limit.
const DURABLE_OBJECT_GB = 128 / 1024
// The room arms a save timer on any unsaved change; a paced window longer than it must see it fire.
const DEADLINE_SECONDS = 120

const root = fileURLToPath(new URL('..', import.meta.url))
const proofDirectory = 'local-validation/local-convex-proofs'

// The dev-only no-op mutations the driver calls to open and close each measured window.
const windowMarkers = {
  open: 'liveSessions/developmentMeasurement:openWindow',
  close: 'liveSessions/developmentMeasurement:closeWindow'
}
const windowNames = ['combat', 'outOfCombat']

// Convex functions the room and its Worker routes call, by what they are for.
const classes = {
  checkpointIngestion: new Set([
    'liveSessions/checkpoint:publish',
    'liveSessions/checkpointStaging:begin',
    'liveSessions/checkpointStaging:part',
    'liveSessions/checkpointStaging:commit'
  ]),
  authRefresh: new Set([
    'liveSessions/roomAuthorization:read',
    'liveSessions/transientCapture:capture'
  ]),
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
const authHttp = /^(GET|POST) \/api\/auth\//
// What may reach Convex while a window is measured: the room's checkpoints and authorization
// refresh, and the sign-in token refresh the driver and the browsers make. No command does.
const toleratedClasses = new Set(['checkpointIngestion', 'authRefresh', 'authHttp'])
const classOf = (identifier) =>
  authHttp.test(identifier)
    ? 'authHttp'
    : (livePlayClasses.find((name) => classes[name].has(identifier)) ?? 'other')

const isMarker = (execution) => Object.values(windowMarkers).includes(execution.identifier)
const isSuccessful = (execution, identifier) =>
  execution.identifier === identifier && execution.error == null
const databaseIo = (execution) =>
  execution.usageStats.databaseIoReadBytes + execution.usageStats.databaseIoWriteBytes

const sum = (rows, pick) => rows.reduce((total, row) => total + pick(row), 0)
const billedRequests = (requests) =>
  requests.HTTP +
  requests.ALARM +
  Math.ceil(requests.WEBSOCKET_MESSAGE / WEBSOCKET_MESSAGES_PER_REQUEST)

function tally(executions) {
  const byFunction = {}
  const byClass = {}
  for (const execution of executions) {
    for (const [table, key] of [
      [byFunction, execution.identifier],
      [byClass, classOf(execution.identifier)]
    ]) {
      const row = (table[key] ??= { calls: 0, ioBytes: 0 })
      row.calls += 1
      row.ioBytes += databaseIo(execution)
    }
  }
  return { byFunction, byClass }
}

/**
 * The executions between each pair of window markers, by log order alone: the container's clock is
 * not the host's. The driver opens and closes the combat window, then the out-of-combat window.
 */
function measuredWindows(executions, failures) {
  const marks = executions.flatMap((execution, index) =>
    isMarker(execution) && execution.error == null ? [{ index, marker: execution.identifier }] : []
  )
  const expected = windowNames.flatMap(() => [windowMarkers.open, windowMarkers.close])
  if (marks.length !== expected.length || marks.some(({ marker }, i) => marker !== expected[i])) {
    failures.push(
      `Expected ${expected.length} window markers (open, close for each of ${windowNames.join(', ')}); the native log holds ${marks.length}.`
    )
    return null
  }
  return windowNames.map((name, i) => ({
    name,
    executions: executions.slice(marks[2 * i].index + 1, marks[2 * i + 1].index)
  }))
}

/** What reached Convex inside one window, and whether anything but tolerated traffic did. */
function auditWindow({ name, executions }, strict, failures) {
  const { byFunction, byClass } = tally(executions)
  const untolerated = executions.filter(
    (execution) => !toleratedClasses.has(classOf(execution.identifier))
  )
  const failed = executions.filter((execution) => execution.error != null)
  if (strict && untolerated.length > 0)
    failures.push(
      `${name}: ${untolerated.length} Convex calls reached Convex during the window besides checkpoints, authorization refresh and sign-in: ${[...new Set(untolerated.map((execution) => execution.identifier))].join(', ')}.`
    )
  if (failed.length > 0)
    failures.push(
      `${name}: ${failed.length} failed executions inside the window: ${[...new Set(failed.map((execution) => execution.identifier))].join(', ')}.`
    )
  return {
    name,
    calls: executions.length,
    ioBytes: sum(executions, databaseIo),
    byClass,
    byFunction,
    unToleratedCalls: untolerated.length
  }
}

const ioBytes = (counters) => (counters?.bytesRead ?? 0) + (counters?.bytesWritten ?? 0)

/** One room's totals between two meter reads, as the Worker's cumulative counters differ. */
function diffTotals(before, after) {
  const checkpoints = {}
  for (const [reason, row] of Object.entries(after.checkpoints)) {
    const prior = before.checkpoints[reason]
    checkpoints[reason] = {
      count: row.count - (prior?.count ?? 0),
      requests: row.requests - (prior?.requests ?? 0),
      payloadBytes: row.payloadBytes - (prior?.payloadBytes ?? 0),
      wallMs: row.wallMs - (prior?.wallMs ?? 0),
      convexIoBytes: ioBytes(row.convex) - ioBytes(prior?.convex),
      // Read plus written bytes by checkpoint section (A35-S10a).
      sectionIoBytes: Object.fromEntries(
        Object.entries(row.convex.sections).map(([section, counters]) => [
          section,
          ioBytes(counters) - ioBytes(prior?.convex.sections[section])
        ])
      )
    }
  }
  return {
    requests: Object.fromEntries(
      Object.entries(after.requests).map(([kind, count]) => [kind, count - before.requests[kind]])
    ),
    rowsRead: after.sql.rowsRead - before.sql.rowsRead,
    rowsWritten: after.sql.rowsWritten - before.sql.rowsWritten,
    commands: after.commands.count - before.commands.count,
    commandWallMs: after.commands.wallMs - before.commands.wallMs,
    frames:
      sum(Object.values(after.framesByType), (n) => n) -
      sum(Object.values(before.framesByType), (n) => n),
    checkpoints
  }
}

/** The meter's change over one window, summed over the rooms the driver read. */
function windowMeter(meters, label, failures) {
  const deltas = Object.entries(meters.before).map(([aggregate, { meter: before }]) => {
    const after = meters.after[aggregate].meter
    if (after.released.length !== before.released.length)
      failures.push(`${label}: the ${aggregate} room released its epoch inside the window.`)
    return diffTotals(before.current, after.current)
  })
  const checkpoints = {}
  for (const delta of deltas)
    for (const [reason, row] of Object.entries(delta.checkpoints)) {
      const total = (checkpoints[reason] ??= {
        count: 0,
        requests: 0,
        payloadBytes: 0,
        wallMs: 0,
        convexIoBytes: 0,
        sectionIoBytes: {}
      })
      for (const key of ['count', 'requests', 'payloadBytes', 'wallMs', 'convexIoBytes'])
        total[key] += row[key]
      for (const [section, bytes] of Object.entries(row.sectionIoBytes))
        total.sectionIoBytes[section] = (total.sectionIoBytes[section] ?? 0) + bytes
    }
  const requests = { HTTP: 0, ALARM: 0, WEBSOCKET_MESSAGE: 0 }
  for (const delta of deltas)
    for (const kind of Object.keys(requests)) requests[kind] += delta.requests[kind]
  const total = {
    requests,
    requestsBilled: billedRequests(requests),
    rowsRead: sum(deltas, (delta) => delta.rowsRead),
    rowsWritten: sum(deltas, (delta) => delta.rowsWritten),
    commands: sum(deltas, (delta) => delta.commands),
    commandWallMs: sum(deltas, (delta) => delta.commandWallMs),
    frames: sum(deltas, (delta) => delta.frames),
    checkpoints
  }
  total.activeSeconds =
    (total.commandWallMs + sum(Object.values(checkpoints), (row) => row.wallMs)) / 1000
  return total
}

/** Convex documents a checkpoint writes: the largest must fit the document limit with headroom. */
function documentSizes(documents, failures) {
  const largest = { table: null, maxBytes: 0 }
  for (const [aggregate, tables] of Object.entries(documents))
    for (const [table, row] of Object.entries(tables))
      if (row.maxBytes > largest.maxBytes) {
        largest.table = `${aggregate}.${table}`
        largest.maxBytes = row.maxBytes
      }
  if (largest.maxBytes > budgets.convexDocumentBytes)
    failures.push(
      `Checkpoint document ${largest.table}: ${largest.maxBytes} B exceeds ${Math.round(budgets.convexDocumentBytes)} B.`
    )
  return { largest, byAggregate: documents }
}

/**
 * A session is one room's bootstrap; the proof's two aggregates are two sessions, so the live-play
 * classes (checkpoint ingestion, authorization refresh, lifecycle) are averaged over them.
 */
function convexPerSession(executions, failures) {
  const sessions = executions.filter((execution) =>
    isSuccessful(execution, 'liveSessions/bootstrap:bootstrap')
  ).length
  if (sessions === 0) {
    failures.push('The native log holds no live session bootstrap.')
    return null
  }
  const { byClass } = tally(executions)
  const live = livePlayClasses.map((name) => byClass[name] ?? { calls: 0, ioBytes: 0 })
  const perSession = {
    sessions,
    calls: sum(live, (row) => row.calls) / sessions,
    ioBytes: sum(live, (row) => row.ioBytes) / sessions,
    lifecycle: {
      calls: (byClass.lifecycle?.calls ?? 0) / sessions,
      ioBytes: (byClass.lifecycle?.ioBytes ?? 0) / sessions
    },
    byClass
  }
  if (perSession.ioBytes > budgets.convexIoBytesPerSession)
    failures.push(
      `Convex: ${Math.round(perSession.ioBytes)} B of live-play I/O per session exceeds ${Math.round(budgets.convexIoBytesPerSession)} B.`
    )
  if (perSession.calls > budgets.convexCallsPerSession)
    failures.push(
      `Convex: ${Math.round(perSession.calls)} live-play calls per session exceed ${Math.round(budgets.convexCallsPerSession)}.`
    )
  return perSession
}

const perUnit = (total, units) => ({
  convexCalls: total.convexCalls / units,
  convexIoBytes: total.convexIoBytes / units,
  requestsBilled: total.meter.requestsBilled / units,
  rowsRead: total.meter.rowsRead / units,
  rowsWritten: total.meter.rowsWritten / units,
  activeSeconds: total.meter.activeSeconds / units
})

const assumption = (name) => {
  const raw = process.env[name]
  if (raw === undefined || raw === '') return null
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0)
    throw new Error(`${name} must be a non-negative number.`)
  return value
}

/**
 * A session estimate from the measured unit costs. Its two quantities, commands and paced
 * out-of-combat minutes per session, are assumptions the user sets (V15_ESTIMATE_COMBAT_COMMANDS,
 * V15_ESTIMATE_OOC_MINUTES): the proof does not know how a table plays, so without them the estimate
 * is not made and does not decide the verdict. Session length defaults to Q16's four hours.
 */
function sessionEstimate(unitCosts, perSession, failures) {
  const commands = assumption('V15_ESTIMATE_COMBAT_COMMANDS')
  const minutes = assumption('V15_ESTIMATE_OOC_MINUTES')
  const hours = assumption('V15_ESTIMATE_SESSION_HOURS') ?? SESSION_HOURS
  if (commands === null || minutes === null || perSession === null)
    return {
      status: 'NOT_ASSESSED',
      reason:
        'Set V15_ESTIMATE_COMBAT_COMMANDS and V15_ESTIMATE_OOC_MINUTES; they are assumptions about how a table plays, not measurements.'
    }
  const { combat, outOfCombatPerMinute } = unitCosts
  const estimate = {
    convexCalls:
      perSession.lifecycle.calls +
      commands * combat.convexCalls +
      minutes * outOfCombatPerMinute.convexCalls,
    convexIoBytes:
      perSession.lifecycle.ioBytes +
      commands * combat.convexIoBytes +
      minutes * outOfCombatPerMinute.convexIoBytes,
    durableObjectRequests:
      commands * combat.requestsBilled + minutes * outOfCombatPerMinute.requestsBilled,
    durableObjectRowsRead: commands * combat.rowsRead + minutes * outOfCombatPerMinute.rowsRead,
    durableObjectRowsWritten:
      commands * combat.rowsWritten + minutes * outOfCombatPerMinute.rowsWritten,
    durableObjectGbSecondsResident: hours * 3600 * DURABLE_OBJECT_GB
  }
  for (const [label, value, limit] of [
    ['Convex calls', estimate.convexCalls, budgets.convexCallsPerSession],
    ['Convex I/O bytes', estimate.convexIoBytes, budgets.convexIoBytesPerSession],
    [
      'Durable Object requests',
      estimate.durableObjectRequests,
      budgets.durableObjectRequestsPerSession
    ],
    [
      'Durable Object rows read',
      estimate.durableObjectRowsRead,
      budgets.durableObjectRowsReadPerSession
    ],
    [
      'Durable Object rows written',
      estimate.durableObjectRowsWritten,
      budgets.durableObjectRowsWrittenPerSession
    ],
    [
      'Durable Object GB-s (resident)',
      estimate.durableObjectGbSecondsResident,
      budgets.durableObjectGbSecondsPerSession
    ]
  ])
    if (value > limit)
      failures.push(`Session estimate: ${label} ${Math.round(value)} exceed ${Math.round(limit)}.`)
  return {
    status: 'ASSESSED',
    assumptions: {
      combatCommandsPerSession: commands,
      outOfCombatMinutesPerSession: minutes,
      sessionHours: hours
    },
    estimate
  }
}

export async function verifyV15Budgets(proofName) {
  const stem = `${proofDirectory}/${proofName}`
  const evidencePath = `${stem}.evidence/v15-room-evidence.json`
  const [metadata, evidence, evidenceFile, log] = await Promise.all([
    readFile(resolve(root, `${stem}.metadata.json`), 'utf8').then(JSON.parse),
    readFile(resolve(root, evidencePath), 'utf8').then(JSON.parse),
    stat(resolve(root, evidencePath)),
    readFile(resolve(root, `${stem}.native-executions.jsonl`), 'utf8')
  ])
  const startedAt = Date.parse(metadata.startedAtUtc)
  const completedAt = Date.parse(metadata.completedAtUtc)
  if (evidenceFile.mtimeMs < startedAt || evidenceFile.mtimeMs > completedAt)
    throw new Error(`${evidencePath} was not written during proof ${proofName}.`)

  const executions = log
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((execution) => execution.kind === 'Completion')
    .sort((a, b) => a.timestamp - b.timestamp)
  const failures = []
  const windows = measuredWindows(executions, failures)
  const { combat, outOfCombat } = evidence
  const audits = windows
    ? windows.map((window) =>
        auditWindow(
          window,
          // The out-of-combat browsers are real clients with Convex queries of their own; only a run
          // without them can promise that nothing but the room reached Convex.
          window.name === 'combat' || outOfCombat.browser === null,
          failures
        )
      )
    : []
  const combatMeter = windowMeter(combat.meters, 'combat', failures)
  const outOfCombatMeter = windowMeter(outOfCombat.meters, 'outOfCombat', failures)
  const [combatAudit, outOfCombatAudit] = audits
  if (combatMeter.commands === 0) failures.push('combat: the room counted no commands.')
  const outOfCombatMinutes = outOfCombat.durationMs / 60_000
  if (
    outOfCombat.durationMs / 1000 > DEADLINE_SECONDS &&
    (outOfCombatMeter.checkpoints.DEADLINE?.count ?? 0) === 0
  )
    failures.push(
      `outOfCombat: a ${Math.round(outOfCombat.durationMs / 1000)} s paced window saw no DEADLINE checkpoint; the ${DEADLINE_SECONDS} s timer did not fire.`
    )

  const unitCosts =
    combatAudit && outOfCombatAudit && combatMeter.commands > 0
      ? {
          combat: perUnit(
            {
              convexCalls: combatAudit.calls,
              convexIoBytes: combatAudit.ioBytes,
              meter: combatMeter
            },
            combatMeter.commands
          ),
          outOfCombatPerMinute: perUnit(
            {
              convexCalls: outOfCombatAudit.calls,
              convexIoBytes: outOfCombatAudit.ioBytes,
              meter: outOfCombatMeter
            },
            outOfCombatMinutes
          ),
          checkpointsByReason: Object.fromEntries(
            Object.keys({ ...combatMeter.checkpoints, ...outOfCombatMeter.checkpoints }).map(
              (reason) => {
                const rows = [combatMeter, outOfCombatMeter].flatMap(
                  ({ checkpoints }) => checkpoints[reason] ?? []
                )
                const count = sum(rows, (row) => row.count)
                return [
                  reason,
                  {
                    count,
                    payloadBytesEach:
                      count === 0 ? 0 : sum(rows, (row) => row.payloadBytes) / count,
                    convexIoBytesEach:
                      count === 0 ? 0 : sum(rows, (row) => row.convexIoBytes) / count,
                    sectionIoBytesEach: Object.fromEntries(
                      [...new Set(rows.flatMap((row) => Object.keys(row.sectionIoBytes)))].map(
                        (section) => [
                          section,
                          count === 0
                            ? 0
                            : sum(rows, (row) => row.sectionIoBytes[section] ?? 0) / count
                        ]
                      )
                    )
                  }
                ]
              }
            )
          )
        }
      : null
  const perSession = convexPerSession(executions, failures)
  const summary = {
    proofName,
    unit: 'bytes of Convex database I/O (read + write); 1 MB = 1024 * 1024 bytes',
    budgets,
    windows: {
      combat: { ...combatAudit, meter: combatMeter },
      outOfCombat: { ...outOfCombatAudit, meter: outOfCombatMeter }
    },
    unitCosts,
    convexPerSession: perSession,
    documents: documentSizes(combat.documents, failures),
    sessionEstimate: unitCosts
      ? sessionEstimate(unitCosts, perSession, failures)
      : { status: 'NOT_ASSESSED', reason: 'The measured windows were incomplete.' },
    barriers: combat.barriers,
    verdict: 'passed',
    failures
  }
  if (failures.length > 0) summary.verdict = 'failed'
  const outputPath = `${stem}.v15-budgets.json`
  await writeFile(resolve(root, outputPath), JSON.stringify(summary, null, 2))
  if (failures.length > 0)
    throw new Error(`V15 budgets failed for ${proofName}:\n${failures.join('\n')}`)
  return summary
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const proofName = process.argv[2]
  if (!proofName) {
    console.error('Usage: node scripts/v15Budgets.mjs <proofName>')
    process.exit(2)
  }
  try {
    const summary = await verifyV15Budgets(proofName)
    for (const name of windowNames) {
      const window = summary.windows[name]
      console.log(
        `${name}: ${window.calls} Convex calls (${window.unToleratedCalls} outside checkpoints, authorization and sign-in), ${window.meter.commands} room commands, ${window.meter.requestsBilled} billed Durable Object requests, ${window.meter.rowsRead} rows read, ${window.meter.rowsWritten} written.`
      )
    }
    console.log(
      `Largest checkpoint document: ${summary.documents.largest.maxBytes} B (${summary.documents.largest.table}). Session estimate: ${summary.sessionEstimate.status}.`
    )
    console.log('V15 budgets passed.')
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}
