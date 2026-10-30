// First-use schema cost on a freshly deployed self-hosted Convex backend (PLATFORM-13.T27): for each
// authored subject kind, parses the corpus's largest document inside the content/schemaCostProbe query,
// once cold (the first call since the deploy) and once warm, and fails when a call nears the 1 s
// query limit. Numbers are client round trips (request, query, response), not in-function time;
// the cold-minus-warm gap is the first-use cost of the schema.
//   yarn exec tsx apps/apis/scripts/liveBackendSchemaProbe.ts [--container=<name>]
import { authoredSubjectKindSchema } from '@artificer-toolkit/schema/projections/identity'
import { prepareSrdImport } from '../../../packages/source-data/src/srd/import.js'
import {
  assertConvexInstance,
  generateAdminKey,
  localConvex
} from '../../../scripts/convexSelfHosted.mjs'

// Half of Convex's 1 s query limit: a call above it leaves too little margin on a slower runner.
const BUDGET_MS = 500

const container = process.argv.find((argument) => argument.startsWith('--container='))?.slice(12)
await assertConvexInstance(localConvex.url, localConvex.instance)
const adminKey = generateAdminKey(container ?? localConvex.container)
const { subjects } = prepareSrdImport()

async function parse(subjectKind: string, documentJson: string) {
  const started = performance.now()
  const response = await fetch(new URL('/api/query', localConvex.url), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Convex ${adminKey}` },
    body: JSON.stringify({
      path: 'content/schemaCostProbe:parseDocument',
      args: { subjectKind, documentJson },
      format: 'json'
    }),
    signal: AbortSignal.timeout(60_000)
  })
  const milliseconds = Math.round(performance.now() - started)
  const body = (await response.json()) as { status: string; errorMessage?: string }
  if (body.status !== 'success')
    throw new Error(`${subjectKind}: ${body.errorMessage ?? response.status}`)
  return milliseconds
}

const over: string[] = []
for (const subjectKind of authoredSubjectKindSchema.options) {
  const largest = subjects
    .filter((subject) => subject.subjectKind === subjectKind)
    .map((subject) => JSON.stringify(subject.document))
    .toSorted((a, b) => b.length - a.length)[0]
  if (!largest) throw new Error(`No ${subjectKind} in the corpus.`)
  const cold = await parse(subjectKind, largest)
  const warm = await parse(subjectKind, largest)
  console.log(
    `${subjectKind} (${Math.round(largest.length / 1024)} KiB): cold ${cold} ms, warm ${warm} ms, first-use ${cold - warm} ms (round trips)`
  )
  if (cold > BUDGET_MS) over.push(`${subjectKind} ${cold} ms`)
}
if (over.length > 0)
  throw new Error(`Cold parse round trip over ${BUDGET_MS} ms: ${over.join(', ')}.`)
