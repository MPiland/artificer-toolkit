import type { EffectAuthored } from './effect.js'
import type { Trigger } from '#core'

export type CapabilityAuthored<TTrigger extends Trigger = Trigger> = EffectAuthored<TTrigger>
