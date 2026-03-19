import {
  type FeatAuthored
} from '@artificer-toolkit/shared'
import { SRD_SYSTEM_ID, SRD_USER_ID } from '../vocabulary.js'

// Domain 0050 — format: 00000000-0000-0000-0050-NNNN00000000
function featId(index: number): string {
  const hex = index.toString(16).padStart(4, '0')
  return `00000000-0000-0000-0050-${hex}00000000`
}

export const grappler: FeatAuthored = {
  id: featId(11),
  label: 'Grappler',
  description:
    'You have advantage on attack rolls against a creature you are grappling, and you can use your action to try to pin a grappled creature, restraining it until the grapple ends.',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
}
