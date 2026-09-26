import {
  createPlatformRulesRuntime,
  deriveRulesContinuationKey
} from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'

/**
 * The live rules runtime. Planners read every definition through their authorized capture, so the
 * runtime's own definition source must never be consulted.
 */
export async function createNativeLiveRulesRuntime(secret: string): Promise<RulesRuntimeService> {
  return createPlatformRulesRuntime({
    continuationIntegrityKey: await deriveRulesContinuationKey(secret),
    definitions: {
      async requireCurrent() {
        throw new Error('Live rules must read definitions from their authorized capture.')
      }
    }
  })
}

/** Unbiased integer in [0, maximum) from the platform CSPRNG; authoritative dice depend on it. */
export function secureRandomInt(maximum: number): number {
  if (!Number.isSafeInteger(maximum) || maximum < 1 || maximum > 2 ** 32)
    throw new Error('Random range is invalid.')
  const limit = Math.floor(2 ** 32 / maximum) * maximum
  const buffer = new Uint32Array(1)
  for (;;) {
    crypto.getRandomValues(buffer)
    if (buffer[0]! < limit) return buffer[0]! % maximum
  }
}
