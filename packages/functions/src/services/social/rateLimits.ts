import {
  createSocialRepository,
  type DBLike,
  type SocialRateLimitAction
} from '@artificer-toolkit/db'
import { SocialRateLimitError } from './errors.js'

export async function consumeSocialRateLimit(
  db: DBLike,
  userId: string,
  action: SocialRateLimitAction,
  windows: ReadonlyArray<{ window: 'HOUR' | 'DAY'; limit: number }>,
  now: string
): Promise<void> {
  const repository = createSocialRepository(db)
  for (const item of windows) {
    const allowed = await repository.consumeSocialRateLimit({
      userId,
      action,
      window: item.window,
      limit: item.limit,
      now
    })
    if (!allowed) throw new SocialRateLimitError()
  }
}
