// Replaces canonical subjects in place on a seeded self-hosted Convex backend and times each
// mutation against Convex's 1 s user-time limit (PLATFORM-18.T1): the worst-case records are the
// largest Class, the Subclass that re-reads its parent, a Race and an Equipment parent that
// recompile their children, and a Background. Every probe is restored through importSubjects except
// the Background, which stays changed so the following seed step must replace it.
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

async function importSubject(subject: Subject) {
  const started = performance.now()
  const response = await fetch(new URL('/api/mutation', localConvex.url), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Convex ${adminKey}` },
    body: JSON.stringify({
      path: 'content/import:importSubjects',
      args: { contentSourceId: manifest.contentSource.id, subjects: [subject] },
      format: 'json'
    }),
    signal: AbortSignal.timeout(60_000)
  })
  const milliseconds = Math.round(performance.now() - started)
  const body = (await response.json()) as { status: string; value?: unknown; errorMessage?: string }
  if (body.status !== 'success')
    throw new Error(`importSubjects ${subject.id}: ${body.errorMessage ?? response.status}`)
  return { milliseconds, result: JSON.stringify(body.value) }
}

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
