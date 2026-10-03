import { readFile, stat, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// ADR 0036 P02.3: Builder byte budgets measured from the native Convex execution log of the
// `builder-browser` proof. Same unit as the convex-test budget tests: 1 KB = 1024 bytes.
const KB = 1024
// D84: commit is 450 KB for one Class and 200 KB more for each further distinct Class.
const budgets = {
  autosaveBytes: 32 * KB,
  commitBytes: { firstClass: 450 * KB, eachFurtherClass: 200 * KB },
  fullBuildBytes: 1500 * KB
}
const commitBudget = (classCount) =>
  budgets.commitBytes.firstClass + (classCount - 1) * budgets.commitBytes.eachFurtherClass

const root = fileURLToPath(new URL('..', import.meta.url))
const proofDirectory = 'local-validation/local-convex-proofs'
const journeysPath = `${proofDirectory}/phase82-builder-browser/builder-journeys.json`

// An execution fails when its `error` is set (`success` is always null in the native log). Failures
// inside a journey window always fail the proof. Outside the windows only authentication denials
// are expected: a stale or missing identity (`Unauthenticated`) or a rejected invitation
// redemption in the fixture sign-in; anything else fails.
const expectedAuthenticationNegative = /Unauthenticated|Invalid or expired invitation/

const isSuccessful = (execution, identifier) =>
  execution.identifier === identifier && execution.error == null
const databaseIo = (execution) =>
  execution.usageStats.databaseIoReadBytes + execution.usageStats.databaseIoWriteBytes
const describeFailure = (execution) => ({
  identifier: execution.identifier,
  error: String(execution.error).split('\n')[0].slice(0, 160)
})

export async function verifyBuilderBudgets(proofName) {
  const stem = `${proofDirectory}/${proofName}`
  const [metadata, journeys, journeysFile, log] = await Promise.all([
    readFile(resolve(root, `${stem}.metadata.json`), 'utf8').then(JSON.parse),
    readFile(resolve(root, journeysPath), 'utf8').then(JSON.parse),
    stat(resolve(root, journeysPath)),
    readFile(resolve(root, `${stem}.native-executions.jsonl`), 'utf8')
  ])
  const failures = []
  const startedAt = Date.parse(metadata.startedAtUtc)
  const completedAt = Date.parse(metadata.completedAtUtc)
  if (journeysFile.mtimeMs < startedAt || journeysFile.mtimeMs > completedAt) {
    throw new Error(`${journeysPath} was not written during proof ${proofName}.`)
  }

  const executions = log
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((execution) => execution.kind === 'Completion')
    .sort((a, b) => a.timestamp - b.timestamp)

  // Host and container clocks are not aligned, so journeys are partitioned by log order only. A
  // journey starts at the first create after the previous commit: the dev server's StrictMode
  // replays the mount effect, so the idempotent create runs twice and both stay in the window.
  const starts = []
  const ends = []
  for (let index = 0; index < executions.length; index += 1) {
    const open = starts.length > ends.length
    if (!open && isSuccessful(executions[index], 'characters/drafts:create')) starts.push(index)
    else if (open && isSuccessful(executions[index], 'characters/commit:commit')) ends.push(index)
  }
  if (starts.length !== journeys.length || ends.length !== starts.length) {
    throw new Error(
      `Expected ${journeys.length} Builder journeys (create then commit) in ${proofName}; found ${starts.length} started and ${ends.length} committed.`
    )
  }

  const windows = starts.map((start, index) => executions.slice(start, ends[index] + 1))
  const results = windows.map((window, index) => {
    const { journey, classCount, editPhase } = journeys[index]
    const saves = window.filter((execution) => isSuccessful(execution, 'characters/drafts:save'))
    const autosaveBytes = saves.map(databaseIo)
    const executionCounts = {}
    for (const execution of window)
      executionCounts[execution.identifier] = (executionCounts[execution.identifier] ?? 0) + 1
    const result = {
      journey,
      classCount,
      editPhase,
      autosave: {
        count: saves.length,
        maxBytes: Math.max(0, ...autosaveBytes),
        bytes: autosaveBytes
      },
      commitBytes: databaseIo(window.at(-1)),
      fullBuildBytes: window.reduce((total, execution) => total + databaseIo(execution), 0),
      executionCounts,
      failedExecutions: window.filter((execution) => execution.error != null).map(describeFailure)
    }
    if (editPhase.otherCalls.length > 0)
      failures.push(
        `${journey}: ${editPhase.otherCalls.length} Convex calls during edits besides autosave and token refresh.`
      )
    if (result.autosave.maxBytes > budgets.autosaveBytes)
      failures.push(
        `${journey}: autosave ${result.autosave.maxBytes} B exceeds ${budgets.autosaveBytes} B.`
      )
    if (result.commitBytes > commitBudget(classCount))
      failures.push(
        `${journey}: commit ${result.commitBytes} B exceeds ${commitBudget(classCount)} B for ${classCount} Classes.`
      )
    if (result.fullBuildBytes > budgets.fullBuildBytes)
      failures.push(
        `${journey}: full build ${result.fullBuildBytes} B exceeds ${budgets.fullBuildBytes} B.`
      )
    if (result.failedExecutions.length > 0)
      failures.push(
        `${journey}: ${result.failedExecutions.length} failed executions inside the journey.`
      )
    return result
  })

  const inWindow = new Set(windows.flat())
  const failedOutsideWindows = executions
    .filter((execution) => execution.error != null && !inWindow.has(execution))
    .map((execution) => ({
      ...describeFailure(execution),
      expected: expectedAuthenticationNegative.test(execution.error)
    }))
  const unexpected = failedOutsideWindows.filter((failure) => !failure.expected)
  if (unexpected.length > 0)
    failures.push(
      `${unexpected.length} failed executions outside the journeys are not authentication denials: ${[...new Set(unexpected.map((failure) => failure.identifier))].join(', ')}.`
    )

  const summary = {
    proofName,
    unit: 'bytes of Convex database I/O (read + write); 1 KB = 1024 bytes',
    budgets,
    journeys: results,
    failedOutsideWindows,
    verdict: failures.length === 0 ? 'passed' : 'failed',
    failures
  }
  await writeFile(resolve(root, `${stem}.builder-budgets.json`), JSON.stringify(summary, null, 2))
  if (failures.length > 0)
    throw new Error(`Builder budgets failed for ${proofName}:\n${failures.join('\n')}`)
  return summary
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const proofName = process.argv[2]
  if (!proofName) {
    console.error('Usage: node scripts/builderBudgets.mjs <proofName>')
    process.exit(2)
  }
  try {
    const summary = await verifyBuilderBudgets(proofName)
    for (const journey of summary.journeys)
      console.log(
        `${journey.journey}: autosave max ${journey.autosave.maxBytes} B (${journey.autosave.count}), commit ${journey.commitBytes} B, full build ${journey.fullBuildBytes} B`
      )
    console.log(
      `Builder budgets passed; ${summary.failedOutsideWindows.length} expected negatives.`
    )
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}
