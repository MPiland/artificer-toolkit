import type { GRANT_KIND, SUBJECT } from '#core'
import type {
  ScalingGrant,
  ChargeAuthored,
  TargetGroupsAuthored
} from '#authored'
import type { SpellGrantAttribute } from '../core/spell.js'

export type SpellGrantAuthored = ScalingGrant<{ spellIds: string[] }> & {
  grantKind: typeof GRANT_KIND.SPELL_GRANT
  castAtLevel?: number
  charges?: ChargeAuthored
  attributes?: SpellGrantAttribute[]
  filterGroups?: TargetGroupsAuthored<typeof SUBJECT.SPELL>
}
