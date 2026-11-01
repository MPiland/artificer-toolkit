import { convexTest } from '../../tests/convexTest'
import { describe, expect, it } from 'vitest'
import { seededSrdCreature, srdWolf as wolf } from '../../tests/fixtures/srdCreatures'
import { blueprintEnemySnapshot } from '@artificer-toolkit/encounter-persistence/blueprintSnapshots'
import { MAX_ENCOUNTER_ACTORS } from '@artificer-toolkit/schema/shared/authoredLimits'
import { AUTHORED_LIMITS } from '@artificer-toolkit/shared/utils/authoringLimits'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { SUBJECT_COMPILER_VERSION } from '@artificer-toolkit/schema/api/authoredPublication'
import { importedSubject, importSeededSubjects } from '../../tests/fixtures/publication'
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
  await importSeededSubjects(t, {
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
    const setup = await t.run((ctx) => snapshotBlueprintEnemies(ctx, owner, input))
    const [enemy] = setup.enemies
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
    const snapshot = blueprintEnemySnapshot(setup, enemy!)
    expect(snapshot).toMatchObject({
      sourceChecksum: checksumRuleDocument(creature),
      ruleFacts: {
        vocabularySnapshotId: vocabulary?.snapshotId,
        vocabularySnapshotChecksum: vocabulary?.checksum
      },
      equipmentSources: [
        {
          equipmentId: club.id,
          sourceRevision: 1,
          sourceChecksum: checksumRuleDocument(club),
          compilation: {
            compilerVersion: SUBJECT_COMPILER_VERSION,
            authoredChecksum: checksumRuleDocument(club)
          }
        }
      ]
    })
    expect(snapshot).not.toHaveProperty('equipmentSources.0.payload')
    const before = JSON.stringify(setup)
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
    expect(JSON.stringify(setup)).toBe(before)
  }, 30000)

  it('stores one snapshot per distinct Creature source, so a full Blueprint of a large Creature fits', async () => {
    const t = await fixture()
    const duergar = { ...seededSrdCreature('Duergar'), equipmentLoadout: [] }
    await importSeededSubjects(t, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: [importedSubject({ ...duergar, subjectKind: 'CREATURE', document: duergar })]
    })
    const custom = { kind: 'CUSTOM' as const, label: 'Training dummy', maxHitPoints: 1 }
    const setup = await t.run((ctx) =>
      snapshotBlueprintEnemies(ctx, owner, {
        gameSystemId: duergar.systemId,
        enemies: [
          ...Array.from({ length: MAX_ENCOUNTER_ACTORS - 2 }, () => ({
            kind: 'CREATURE' as const,
            sourceId: duergar.id
          })),
          { kind: 'CREATURE' as const, sourceId: wolf.id },
          custom
        ]
      })
    )
    const [duergarSnapshot] = setup.snapshots
    // One snapshot per enemy would not fit the payload limit; that is what this proves.
    expect(JSON.stringify(duergarSnapshot).length * (MAX_ENCOUNTER_ACTORS - 2)).toBeGreaterThan(
      AUTHORED_LIMITS.mutationPayloadBytes
    )
    expect(setup.enemies).toHaveLength(MAX_ENCOUNTER_ACTORS)
    expect(setup.snapshots).toHaveLength(3)
    expect(setup.enemies.slice(0, MAX_ENCOUNTER_ACTORS - 2).map((e) => e.snapshotIndex)).toEqual(
      Array.from({ length: MAX_ENCOUNTER_ACTORS - 2 }, () => 0)
    )
    for (const enemy of setup.enemies.slice(-2))
      expect(blueprintEnemySnapshot(setup, enemy)).toMatchObject({ label: enemy.label })
  }, 30000)

  it('refuses Equipment from another Game System when pinning a Creature loadout', async () => {
    const t = await fixture()
    await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', club.id))
        .unique()
      if (!root) throw new Error('Missing Equipment.')
      await ctx.db.patch(root._id, { systemId: '10000000-0000-4000-8000-000000000004' })
    })
    await expect(t.run((ctx) => snapshotBlueprintEnemies(ctx, owner, input))).rejects.toThrow(
      'Encounter source is unavailable in the selected Game System.'
    )
  }, 30000)

  it('creates custom enemies and rejects unavailable or foreign Creature roots', async () => {
    const t = await fixture()
    const custom = { kind: 'CUSTOM' as const, label: 'Training dummy', maxHitPoints: 0 }
    expect(
      await t.run((ctx) => snapshotBlueprintEnemies(ctx, owner, { ...input, enemies: [custom] }))
    ).toEqual({
      enemies: [
        {
          ...custom,
          sourceId: null,
          sourceRevision: null,
          systemId: wolf.systemId,
          snapshotIndex: 0
        }
      ],
      snapshots: [{ ...custom, systemId: wolf.systemId }]
    })
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
