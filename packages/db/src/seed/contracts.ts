import type { DBLike } from '../types/index.js'
import type { BaselineContentBundle } from '../source-data/index.js'

/**
 * Seeders import authored baseline content into normalized persistence.
 * They are allowed to orchestrate wrapper calls, but not to compile content.
 */
export interface SeedContext {
  db: DBLike
  systemId: string
}

export interface SeedResult {
  systems: number
  domainRoots: number
}

export type SeedBaselineContent = (
  context: SeedContext,
  bundle: BaselineContentBundle
) => Promise<SeedResult>
