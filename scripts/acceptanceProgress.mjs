#!/usr/bin/env node
// Reports Phase 8 progress from the single agile ledger and validates its structure.
// Usage: node scripts/acceptanceProgress.mjs [--json]
// The --json report is the progress dashboard's data.json; it adds a burn-up history from the
// ledger's git log. Every open PBI carries a WSJF score; the report ranks open work by it.
// Validation errors go to stderr and exit 1; the report is still printed.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const ledgerRelative = 'docs/roadmap/08-phase-ledger.json'
const repoRoot = fileURLToPath(new URL('../', import.meta.url))
const ledger = JSON.parse(
  readFileSync(fileURLToPath(new URL(`../${ledgerRelative}`, import.meta.url)), 'utf8')
)

const workStatuses = ['TODO', 'IN_PROGRESS', 'DONE']
const uatStatuses = ['NOT_RUN', 'PASSED', 'FAILED']
const journeyStatuses = ['verified', 'partial', 'none']
const wsjfPoints = [1, 2, 3, 5, 8, 13, 20]
const historyCap = 200

const count = (items, predicate) => items.filter(predicate).length
const hasProof = (ac) =>
  Array.isArray(ac.proof) &&
  ac.proof.length > 0 &&
  ac.proof.every((item) => typeof item === 'string' && item.length > 0)

// An absent journeyStatus is derived from whether the PBI lists any journey tests.
const journeyStatusOf = (pbi) =>
  pbi.journeyStatus ?? ((pbi.journeyTests ?? []).length === 0 ? 'none' : 'partial')

const isPbiProven = (pbi) =>
  pbi.acs.length > 0 &&
  pbi.acs.every((ac) => ac.status === 'DONE' && hasProof(ac)) &&
  journeyStatusOf(pbi) === 'verified'

// Every feature needs accepted UAT to be DONE; built features without it are UAT_READY.
const featureStatus = (feature) => {
  const { pbis, uat = [] } = feature
  if (pbis.every((pbi) => pbi.status === 'DONE') && (pbis.length > 0 || uat.length > 0)) {
    return uat.length > 0 && uat.every((item) => item.status === 'PASSED') ? 'DONE' : 'UAT_READY'
  }
  const started =
    pbis.some((pbi) => pbi.status !== 'TODO' || pbi.acs.some((ac) => ac.status !== 'TODO')) ||
    uat.some((item) => item.status !== 'NOT_RUN')
  return started ? 'IN_PROGRESS' : 'TODO'
}

// Stable Kahn ordering: ledger order among features whose dependencies are already placed.
// Features on a cycle are appended last so reporting still works; validation reports the cycle.
const dependencyOrder = (features) => {
  const byId = new Map(features.map((feature) => [feature.id, feature]))
  const placed = new Set()
  const ordered = []
  let progressed = true
  while (progressed) {
    progressed = false
    for (const feature of features) {
      if (placed.has(feature.id)) continue
      if ((feature.dependsOn ?? []).every((id) => placed.has(id) || !byId.has(id))) {
        placed.add(feature.id)
        ordered.push(feature)
        progressed = true
      }
    }
  }
  return {
    ordered: [...ordered, ...features.filter((feature) => !placed.has(feature.id))],
    cyclic: features.filter((feature) => !placed.has(feature.id))
  }
}

// WSJF = (business value + time criticality + risk reduction or enablement) / job size.
const wsjfScore = ({ bv, tc, rr, size }) => Math.round(((bv + tc + rr) / size) * 100) / 100

const validateWsjf = (id, wsjf, errors) => {
  if (wsjf === undefined) {
    errors.push(`${id} is open without a wsjf score`)
    return
  }
  for (const key of ['bv', 'tc', 'rr', 'size']) {
    if (!wsjfPoints.includes(wsjf[key]))
      errors.push(`${id} wsjf.${key} must be one of ${wsjfPoints.join(', ')}`)
  }
  if (wsjf.after !== undefined && !Array.isArray(wsjf.after))
    errors.push(`${id} wsjf.after must be a list of PBI or task ids`)
  if (wsjf.finalSource !== undefined && wsjf.finalSource !== true)
    errors.push(`${id} wsjf.finalSource may only be true`)
}

const workItemStatuses = (features) =>
  new Map(
    features.flatMap((feature) =>
      feature.pbis.flatMap((pbi) => [
        [pbi.id, pbi.status],
        ...(pbi.tasks ?? []).map((task) => [task.id, task.status])
      ])
    )
  )

