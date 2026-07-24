import { createDb } from '../client.js'
import { seedBaselineContent } from '../seed/baseline.js'
import type { BaselineContentBundle } from '../source-data/content.js'
import { SRD_SYSTEM_ID, srdBaselineContent } from '../source-data/srd/index.js'
import { ensureSeedOwnerUser, findSeedOwnerUserById } from './seedOwner.js'

function requireDatabaseConnectionString() {
  if (!process.env.DATABASE_CONNECTION_STRING) {
    throw new Error('DATABASE_CONNECTION_STRING is required to seed SRD content.')
  }
}

async function getSeedOwnerUserId() {
  if (process.env.SEED_OWNER_USER_ID) {
    const configuredUser = await findSeedOwnerUserById(process.env.SEED_OWNER_USER_ID)

    if (configuredUser) {
      return configuredUser.id
    }

    if (
      !process.env.SUPABASE_URL?.includes('127.0.0.1') &&
      !process.env.SUPABASE_URL?.includes('localhost')
    ) {
      console.info(
        `SEED_OWNER_USER_ID "${process.env.SEED_OWNER_USER_ID}" was not found in the active Supabase project; using seed owner email instead.`
      )
    }
  }

  const seedOwner = await ensureSeedOwnerUser()
  return seedOwner.id
}

function withSeedOwner(bundle: BaselineContentBundle, userId: string): BaselineContentBundle {
  return {
    ...bundle,
    vocabulary: {
      systems: bundle.vocabulary.systems.map((system) => ({
        ...system,
        userId
      }))
    },
    subjects: {
      backgrounds: bundle.subjects.backgrounds.map((record) => ({ ...record, userId })),
      classes: bundle.subjects.classes.map((record) => ({ ...record, userId })),
      creatures: bundle.subjects.creatures.map((record) => ({ ...record, userId })),
      equipment: bundle.subjects.equipment.map((record) => ({ ...record, userId })),
      feats: bundle.subjects.feats.map((record) => ({ ...record, userId })),
      races: bundle.subjects.races.map((record) => ({ ...record, userId })),
      spells: bundle.subjects.spells.map((record) => ({ ...record, userId })),
      vehicles: bundle.subjects.vehicles.map((record) => ({ ...record, userId }))
    }
  }
}

async function main() {
  requireDatabaseConnectionString()

  const db = createDb({ connectionString: process.env.DATABASE_CONNECTION_STRING })

  try {
    const seedOwnerUserId = await getSeedOwnerUserId()
    const bundle = withSeedOwner(srdBaselineContent, seedOwnerUserId)

    console.info('Seeding normalized SRD content and authored metadata...')
    const result = await seedBaselineContent(
      {
        db,
        systemId: SRD_SYSTEM_ID
      },
      bundle
    )

    console.info('Seeded SRD baseline content.')
    console.info(`Seed owner user id: ${seedOwnerUserId}`)
    console.info(JSON.stringify(result, null, 2))
  } finally {
    await db.destroy()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
