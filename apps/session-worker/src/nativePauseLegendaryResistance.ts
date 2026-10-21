import { resolveNativeActionLegendaryResistance } from '@artificer-toolkit/rules-runtime/encounterActionLegendaryResistance'
import type { NativePauseHandler } from './nativePauseTypes.js'

export const legendaryResistancePause: NativePauseHandler<'LEGENDARY_RESISTANCE'> = {
  read: ({ pause, decision }) => {
    if (!decision) throw new Error('The action requires a Legendary Resistance decision.')
    return {
      kind: 'LEGENDARY_RESISTANCE',
      answer: { offer: pause.payload, selection: decision }
    }
  },
  settle: async (answer, { actionSource, currentResistance }) => {
    const resolved = await resolveNativeActionLegendaryResistance({
      ...actionSource,
      ...answer,
      ...(await currentResistance())
    })
    return { execution: resolved.execution, resistance: resolved.resistance }
  }
}
