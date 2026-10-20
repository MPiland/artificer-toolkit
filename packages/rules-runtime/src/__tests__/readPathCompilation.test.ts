/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// D163: engines hydrate the stored compilation; only the publish, import, seed and migration paths
// that write a compilation may call a subject compiler. Tests and test fixtures may compile.
const repositoryRoot = fileURLToPath(new URL('../../../../', import.meta.url))
const productionRoots = [
  'packages/rules-runtime/src',
  'packages/authoring/src',
  'apps/apis/convex',
  'apps/session-worker/src',
  'apps/web/src'
]
const SUBJECT_COMPILER_CALL =
  /\b(?:compileBackground|compileClass|compileCreature|compileEquipment|compileResolvedEquipment|compileFeat|compileFeature|compileRace|compileSubraceSource|compileSpell|compileVehicle|compileSubjectWithMechanicsIndex|compilePublicationDocument)\(/
const TEST_ONLY =
  /(?:\.test\.tsx?|\.stories\.tsx|\.fixtures\.ts)$|[\\/](?:__tests__|testing|_generated)[\\/]/

const COMPILATION_WRITERS = [
  'apps/apis/convex/content/classPublicationActions.ts',
  'apps/apis/convex/content/compilationMigration.ts',
  'apps/apis/convex/content/equipmentRelationships.ts',
  'apps/apis/convex/content/import.ts',
  'apps/apis/convex/content/publication.ts',
  'apps/apis/convex/content/raceRelationships.ts',
  'apps/apis/convex/content/seed.ts',
  'apps/apis/convex/imports/stageCustomAuthored.ts',
  'packages/rules-runtime/src/authoredPublicationCompile.ts'
]

describe('read-path compilation', () => {
  it('lets only the paths that store a compilation call a subject compiler', () => {
    const callers = productionRoots.flatMap((root) =>
      readdirSync(path.join(repositoryRoot, root), { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
        .map((entry) => path.join(entry.parentPath, entry.name))
        .filter((file) => !TEST_ONLY.test(file))
        .filter((file) => SUBJECT_COMPILER_CALL.test(readFileSync(file, 'utf8')))
        .map((file) => path.relative(repositoryRoot, file).replaceAll('\\', '/'))
    )
    expect(callers.sort()).toEqual(COMPILATION_WRITERS)
  })
})
