// Replaces canonical records in place on a seeded self-hosted Convex backend and times each
// mutation against Convex's 1 s user-time limit (PLATFORM-18.T1, T2): the worst-case subjects are the
// largest Class, the Subclass that re-reads its parent, a Race and an Equipment parent that
// recompile their children, and a Background; the System, content source and catalogue go through
// bootstrap and a reusable definition through importDefinitions. Every probe is restored except the
// Background, which stays changed so the following seed step must replace it.
//   yarn workspace @artificer-toolkit/apis exec tsx scripts/liveBackendReplaceProbe.ts [--container=<name>]
import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { prepareSrdImport } from '../../../packages/source-data/src/srd/import.js'
import {
  assertConvexInstance,
  generateAdminKey,
  localConvex
} from '../../../scripts/convexSelfHosted.mjs'

type Subject = ReturnType<typeof prepareSrdImport>['subjects'][number]

const container = process.argv.find((argument) => argument.startsWith('--container='))?.slice(12)
await assertConvexInstance(localConvex.url, localConvex.instance)
const adminKey = generateAdminKey(container ?? localConvex.container)
const manifest = prepareSrdImport()

const kib = (subject: Subject) => JSON.stringify(subject).length / 1024
const largest = (subjects: Subject[]) => subjects.toSorted((a, b) => kib(b) - kib(a))[0]
function documentRecord(subject: Subject) {
  const { document } = subject
  if (document === null || typeof document !== 'object' || Array.isArray(document))
    throw new Error(`Subject ${subject.id} is not an object document.`)
  return document
}
const field = (subject: Subject, key: string) => documentRecord(subject)[key]
const mostReferenced = (kind: Subject['subjectKind'], parentKey: string) => {
  const counts = new Map<string, number>()
  for (const subject of manifest.subjects) {
    const parent = subject.subjectKind === kind ? field(subject, parentKey) : undefined
    if (typeof parent === 'string') counts.set(parent, (counts.get(parent) ?? 0) + 1)
  }
  const [id] = [...counts.entries()].toSorted((a, b) => b[1] - a[1])[0] ?? []
  return manifest.subjects.find((subject) => subject.id === id)
}

const ofKind = (kind: Subject['subjectKind']) =>
  manifest.subjects.filter((subject) => subject.subjectKind === kind)
const probes = [
  { name: 'largest Class', subject: largest(ofKind('CLASS')), restore: true },
  {
    name: 'largest Subclass',
    subject: largest(
      ofKind('CLASS').filter((subject) => field(subject, 'category') === 'SUBCLASS')
    ),
    restore: true
  },
  {
    name: 'Race with most subraces',
    subject: mostReferenced('RACE', 'parentRaceId'),
    restore: true
  },
  {
    name: 'Equipment with most variants',
    subject: mostReferenced('EQUIPMENT', 'parentEquipmentId'),
    restore: true
  },
  { name: 'Background', subject: ofKind('BACKGROUND')[0], restore: false }
]

function relabelled(subject: Subject): Subject {
  const label = `${subject.label} (probe)`
  const document = jsonValueSchema.parse({ ...documentRecord(subject), label })
  return { ...subject, label, document, checksum: checksumRuleDocument(document) }
}

async function mutate(path: string, args: object) {
  const started = performance.now()
  const response = await fetch(new URL('/api/mutation', localConvex.url), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Convex ${adminKey}` },
    body: JSON.stringify({ path, args, format: 'json' }),
    signal: AbortSignal.timeout(60_000)
  })
  const milliseconds = Math.round(performance.now() - started)
  const body = (await response.json()) as { status: string; value?: unknown; errorMessage?: string }
  if (body.status !== 'success') throw new Error(`${path}: ${body.errorMessage ?? response.status}`)
  return { milliseconds, result: JSON.stringify(body.value) }
}

const importSubject = (subject: Subject) =>
  mutate('content/import:importSubjects', {
    contentSourceId: manifest.contentSource.id,
    subjects: [subject]
  })

for (const { name, subject, restore } of probes) {
  if (!subject) throw new Error(`No ${name} in the corpus.`)
  const replaced = await importSubject(relabelled(subject))
  if (!replaced.result.includes('"replaced":1'))
    throw new Error(`${name}: expected one replace, got ${replaced.result}.`)
  let restored = ''
  if (restore) {
    const back = await importSubject(subject)
    if (!back.result.includes('"replaced":1'))
      throw new Error(`${name}: expected one restore, got ${back.result}.`)
    restored = ` restore ${back.milliseconds} ms`
  }
  console.log(
    `${name} (${subject.subjectKind} ${Math.round(kib(subject))} KiB): replace ${replaced.milliseconds} ms${restored}${restore ? '' : ' (left changed for the next seed)'}`
  )
}

const bootstrapInput = {
  systems: manifest.systems,
  contentSource: manifest.contentSource,
  catalogue: manifest.catalogue
}
const relabelledSystems = manifest.systems.map((system) => {
  const document = jsonValueSchema.parse({
    ...(system.document as Record<string, unknown>),
    label: `${(system.document as { label: string }).label} (probe)`
  })
  return { ...system, document, checksum: checksumRuleDocument(document) }
})
const changedBootstrap = {
  systems: relabelledSystems,
  contentSource: { ...manifest.contentSource, label: `${manifest.contentSource.label} (probe)` },
  catalogue: { ...manifest.catalogue, label: `${manifest.catalogue.label} (probe)` }
}
const definition = manifest.definitions[0]
if (!definition) throw new Error('No reusable definition in the corpus.')
const definitionInput = (label: string) => ({
  contentSourceId: manifest.contentSource.id,
  definitions: [{ ...definition, label }]
})

async function probe(name: string, change: () => ReturnType<typeof mutate>, back: typeof change) {
  const replaced = await change()
  const restored = await back()
  console.log(
    `${name}: replace ${replaced.milliseconds} ms (${replaced.result}) restore ${restored.milliseconds} ms (${restored.result})`
  )
  return [replaced.result, restored.result]
}

const [systemChange, systemBack] = await probe(
  'System, content source and catalogue (bootstrap)',
  () => mutate('content/import:bootstrap', changedBootstrap),
  () => mutate('content/import:bootstrap', bootstrapInput)
)
if (!systemChange?.includes('"replaced":3') || !systemBack?.includes('"replaced":3'))
  throw new Error(
    `bootstrap: expected three replaces each way, got ${systemChange} / ${systemBack}.`
  )
const [definitionChange, definitionBack] = await probe(
  `Reusable definition (${definition.definitionFamilyKey})`,
  () => mutate('content/import:importDefinitions', definitionInput(`${definition.label} (probe)`)),
  () => mutate('content/import:importDefinitions', definitionInput(definition.label))
)
if (!definitionChange?.includes('"replaced":1') || !definitionBack?.includes('"replaced":1'))
  throw new Error(
    `importDefinitions: expected one replace each way, got ${definitionChange} / ${definitionBack}.`
  )
