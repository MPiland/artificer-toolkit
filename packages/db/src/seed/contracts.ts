import type { DBLike } from '../types/index.js'
import type { BaselineContentBundle } from '../source-data/index.js'

/**
 * Seeders publish canonical System vocabulary and authored root documents.
 * They only orchestrate validated source publication; compilers are domain-owned.
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
