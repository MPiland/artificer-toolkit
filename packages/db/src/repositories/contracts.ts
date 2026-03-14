import type {
  BackgroundAuthored,
  ClassAuthored,
  DetailAuthored,
  EffectAuthored,
  EquipmentAuthored,
  FeatAuthored,
  FeatureAuthored,
  ModifierGrantAuthored,
  OptionAuthored,
  ProficiencyGrantAuthored,
  RaceAuthored,
  SenseGrantAuthored,
  SpellAuthored,
  SpellGrantAuthored,
  StartingEquipmentAuthored
} from '@artificer-toolkit/shared'
import type { SystemSeedRecord } from '../source-data/index.js'

export interface RepositoryFindAllOptions {
  systemId?: string
  userId?: string
  includeMaster?: boolean
}

/**
 * Repository contracts are the DB package's public hydration boundary.
 * They expose authored-shaped reads and writes without leaking row layouts
 * or raw Kysely builder details to callers.
 */
export interface AuthoredRepository<TAuthored, TFilter = RepositoryFindAllOptions> {
  upsert(entity: TAuthored): Promise<void>
  findById(id: string, filter?: TFilter): Promise<TAuthored | null>
  findAll(filter?: TFilter): Promise<TAuthored[]>
}

export type BackgroundRepository = AuthoredRepository<BackgroundAuthored>
export type ClassRepository = AuthoredRepository<ClassAuthored>
export type DetailRepository = AuthoredRepository<DetailAuthored, void>
export type EquipmentRepository = AuthoredRepository<EquipmentAuthored>
export type FeatRepository = AuthoredRepository<FeatAuthored>
export type RaceRepository = AuthoredRepository<RaceAuthored>
export type SpellRepository = AuthoredRepository<SpellAuthored>
export type SystemRepository = AuthoredRepository<SystemSeedRecord>

export type FeatureRepository = AuthoredRepository<FeatureAuthored>
export type OptionRepository = AuthoredRepository<OptionAuthored>

export type ModifierGrantRepository = AuthoredRepository<ModifierGrantAuthored>
export type ProficiencyGrantRepository = AuthoredRepository<ProficiencyGrantAuthored>
export type SenseGrantRepository = AuthoredRepository<SenseGrantAuthored>
export type SpellGrantRepository = AuthoredRepository<SpellGrantAuthored>

export type EffectRepository = AuthoredRepository<EffectAuthored>
export type StartingEquipmentRepository = AuthoredRepository<StartingEquipmentAuthored>
