import { describe, expect, it } from 'vitest'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { greatclub } from '@artificer-toolkit/source-data/srd/equipment/greatclub.js'
import { shieldWood } from '@artificer-toolkit/source-data/srd/equipment/shield-wood.js'
import {
  SRD_DWARVEN_HERITAGE_ID,
  SRD_GOLD_CURRENCY_ID,
  SRD_STEALTH_SKILL_ID,
  SRD_WALK_SPEED_ID,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { internal } from '../_generated/api'
import { importedSubject, publicationFixture } from '../../tests/fixtures/publication'

process.env.SITE_URL = 'http://localhost:3000'
process.env.BETTER_AUTH_SECRET = 'test-secret-that-is-long-enough'

const modules = import.meta.glob('/apps/apis/convex/**/*.*s')
const authModules = import.meta.glob('../betterAuth/**/*.*s')

async function runningJobFixture() {
  const base = await publicationFixture(modules, authModules, [
    [club, greatclub, shieldWood].map((equipment) =>
      importedSubject({ subjectKind: 'EQUIPMENT', ...equipment, document: equipment })
    )
  ])
  const jobId = await base.t.run(async (ctx) => {
    const jobId = crypto.randomUUID()
    const previewId = crypto.randomUUID()
    const command = {
      commandId: crypto.randomUUID(),
      previewId,
      selectedEntryIds: ['character'],
      resolutions: [],
      customContentChoices: []
    }
    const now = new Date().toISOString()
    await ctx.db.insert('importJobs', {
      id: jobId,
      ownerUserId: base.first.userId,
      previewId,
      command,
      inputFingerprint: checksumCanonicalJson({
        operation: 'PORTABLE_IMPORT',
        ownerUserId: base.first.userId,
        command
      }),
      source: 'ARTIFICER_JSON',
      status: 'RUNNING',
      terminalStatus: null,
      phase: 'STAGING',
      entryIndex: 0,
      cursor: null,
      processedEntries: 0,
      totalEntries: 1,
      expectedStageCount: 1,
      stagedStageCount: 1,
      failureReason: null,
      summary: null,
      cleanupTableIndex: 0,
      cleanupCursor: null,
      expiresAt: Date.now() + 60_000,
      createdAt: now,
      updatedAt: now
    })
    return jobId
  })
  return { ...base, jobId }
}

describe('import runner preflight Equipment (SHEET-8)', () => {
  it('reads only the requested Equipment as compiled category and two-handedness', async () => {
    const { t, jobId } = await runningJobFixture()
    const preflight = await t.query(internal.imports.runnerState.loadPreflight, {
      jobId,
      systemIds: [],
      characterIds: [],
      equipmentIds: [club.id, greatclub.id, 'unknown-equipment']
    })
    expect(preflight.equipment).toEqual([
      { equipmentId: club.id, category: 'WEAPON', twoHanded: false },
      { equipmentId: greatclub.id, category: 'WEAPON', twoHanded: true }
    ])
  }, 15_000)

  it('reads the vocabulary of a requested readable System through the exact lookup', async () => {
    const { t, jobId } = await runningJobFixture()
    const snapshot = await t.query(internal.imports.previewLookup.loadExactForJob, {
      jobId,
      requests: [
        { kind: 'SYSTEM_VOCABULARY', systemId: srdSystemRecord.id },
        { kind: 'SYSTEM_VOCABULARY', systemId: 'unknown-system' }
      ]
    })
    const entries = (vocabulary: Array<{ id: string; code: string; label: string }>) =>
      vocabulary.map(({ id, code, label }) => ({ id, code, label }))
    expect(snapshot.systemVocabularies).toEqual([
      {
        systemId: srdSystemRecord.id,
        damageTypes: entries(srdSystemRecord.damageTypes),
        rarities: entries(srdSystemRecord.rarities),
        goldCurrencyId: SRD_GOLD_CURRENCY_ID,
        walkSpeedId: SRD_WALK_SPEED_ID,
        stealthSkillId: SRD_STEALTH_SKILL_ID,
        dwarvenHeritageId: SRD_DWARVEN_HERITAGE_ID
      }
    ])
    expect(snapshot.systemVocabularies[0]?.rarities.length).toBeGreaterThan(0)
    const gold = srdSystemRecord.currencies.find(
      ({ id }) => id === snapshot.systemVocabularies[0]?.goldCurrencyId
    )
    expect(gold?.code).toBe('GP')
  }, 15_000)

  it('refuses a repeated Equipment id', async () => {
    const { t, jobId } = await runningJobFixture()
    await expect(
      t.query(internal.imports.runnerState.loadPreflight, {
        jobId,
        systemIds: [],
        characterIds: [],
        equipmentIds: [club.id, club.id]
      })
    ).rejects.toThrow('Import preflight request is invalid.')
  }, 15_000)
})
