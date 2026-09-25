#!/usr/bin/env node
// Reports Phase 8.2 acceptance progress from the JSON ledger and validates its structure.
// Usage: node scripts/acceptanceProgress.mjs [--json]
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const ledgerPath = fileURLToPath(
  new URL('../docs/roadmap/08-2-convex-cutover-acceptance.json', import.meta.url)
)
const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'))
const statuses = ledger.statusVocabulary ?? []
const accepted = 'ACCEPTED'

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

const countByStatus = (items) =>
  Object.fromEntries(
    statuses.map((status) => [status, items.filter((item) => item.status === status).length])
  )

const errors = validate()
if (errors.length > 0) {
  console.error(`Invalid acceptance ledger (${ledgerPath}):`)
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

const allCases = ledger.gates.flatMap((gate) => gate.cases)
const allCriteria = allCases.flatMap((kase) => kase.criteria)
const report = {
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
        status: kase.status,
        met: kase.criteria.filter((criterion) => criterion.status === accepted).length,
        total: kase.criteria.length
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
    }))
}

if (process.argv.includes('--json')) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
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
  `Open cases (${report.openCases.length}):`,
  ...report.openCases.flatMap((kase) => [
    `  ${kase.id} [${kase.status}] ${kase.title}`,
    ...kase.openCriteria.map(
      (criterion) => `    ${criterion.id} [${criterion.status}] ${criterion.text}`
    )
  ])
]
console.log(lines.join('\n'))