// Open work in pull order: scored open tasks rank on their own, and a PBI ranks while it has an
// open AC that no scored open task closes. No item ranks before the open work it waits on (a
// waited-on PBI includes its open tasks), and waited-on work takes the priority of the highest-scored
// work it unblocks. Final-source gate items follow everything else; items on a cycle are appended.
const rankWork = (features) => {
  const items = scoredOpenWork(features)
  const prerequisites = new Map(
    items.map((item) => [
      item,
      items.filter(
        (other) =>
          other !== item &&
          item.waitingOn.some((id) => other.id === id || other.id.startsWith(`${id}.T`))
      )
    ])
  )
  const dependents = new Map(
    items.map((item) => [item, items.filter((other) => prerequisites.get(other).includes(item))])
  )
  const priorities = new Map()
  const priority = (item, path = new Set()) => {
    if (priorities.has(item)) return priorities.get(item)
    if (path.has(item)) return item.score
    const value = Math.max(
      item.score,
      ...dependents.get(item).map((other) => priority(other, new Set([...path, item])))
    )
    priorities.set(item, value)
    return value
  }
  const pullFirst = (a, b) =>
    Number(a.wsjf.finalSource === true) - Number(b.wsjf.finalSource === true) ||
    priority(b) - priority(a) ||
    b.score - a.score ||
    items.indexOf(a) - items.indexOf(b)
  const ordered = []
  const remaining = new Set(items)
  for (;;) {
    const next = [...remaining]
      .filter((item) => prerequisites.get(item).every((other) => !remaining.has(other)))
      .sort(pullFirst)[0]
    if (!next) break
    ordered.push(next)
    remaining.delete(next)
  }
  const describe = (item, dependencyCycle) => ({
    ...item,
    priority: priority(item),
    unblocks: dependents.get(item).map((other) => other.id),
    dependencyCycle
  })
  return [
    ...ordered.map((item) => describe(item, false)),
    ...[...remaining].sort(pullFirst).map((item) => describe(item, true))
  ]
}

const scoredOpenWork = (features) => {
  const statuses = workItemStatuses(features)
  const toItem = (feature, { id, wsjf, activeWorkbook, merging }, title) => ({
    id,
    feature: feature.id,
    title,
    score: wsjfScore(wsjf),
    wsjf,
    activeWorkbook: activeWorkbook ?? null,
    merging: merging ?? null,
    waitingOn: (wsjf.after ?? []).filter((after) => statuses.get(after) !== 'DONE')
  })
  return features.flatMap((feature) =>
    feature.pbis
      .filter((pbi) => pbi.status !== 'DONE' && pbi.wsjf !== undefined)
      .flatMap((pbi) => {
        const scoredTasks = (pbi.tasks ?? []).filter(
          (task) => task.status !== 'DONE' && task.wsjf !== undefined
        )
        const closedByTasks = new Set(scoredTasks.flatMap((task) => task.closes))
        const pbiStillRanks = pbi.acs.some(
          (ac) => ac.status !== 'DONE' && !closedByTasks.has(ac.id)
        )
        return [
          ...(pbiStillRanks || scoredTasks.length === 0 ? [toItem(feature, pbi, pbi.title)] : []),
          ...scoredTasks.map((task) => toItem(feature, task, task.text))
        ]
      })
  )
}

const addUnique = (seen, id, kind, errors) => {
  if (seen.has(id)) errors.push(`Duplicate ${kind} id ${id}`)
  seen.add(id)
}

