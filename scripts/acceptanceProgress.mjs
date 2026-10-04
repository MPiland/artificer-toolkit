#!/usr/bin/env node
// Reports Phase 8.2 acceptance progress and work slices, and validates both files' structure.
// Usage: node scripts/acceptanceProgress.mjs [--json]
// The --json report is the progress dashboard's data.json; it adds a burn-up history from the
// ledger's git log.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const ledgerPath = fileURLToPath(
  new URL('../docs/roadmap/08-2-convex-cutover-acceptance.json', import.meta.url)
)
const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'))
const workPath = fileURLToPath(new URL('../docs/roadmap/08-2-work-slices.json', import.meta.url))
const work = JSON.parse(readFileSync(workPath, 'utf8'))
const openSliceStates = ['remaining', 'active', 'integrating', 'waiting']
const statuses = ledger.statusVocabulary ?? []
const accepted = 'ACCEPTED'
// D80: a slice is done once its criteria are READY_FOR_ACCEPTANCE; only earlier states need an owner.
const closedCriterionStates = ['READY_FOR_ACCEPTANCE', accepted]

const validate = () => {
  const errors = []
  const caseIds = new Set()
  const criterionIds = new Set()
  if (!Array.isArray(ledger.statusVocabulary) || !statuses.includes(accepted)) {
    errors.push(`statusVocabulary must be an array that includes ${accepted}`)
  }
  if (typeof ledger.denominatorPolicy !== 'string' || ledger.denominatorPolicy.length === 0) {
    errors.push('denominatorPolicy is missing')
  }
  const cases = (ledger.gates ?? []).flatMap((gate) => {
    if (!Array.isArray(gate.cases) || gate.cases.length !== gate.total) {
      errors.push(`Gate ${gate.id} total ${gate.total} does not match its case count`)
    }
    return gate.cases ?? []
  })
  if (cases.length !== ledger.fixedTotal) {
    errors.push(`Ledger has ${cases.length} cases; fixedTotal is ${ledger.fixedTotal}`)
  }
  for (const kase of cases) {
    if (caseIds.has(kase.id)) errors.push(`Duplicate case id ${kase.id}`)
    caseIds.add(kase.id)
    if (!statuses.includes(kase.status)) errors.push(`${kase.id} has invalid status ${kase.status}`)
    if (!Array.isArray(kase.criteria) || kase.criteria.length === 0) {
      errors.push(`${kase.id} has no criteria`)
      continue
    }
    for (const criterion of kase.criteria) {
      const label = `${kase.id} criterion ${criterion.id}`
      if (typeof criterion.id !== 'string' || !criterion.id.startsWith(`${kase.id}.`)) {
        errors.push(`${label} must be prefixed with "${kase.id}."`)
      }
      if (criterionIds.has(criterion.id)) errors.push(`Duplicate criterion id ${criterion.id}`)
      criterionIds.add(criterion.id)
      if (typeof criterion.text !== 'string' || criterion.text.trim().length === 0) {
        errors.push(`${label} has no text`)
      }
      if (!statuses.includes(criterion.status)) {
        errors.push(`${label} has invalid status ${criterion.status}`)
      }
      const validProof =
        criterion.proof === null ||
        (Array.isArray(criterion.proof) &&
          criterion.proof.length > 0 &&
          criterion.proof.every((item) => typeof item === 'string' && item.length > 0))
      if (!validProof) errors.push(`${label} proof must be null or a non-empty string array`)
    }
    if (
      kase.status === accepted &&
      kase.criteria.some((criterion) => criterion.status !== accepted)
    ) {
      errors.push(`${kase.id} is ${accepted} but has criteria that are not ${accepted}`)
    }
  }
  return errors
}

