import { convexTest } from '../../tests/convexTest'
import { describe, expect, it } from 'vitest'
import { srdWolf as wolf } from '../../tests/fixtures/srdCreatures'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { importedSubject } from '../../tests/fixtures/publication'
import { internal } from '../_generated/api'
import schema from '../schema'
import { snapshotBlueprintEnemies } from './blueprintSnapshots'

const modules = import.meta.glob('/apps/apis/convex/**/*.*s')
const owner = '10000000-0000-4000-8000-000000000001'
const creature = {
  ...wolf,
  equipmentLoadout: [
    {
      id: '10000000-0000-4000-8000-000000000002',
      equipmentId: club.id,
      quantity: 1,
      useState: 'MAIN_HAND',
      attuned: false,
      actionFeatureIds: []
    }
  ]
}
const input = {
  gameSystemId: wolf.systemId,
  enemies: [{ kind: 'CREATURE' as const, sourceId: wolf.id }]
}

async function fixture() {
  const t = convexTest(schema, modules)
  await t.mutation(internal.content.import.bootstrap, {
    systems: [
      {
        id: wolf.systemId,
        checksum: checksumRuleDocument(srdSystemRecord),
        document: jsonValueSchema.parse(JSON.parse(JSON.stringify(srdSystemRecord)))
      }
    ],
    contentSource: SRD_CONTENT_SOURCE,
    catalogue: SRD_RULES_CATALOGUE
  })
  await t.mutation(internal.content.import.importSubjects, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [
      importedSubject({ ...creature, subjectKind: 'CREATURE', document: creature }),
      importedSubject({ ...club, subjectKind: 'EQUIPMENT', document: club })
    ]
  })
  return t
}

describe('native Blueprint enemy snapshots', () => {
  it('pins Creature, Equipment and real vocabulary provenance without later source changes', async () => {
    const t = await fixture()
    const [enemy] = await t.run((ctx) => snapshotBlueprintEnemies(ctx, owner, input))
    expect(enemy).toMatchObject({
      kind: 'CREATURE',
      sourceId: wolf.id,
      sourceRevision: 1,
      maxHitPoints: 11
    })
    const vocabulary = await t.run((ctx) =>
      ctx.db
        .query('systemVocabularySnapshots')
        .withIndex('by_systemId_snapshotVersion', (q) => q.eq('systemId', wolf.systemId))
        .first()
    )
    expect(enemy?.snapshot).toMatchObject({
      sourceChecksum: checksumRuleDocument(creature),
      ruleFacts: {
        vocabularySnapshotId: vocabulary?.snapshotId,
        vocabularySnapshotChecksum: vocabulary?.checksum
      },
      equipmentSources: [
        { equipmentId: club.id, sourceRevision: 1, sourceChecksum: checksumRuleDocument(club) }
      ]
    })
    const before = JSON.stringify(enemy)
    await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', club.id))
        .unique()
      if (!root) throw new Error('Missing Equipment.')
      await ctx.db.patch(root._id, { ownerUserId: '10000000-0000-4000-8000-000000000003' })
    })
    await expect(t.run((ctx) => snapshotBlueprintEnemies(ctx, owner, input))).rejects.toThrow(
      'unavailable'
    )
    expect(JSON.stringify(enemy)).toBe(before)
  }, 30000)

  it('creates custom enemies and rejects unavailable or foreign Creature roots', async () => {
    const t = await fixture()
    const custom = { kind: 'CUSTOM' as const, label: 'Training dummy', maxHitPoints: 0 }
    expect(
      await t.run((ctx) => snapshotBlueprintEnemies(ctx, owner, { ...input, enemies: [custom] }))
    ).toEqual([
      {
        ...custom,
        sourceId: null,
        sourceRevision: null,
        systemId: wolf.systemId,
        snapshot: { ...custom, systemId: wolf.systemId }
      }
    ])
    await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', wolf.id))
        .unique()
      if (!root) throw new Error('Missing Creature.')
      await ctx.db.patch(root._id, { ownerUserId: '10000000-0000-4000-8000-000000000003' })
    })
    await expect(t.run((ctx) => snapshotBlueprintEnemies(ctx, owner, input))).rejects.toThrow(
      'unavailable'
    )
  }, 30000)
})