const validatePbi = (pbi, seen, errors) => {
  addUnique(seen.pbis, pbi.id, 'PBI', errors)
  if (!workStatuses.includes(pbi.status)) errors.push(`${pbi.id} has invalid status ${pbi.status}`)
  const journey = journeyStatusOf(pbi)
  if (!journeyStatuses.includes(journey))
    errors.push(`${pbi.id} has invalid journeyStatus ${journey}`)
  for (const path of pbi.journeyTests ?? []) {
    if (!existsSync(`${repoRoot}${path}`)) errors.push(`${pbi.id} journey test not found: ${path}`)
  }
  if (!Array.isArray(pbi.acs) || pbi.acs.length === 0) {
    errors.push(`${pbi.id} has no acceptance criteria`)
    return
  }
  for (const ac of pbi.acs) {
    addUnique(seen.acs, ac.id, 'AC', errors)
    if (typeof ac.id !== 'string' || !ac.id.startsWith(`${pbi.id}.`)) {
      errors.push(`${ac.id} must be prefixed with "${pbi.id}."`)
    }
    if (typeof ac.text !== 'string' || ac.text.trim().length === 0)
      errors.push(`${ac.id} has no text`)
    if (!workStatuses.includes(ac.status)) errors.push(`${ac.id} has invalid status ${ac.status}`)
    if (ac.status === 'DONE' && !hasProof(ac)) errors.push(`${ac.id} is DONE without proof`)
  }
  const acIds = new Set(pbi.acs.map((ac) => ac.id))
  for (const task of pbi.tasks ?? []) {
    if (typeof task.id !== 'string' || !task.id.startsWith(`${pbi.id}.T`))
      errors.push(`Task ${task.id} must be prefixed with "${pbi.id}.T"`)
    if (typeof task.text !== 'string' || task.text.trim().length === 0)
      errors.push(`${task.id} has no text`)
    if (!workStatuses.includes(task.status))
      errors.push(`${task.id} has invalid status ${task.status}`)
    if (!Array.isArray(task.closes) || task.closes.length === 0)
      errors.push(`${task.id} closes no acceptance criteria`)
    for (const id of task.closes ?? [])
      if (!acIds.has(id)) errors.push(`${task.id} closes ${id}, which is not an AC of ${pbi.id}`)
    if (task.wsjf !== undefined) validateWsjf(task.id, task.wsjf, errors)
  }
  // activeWorkbook marks an item a workbook session is working now; it is removed at merge.
  for (const item of [pbi, ...(pbi.tasks ?? [])].filter(
    (item) => item.activeWorkbook !== undefined
  )) {
    if (item.status === 'DONE') errors.push(`${item.id} is DONE but still has an activeWorkbook`)
    if (!existsSync(`${repoRoot}${item.activeWorkbook}`))
      errors.push(`${item.id} activeWorkbook not found: ${item.activeWorkbook}`)
  }
  // merging is the merge-slice run URL while a green item merges; mergedAt dates the merge once DONE.
  for (const item of [pbi, ...(pbi.tasks ?? [])]) {
    if (item.merging !== undefined) {
      if (item.status === 'DONE') errors.push(`${item.id} is DONE but still has merging`)
      if (!/^https:\/\/github\.com\/[^/]+\/[^/]+\/actions\/runs\/\d+$/.test(item.merging))
        errors.push(`${item.id} merging is not a workflow run URL: ${item.merging}`)
    }
    if (item.mergedAt !== undefined) {
      if (item.status !== 'DONE') errors.push(`${item.id} has mergedAt but is not DONE`)
      if (Number.isNaN(Date.parse(item.mergedAt)))
        errors.push(`${item.id} mergedAt is not a date: ${item.mergedAt}`)
    }
  }
  if (pbi.status !== 'DONE') validateWsjf(pbi.id, pbi.wsjf, errors)
  if (pbi.status === 'DONE' && !isPbiProven(pbi)) {
    errors.push(
      `${pbi.id} is DONE but breaks the definition of done (all ACs DONE with proof and journeyStatus verified)`
    )
  }
}

const validate = () => {
  const errors = []
  const seen = { features: new Set(), pbis: new Set(), acs: new Set() }
  const featureIds = new Set((ledger.features ?? []).map((feature) => feature.id))
  for (const feature of ledger.features ?? []) {
    addUnique(seen.features, feature.id, 'feature', errors)
    for (const id of feature.dependsOn ?? []) {
      if (!featureIds.has(id)) errors.push(`${feature.id} depends on unknown feature ${id}`)
    }
    for (const item of feature.uat ?? []) {
      if (!uatStatuses.includes(item.status))
        errors.push(`${item.id} has invalid UAT status ${item.status}`)
    }
    for (const pbi of feature.pbis ?? []) validatePbi(pbi, seen, errors)
  }
  const statuses = workItemStatuses(ledger.features ?? [])
  const scored = (ledger.features ?? [])
    .flatMap((feature) => feature.pbis ?? [])
    .flatMap((pbi) => [pbi, ...(pbi.tasks ?? [])])
  for (const item of scored) {
    for (const id of item.wsjf?.after ?? [])
      if (!statuses.has(id)) errors.push(`${item.id} wsjf.after names unknown work item ${id}`)
  }
  const workCycle = rankWork(ledger.features ?? []).filter((item) => item.dependencyCycle)
  if (workCycle.length > 0)
    errors.push(`Dependency cycle among work items: ${workCycle.map((item) => item.id).join(', ')}`)
  const { cyclic } = dependencyOrder(ledger.features ?? [])
  if (cyclic.length > 0)
    errors.push(
      `Dependency cycle among features: ${cyclic.map((feature) => feature.id).join(', ')}`
    )
  return errors
}

