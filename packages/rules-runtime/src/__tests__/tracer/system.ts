import type { SystemCoreCodeAdapter } from '../../systemCoreCodeCapability.js'

/**
 * A test-only Fate-like System (D195): approaches in place of abilities, stress in place of hit
 * points, exchanges in place of rounds. It exists to prove the neutral platform installs a second
 * System; it is never seeded and never built.
 */
export const TRACER_SYSTEM_ID = '00000000-0000-4000-8000-0000000f0001'

export const TRACER_APPROACHES = [
  'CAREFUL',
  'CLEVER',
  'FLASHY',
  'FORCEFUL',
  'QUICK',
  'SNEAKY'
] as const

export type TracerApproach = (typeof TRACER_APPROACHES)[number]

/** The approach definitions a Creature's rule facts key its ratings by. */
export const TRACER_APPROACH_DEFINITION_IDS: Readonly<Record<TracerApproach, string>> = {
  CAREFUL: '00000000-0000-4000-8000-0000000f0a01',
  CLEVER: '00000000-0000-4000-8000-0000000f0a02',
  FLASHY: '00000000-0000-4000-8000-0000000f0a03',
  FORCEFUL: '00000000-0000-4000-8000-0000000f0a04',
  QUICK: '00000000-0000-4000-8000-0000000f0a05',
  SNEAKY: '00000000-0000-4000-8000-0000000f0a06'
}

/** The one action an actor takes each exchange; defending is free. */
export const TRACER_EXCHANGE_ACTION_ALLOWANCE_ID = '00000000-0000-4000-8000-0000000f0b01'
/** The capability a taken-out actor has suppressed. */
export const TRACER_ACTOR_ACTION_CAPABILITY_ID = '00000000-0000-4000-8000-0000000f0b02'

export const tracerCoreCodeAdapter: SystemCoreCodeAdapter = {
  gameSystemId: TRACER_SYSTEM_ID,
  lists: {
    rollInfluence: [],
    rollMode: [],
    spellSlotPool: [],
    effectConsumeEvent: [{ code: 'INVOKED', label: 'Invoked' }],
    effectEndEvent: [
      { code: 'END_OF_EXCHANGE', label: 'End of exchange', grantable: true },
      { code: 'END_OF_SCENE', label: 'End of scene', grantable: true }
    ],
    actionTrait: [{ code: 'ATTACK', label: 'Attack', actionFact: 'attackRoll' }],
    size: [
      { code: 'PERSONAL', label: 'Personal', spaceFeet: 5, isDefault: true },
      { code: 'VEHICLE', label: 'Vehicle', spaceFeet: 20 },
      { code: 'COLOSSAL', label: 'Colossal' }
    ]
  },
  abilities: [...TRACER_APPROACHES]
}
