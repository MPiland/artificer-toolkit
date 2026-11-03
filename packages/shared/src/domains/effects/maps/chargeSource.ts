import type { NodeSelectSource } from '#utils'

/**
 * The resource pools an effect can spend or restore: the `charges` of the record being authored,
 * plus those of its parent class.
 */
export const CHARGE_SELECT_SOURCE: NodeSelectSource = {
  kind: 'DOCUMENT_OBJECTS',
  key: 'charges',
  parent: { idPath: ['parentClassId'], documentTable: 'classes' }
}
