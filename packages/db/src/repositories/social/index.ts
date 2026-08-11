import type { DBLike } from '#types'

import { createSocialApplicationRepository } from './applications.js'
import { createSocialListingRepository } from './listings.js'
import { createSocialModerationRepository } from './moderation.js'
import { createSocialProfileRepository } from './profiles.js'
import { createSocialRateLimitRepository } from './rateLimits.js'
import { createSocialReportRepository } from './reports.js'

export type * from './types.js'

export function createSocialRepository(db: DBLike) {
  return {
    ...createSocialProfileRepository(db),
    ...createSocialListingRepository(db),
    ...createSocialApplicationRepository(db),
    ...createSocialReportRepository(db),
    ...createSocialModerationRepository(db),
    ...createSocialRateLimitRepository(db)
  }
}
