import { describe, expect, it } from 'vitest'

import {
  DND5E_MANUAL_ADJUDICATION_PROPOSAL_OPERATION_KEY,
  dnd5eReceiptBindings
} from '@artificer-toolkit/schema/systems/dnd5e/schemaExtension'
import { dnd5ePathGatedOperationKey } from '../systems/dnd5e/dnd5eTestOperationKeys.js'

describe('D&D receipt bindings (QUALITY-16.T3)', () => {
  it("binds a repeat save's rulings to the path-gated manual-adjudication proposal the compiler emits", () => {
    expect(dnd5eReceiptBindings.repeatSave.rulingOperationKey).toBe(
      dnd5ePathGatedOperationKey(DND5E_MANUAL_ADJUDICATION_PROPOSAL_OPERATION_KEY)
    )
  })
})