const validateWork = (caseIds, criteria) => {
  const errors = []
  const criterionOwners = new Map()
  const includedBy = new Map()
  const states = work.stateVocabulary ?? []
  const streamIds = new Set((work.streams ?? []).map((stream) => stream.id))
  const slices = new Map()
  for (const slice of work.slices ?? []) {
    if (slices.has(slice.id)) errors.push(`Duplicate slice id ${slice.id}`)
    slices.set(slice.id, slice)
    if (!streamIds.has(slice.stream)) errors.push(`${slice.id} has unknown stream ${slice.stream}`)
    if (!slice.id.startsWith(`${slice.stream}-`)) {
      errors.push(`${slice.id} must be prefixed with its stream "${slice.stream}-"`)
    }
    if (!states.includes(slice.state)) errors.push(`${slice.id} has invalid state ${slice.state}`)
    if (typeof slice.title !== 'string' || slice.title.trim().length === 0) {
      errors.push(`${slice.id} has no title`)
    }
    for (const id of slice.cases ?? []) {
      if (!caseIds.has(id)) errors.push(`${slice.id} references unknown case ${id}`)
    }
    for (const id of slice.criteria ?? []) {
      const criterion = criteria.get(id)
      if (!criterion) errors.push(`${slice.id} references unknown criterion ${id}`)
      else if (!slice.cases.includes(criterion.caseId)) {
        errors.push(`${slice.id} closes ${id} but does not list case ${criterion.caseId}`)
      }
      if (openSliceStates.includes(slice.state)) {
        criterionOwners.set(id, [...(criterionOwners.get(id) ?? []), slice.id])
      }
    }
    for (const id of slice.includes ?? []) {
      includedBy.set(id, [...(includedBy.get(id) ?? []), slice.id])
    }
  }
  for (const [id, owners] of includedBy) {
    if (!slices.has(id)) errors.push(`${owners.join(', ')} include unknown slice ${id}`)
    if (owners.length > 1) errors.push(`${id} is included by more than one slice: ${owners.join(', ')}`)
  }
  for (const [id, criterion] of criteria) {
    const owners = criterionOwners.get(id) ?? []
    if (!closedCriterionStates.includes(criterion.status) && owners.length !== 1) {
      errors.push(`Open criterion ${id} must be closed by exactly one open slice (has ${owners.length})`)
    }
  }
  for (const slice of slices.values()) {
    const scheduled = work.queue.includes(slice.id) || includedBy.has(slice.id)
    if (openSliceStates.includes(slice.state) && !scheduled) {
      errors.push(`Open slice ${slice.id} is neither queued nor included by a queued slice`)
    }
  }
  if (new Set(work.queue).size !== work.queue.length) errors.push('Queue repeats a slice')
  for (const id of work.queue ?? []) {
    const slice = slices.get(id)
    if (!slice) errors.push(`Queue references unknown slice ${id}`)
    else if (!openSliceStates.includes(slice.state)) {
      errors.push(`Queue slice ${id} is ${slice.state}, not open`)
    }
  }
  // Parallel slices are allowed only when they close disjoint acceptance cases. An active slice
  // inside an active parent is the parent's own work, so it is compared with its siblings only.
  const activeCases = new Map()
  for (const slice of slices.values()) {
    if (slice.state !== 'active') continue
    const scope = (includedBy.get(slice.id) ?? []).find((id) => slices.get(id)?.state === 'active') ?? ''
    for (const caseId of slice.cases ?? []) {
      const key = `${scope}:${caseId}`
      if (activeCases.has(key)) {
        errors.push(`Active slices ${activeCases.get(key)} and ${slice.id} share case ${caseId}`)
      } else activeCases.set(key, slice.id)
    }
  }
  return errors
}

const countByStatus = (items) =>
  Object.fromEntries(
    statuses.map((status) => [status, items.filter((item) => item.status === status).length])
  )

