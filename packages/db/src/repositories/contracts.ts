import type {
  BackgroundAuthored,
  ClassAuthored,
  CreatureAuthored,
  DetailAuthored,
  EffectAuthored,
  EquipmentAuthored,
  ResolvedEquipment,
  EquipmentVariantAuthored,
  FeatGrantAuthored,
  FeatAuthored,
  FeatureAuthored,
  ModifierGrantAuthored,
  OptionAuthored,
  ProficiencyGrantAuthored,
  RaceAuthored,
  ResolvedRace,
  SenseGrantAuthored,
  SpellAuthored,
  SpellGrantAuthored,
  StartingEquipmentAuthored,
  VehicleAuthored,
  NodeSubjectCode
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
  findByIds(ids: readonly string[], filter?: TFilter): Promise<Map<string, TAuthored>>
  findAll(filter?: TFilter): Promise<TAuthored[]>
}

export type BackgroundRepository = AuthoredRepository<BackgroundAuthored>
export type ClassRepository = AuthoredRepository<ClassAuthored>
export type CreatureRepository = AuthoredRepository<CreatureAuthored>
export type DetailRepository = AuthoredRepository<DetailAuthored, void>
export interface EquipmentRepository extends AuthoredRepository<
  EquipmentAuthored | EquipmentVariantAuthored
> {
  findResolvedById(id: string, filter?: RepositoryFindAllOptions): Promise<ResolvedEquipment | null>
  findResolvedAll(filter?: RepositoryFindAllOptions): Promise<ResolvedEquipment[]>
}
export type FeatRepository = AuthoredRepository<FeatAuthored>
export interface RaceRepository extends AuthoredRepository<RaceAuthored> {
  findResolvedById(id: string, filter?: RepositoryFindAllOptions): Promise<ResolvedRace | null>
  findResolvedAll(filter?: RepositoryFindAllOptions): Promise<ResolvedRace[]>
}
export type SpellRepository = AuthoredRepository<SpellAuthored>
export type SystemRepository = AuthoredRepository<SystemSeedRecord>
export type VehicleRepository = AuthoredRepository<VehicleAuthored>

export type FeatureRepository<N extends NodeSubjectCode = NodeSubjectCode> = AuthoredRepository<
  FeatureAuthored<N>
>
export type OptionRepository<N extends NodeSubjectCode = NodeSubjectCode> = AuthoredRepository<
  OptionAuthored<N>
>

export type ModifierGrantRepository = AuthoredRepository<ModifierGrantAuthored>
export type FeatGrantRepository = AuthoredRepository<FeatGrantAuthored>
export type ProficiencyGrantRepository = AuthoredRepository<ProficiencyGrantAuthored>
export type SenseGrantRepository = AuthoredRepository<SenseGrantAuthored>
export type SpellGrantRepository = AuthoredRepository<SpellGrantAuthored>

export type EffectRepository = AuthoredRepository<EffectAuthored>
export type StartingEquipmentRepository = AuthoredRepository<StartingEquipmentAuthored>