const buildReport = () => {
  const { ordered } = dependencyOrder(ledger.features)
  const statusById = new Map(ordered.map((feature) => [feature.id, featureStatus(feature)]))
  const features = ordered.map((feature) => {
    const pbis = feature.pbis.map((pbi) => ({
      id: pbi.id,
      title: pbi.title,
      status: pbi.status,
      journeyStatus: journeyStatusOf(pbi),
      journeyGap: pbi.journeyGap ?? null,
      journeyTests: pbi.journeyTests ?? [],
      acDone: count(pbi.acs, (ac) => ac.status === 'DONE'),
      acTotal: pbi.acs.length,
      acs: pbi.acs.map((ac) => ({
        id: ac.id,
        text: ac.text,
        status: ac.status,
        proof: ac.proof ?? null,
        note: ac.note ?? null
      })),
      tasks: pbi.tasks ?? []
    }))
    return {
      id: feature.id,
      title: feature.title,
      kind: feature.kind,
      dependsOn: feature.dependsOn ?? [],
      status: statusById.get(feature.id),
      readyToStart: (feature.dependsOn ?? []).every((id) =>
        ['DONE', 'UAT_READY'].includes(statusById.get(id))
      ),
      pbiDone: count(pbis, (pbi) => pbi.status === 'DONE'),
      pbiTotal: pbis.length,
      acDone: pbis.reduce((sum, pbi) => sum + pbi.acDone, 0),
      acTotal: pbis.reduce((sum, pbi) => sum + pbi.acTotal, 0),
      uat: feature.uat ?? [],
      pbis
    }
  })
  const allPbis = features.flatMap((feature) => feature.pbis)
  const journeyCount = (status) => count(allPbis, (pbi) => pbi.journeyStatus === status)
  return {
    generatedAt: new Date().toISOString(),
    title: ledger.title,
    definitionOfDone: ledger.definitionOfDone,
    totals: {
      features: features.length,
      pbis: allPbis.length,
      pbisDone: count(allPbis, (pbi) => pbi.status === 'DONE'),
      acs: features.reduce((sum, feature) => sum + feature.acTotal, 0),
      acsDone: features.reduce((sum, feature) => sum + feature.acDone, 0),
      journey: {
        verified: journeyCount('verified'),
        partial: journeyCount('partial'),
        none: journeyCount('none')
      }
    },
    features,
    ranking: rankWork(ordered),
    retired: ledger.retired ?? [],
    openQuestions: ledger.openQuestions ?? []
  }
}

// Burn-up points: PBI and AC counts at every commit that changed the ledger, oldest first.
const readHistory = () => {
  const git = (args) =>
    execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024
    }).trim()
  const toPoint = (commit, date) => {
    const snapshot = JSON.parse(git(['show', `${commit}:${ledgerRelative}`]))
    const pbis = (snapshot.features ?? []).flatMap((feature) => feature.pbis ?? [])
    const acs = pbis.flatMap((pbi) => pbi.acs ?? [])
    return {
      date,
      commit: commit.slice(0, 9),
      acsDone: count(acs, (ac) => ac.status === 'DONE'),
      acs: acs.length,
      pbisDone: count(pbis, (pbi) => pbi.status === 'DONE'),
      pbis: pbis.length
    }
  }
  return git(['log', '--reverse', '--format=%H %cI', '--', ledgerRelative])
    .split('\n')
    .filter(Boolean)
    .slice(-historyCap)
    .map((line) => toPoint(...line.split(' ')))
    .filter((point) => point.acs > 0)
}

const formatText = (report) => {
  const { totals } = report
  return [
    `${report.title}: ${totals.pbisDone}/${totals.pbis} PBIs done; ${totals.acsDone}/${totals.acs} ACs done`,
    `Journey tests: ${totals.journey.verified} verified, ${totals.journey.partial} partial, ` +
      `${totals.journey.none} none`,
    '',
    'Features in dependency order:',
    ...report.features.map((feature) => {
      const journey = (status) => count(feature.pbis, (pbi) => pbi.journeyStatus === status)
      const wait = ['DONE', 'UAT_READY'].includes(feature.status)
        ? ''
        : feature.readyToStart
          ? ' ready'
          : ' waiting'
      return (
        `  ${feature.id} [${feature.status}${wait}] ` +
        `PBIs ${feature.pbiDone}/${feature.pbiTotal}, ACs ${feature.acDone}/${feature.acTotal}, ` +
        `journey v${journey('verified')} p${journey('partial')} n${journey('none')}`
      )
    }),
    '',
    'Open work in pull order (WSJF after dependencies; final-source gate items last):',
    ...report.ranking.map(
      (item, index) =>
        `  ${String(index + 1).padStart(3)}. ${item.priority.toFixed(2)} ${item.id}` +
        `${item.priority !== item.score ? ` (own ${item.score.toFixed(2)})` : ''}` +
        `${item.wsjf.finalSource ? ' [final source]' : ''}` +
        `${item.waitingOn.length > 0 ? ` [waits on ${item.waitingOn.join(', ')}]` : ''}` +
        `${item.unblocks.length > 0 ? ` [unblocks ${item.unblocks.join(', ')}]` : ''} ${item.title}`
    )
  ].join('\n')
}

const errors = validate()
const report = buildReport()
if (process.argv.includes('--json')) {
  process.stdout.write(`${JSON.stringify({ ...report, history: readHistory() }, null, 2)}\n`)
} else {
  console.log(formatText(report))
}
if (errors.length > 0) {
  console.error(`\nInvalid Phase 8 ledger (${ledgerRelative}), ${errors.length} errors:`)
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}