const errors = validate()
if (errors.length === 0) {
  errors.push(
    ...validateWork(
      new Set(ledger.gates.flatMap((gate) => gate.cases.map((kase) => kase.id))),
      new Map(
        ledger.gates.flatMap((gate) =>
          gate.cases.flatMap((kase) =>
            kase.criteria.map((criterion) => [
              criterion.id,
              { caseId: kase.id, status: criterion.status }
            ])
          )
        )
      )
    )
  )
}
if (errors.length > 0) {
  console.error(`Invalid acceptance ledger or work slices (${ledgerPath}, ${workPath}):`)
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

const allCases = ledger.gates.flatMap((gate) => gate.cases)
const allCriteria = allCases.flatMap((kase) => kase.criteria)
const report = {
  generatedAt: new Date().toISOString(),
  phase: ledger.phase,
  fixedTotal: ledger.fixedTotal,
  cases: countByStatus(allCases),
  criteria: { total: allCriteria.length, ...countByStatus(allCriteria) },
  gates: ledger.gates.map((gate) => {
    const gateCriteria = gate.cases.flatMap((kase) => kase.criteria)
    return {
      id: gate.id,
      title: gate.title,
      total: gate.total,
      cases: countByStatus(gate.cases),
      criteria: { total: gateCriteria.length, ...countByStatus(gateCriteria) },
      caseProgress: gate.cases.map((kase) => ({
        id: kase.id,
        title: kase.title,
        proofTier: kase.proofTier,
        status: kase.status,
        met: kase.criteria.filter((criterion) => criterion.status === accepted).length,
        total: kase.criteria.length,
        criteria: kase.criteria.map(({ id, status, text }) => ({ id, status, text }))
      }))
    }
  }),
  openCases: allCases
    .filter((kase) => kase.status !== accepted)
    .map((kase) => ({
      id: kase.id,
      title: kase.title,
      status: kase.status,
      openCriteria: kase.criteria
        .filter((criterion) => criterion.status !== accepted)
        .map(({ id, status, text }) => ({ id, status, text }))
    })),
  work: {
    stateMeaning: work.stateMeaning,
    streams: work.streams,
    queue: work.queue,
    slices: work.slices,
    metrics: work.metrics
  }
}

// Burn-up points: criterion status counts at every commit that changed the ledger, oldest first.
const readHistory = () => {
  const git = (args) =>
    execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim()
  const ledgerRelative = 'docs/roadmap/08-2-convex-cutover-acceptance.json'
  return git(['log', '--reverse', '--format=%H %cI', '--', ledgerRelative])
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [commit, date] = line.split(' ')
      const snapshot = JSON.parse(git(['show', `${commit}:${ledgerRelative}`]))
      const criteria = (snapshot.gates ?? []).flatMap((gate) =>
        (gate.cases ?? []).flatMap((kase) => kase.criteria ?? [])
      )
      return { commit: commit.slice(0, 9), date, total: criteria.length, ...countByStatus(criteria) }
    })
    // Ledger versions before the per-criterion shape have no criteria to count.
    .filter((point) => point.total > 0)
    .concat({ commit: 'working', date: report.generatedAt, ...report.criteria })
}

if (process.argv.includes('--json')) {
  process.stdout.write(`${JSON.stringify({ ...report, history: readHistory() }, null, 2)}\n`)
  process.exit(0)
}

const formatCounts = (counts) =>
  statuses
    .filter((status) => counts[status] > 0)
    .map((status) => `${status} ${counts[status]}`)
    .join(', ')

const lines = [
  `Phase ${report.phase} acceptance: ${report.cases[accepted]}/${report.fixedTotal} cases accepted; ` +
    `${report.criteria[accepted]}/${report.criteria.total} criteria accepted`,
  `Cases: ${formatCounts(report.cases)}`,
  `Criteria: ${formatCounts(report.criteria)}`,
  '',
  'Per gate:',
  ...report.gates.map(
    (gate) =>
      `  Gate ${gate.id} ${gate.title}: cases ${gate.cases[accepted]}/${gate.total} (${formatCounts(gate.cases)}); ` +
      `criteria ${gate.criteria[accepted]}/${gate.criteria.total} (${formatCounts(gate.criteria)})`
  ),
  '',
  'Per case (criteria met/total):',
  ...report.gates.map(
    (gate) =>
      `  Gate ${gate.id}: ` +
      gate.caseProgress
        .map(
          ({ id, status, met, total }) => `${id} ${met}/${total}${status === accepted ? '' : '*'}`
        )
        .join('  ')
  ),
  '  (* case not accepted)',
  '',
  'Queue (scheduled open slices, the criteria each closes and the slices it includes):',
  ...work.queue.flatMap((id) => {
    const slice = work.slices.find((item) => item.id === id)
    return [
      `  ${slice.id} [${slice.state}] ${slice.title}`,
      `    closes: ${(slice.criteria ?? []).join(' ') || 'none'}`,
      `    includes: ${(slice.includes ?? []).join(' ') || 'none'}`
    ]
  }),
  '',
  `Open cases (${report.openCases.length}):`,
  ...report.openCases.flatMap((kase) => [
    `  ${kase.id} [${kase.status}] ${kase.title}`,
    ...kase.openCriteria.map(
      (criterion) => `    ${criterion.id} [${criterion.status}] ${criterion.text}`
    )
  ])
]
console.log(lines.join('\n'))
