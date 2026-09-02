import {
  DND5E_LEGENDARY_ACTION_LIFECYCLE_DEFINITION_ID,
  DND5E_LEGENDARY_RESISTANCE_LIFECYCLE_DEFINITION_ID,
  DND5E_RECHARGE_4_LIFECYCLE_DEFINITION_ID,
  DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
  DND5E_RECHARGE_6_LIFECYCLE_DEFINITION_ID
} from '@artificer-toolkit/schema/shared/encounterLifecycle'
import { featureDtoSchema } from '@artificer-toolkit/schema/features/feature'
import { CLOSED_RULE_KIND } from '@artificer-toolkit/shared'
import { compileEffect } from '@artificer-toolkit/shared/compilers'
import { describe, expect, it } from 'vitest'

import { srdCreatureRecords } from '../source-data/srd/creatures/index.js'
import { quasit } from '../source-data/srd/creatures/quasit.js'

const restRecoveryRechargeExclusions = [
  {
    featureId: '00000000-0001-0002-0070-003300000000',
    chargeId: '00000000-0002-01f6-0070-003300000000',
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0006-0070-003d00000000',
    chargeId: '00000000-0002-000c-0070-003d00000000',
    actionCosts: [{ chargeId: '00000000-0002-000c-0070-003d00000000', cost: 1 }]
  },
  {
    featureId: '00000000-0001-0003-0070-005b00000000',
    chargeId: '00000000-0002-0064-0070-0d7a00000000',
    actionCosts: [{ chargeId: '00000000-0002-0064-0070-0d7a00000000', cost: 1 }]
  },
  {
    featureId: '00000000-0001-0006-0070-005b00000000',
    chargeId: '00000000-0002-0065-0070-0d7a00000000',
    actionCosts: [{ chargeId: '00000000-0002-0065-0070-0d7a00000000', cost: 1 }]
  },
  {
    featureId: '00000000-0001-0002-0070-007400000000',
    chargeId: '00000000-0002-01f6-0070-007400000000',
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0004-0070-008000000000',
    chargeId: '00000000-0002-00d3-0070-008000000000',
    actionCosts: [{ chargeId: '00000000-0002-00d3-0070-008000000000', cost: 1 }]
  },
  {
    featureId: '00000000-0001-0005-0070-00b200000000',
    chargeId: '00000000-0002-025d-0070-00b200000000',
    actionCosts: [{ chargeId: '00000000-0002-025d-0070-00b200000000', cost: 1 }]
  },
  {
    featureId: '00000000-0001-0004-0070-00d000000000',
    chargeId: '00000000-0002-01f9-0070-00d000000000',
    actionCosts: [{ chargeId: '00000000-0002-01f9-0070-00d000000000', cost: 1 }]
  }
] as const

const unrelatedFeatureIds = new Set([
  '00000000-0001-0002-0070-001600000000',
  '00000000-0001-0001-0070-001700000000'
])

const authoritativeLifecycleFeatureCatalogue = [
  {
    featureId: '00000000-0001-0002-0070-000300000000',
    lifecycleDefinitionId: DND5E_LEGENDARY_RESISTANCE_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '00000000-0005-0014-0070-000300000000',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 3
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0008-0070-000300000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: 'ff584c2e-4719-5903-bd5a-e6b864373037',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0009-0070-000300000000',
    lifecycleDefinitionId: DND5E_LEGENDARY_ACTION_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '00000000-0005-0015-0070-000300000000',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 3
    },
    actionCosts: [
      {
        optionId: '00000000-0005-00ca-0070-000300000000',
        chargeId: '00000000-0005-0015-0070-000300000000',
        cost: 1
      },
      {
        optionId: '00000000-0005-00cb-0070-000300000000',
        chargeId: '00000000-0005-0015-0070-000300000000',
        cost: 2
      }
    ]
  },
  {
    featureId: '00000000-0001-0001-0070-000400000000',
    lifecycleDefinitionId: DND5E_LEGENDARY_RESISTANCE_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '00000000-0005-0014-0070-000400000000',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 3
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0007-0070-000400000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '31b1c6a5-7fb8-54ca-9888-025d9f4b5765',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0008-0070-000400000000',
    lifecycleDefinitionId: DND5E_LEGENDARY_ACTION_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '00000000-0005-0015-0070-000400000000',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 3
    },
    actionCosts: [
      {
        optionId: '00000000-0005-00ca-0070-000400000000',
        chargeId: '00000000-0005-0015-0070-000400000000',
        cost: 1
      },
      {
        optionId: '00000000-0005-00cb-0070-000400000000',
        chargeId: '00000000-0005-0015-0070-000400000000',
        cost: 1
      }
    ]
  },
  {
    featureId: '00000000-0001-0001-0070-000500000000',
    lifecycleDefinitionId: DND5E_LEGENDARY_RESISTANCE_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '00000000-0005-0014-0070-000500000000',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'LONG_REST',
      amount: 3
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0007-0070-000500000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '6bce970a-678d-53b1-bee4-07d0b24ac5fb',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-000a-0070-000500000000',
    lifecycleDefinitionId: DND5E_LEGENDARY_ACTION_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '00000000-0005-0015-0070-000500000000',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 3
    },
    actionCosts: [
      {
        optionId: '00000000-0005-00c9-0070-000500000000',
        chargeId: '00000000-0005-0015-0070-000500000000',
        cost: 1
      },
      {
        optionId: '00000000-0005-00ca-0070-000500000000',
        chargeId: '00000000-0005-0015-0070-000500000000',
        cost: 1
      },
      {
        optionId: '00000000-0005-00cb-0070-000500000000',
        chargeId: '00000000-0005-0015-0070-000500000000',
        cost: 1
      }
    ]
  },
  {
    featureId: '00000000-0001-0002-0070-000600000000',
    lifecycleDefinitionId: DND5E_LEGENDARY_RESISTANCE_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '00000000-0005-0014-0070-000600000000',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'LONG_REST',
      amount: 3
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0008-0070-000600000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '54e1a186-bd4b-5269-906f-6fc443f680d7',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0009-0070-000600000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: 'fb5ad9e0-84c8-53f9-9e56-74c954f51b56',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-000b-0070-000600000000',
    lifecycleDefinitionId: DND5E_LEGENDARY_ACTION_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '00000000-0005-0015-0070-000600000000',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 3
    },
    actionCosts: [
      {
        optionId: '00000000-0005-00c9-0070-000600000000',
        chargeId: '00000000-0005-0015-0070-000600000000',
        cost: 1
      },
      {
        optionId: '00000000-0005-00ca-0070-000600000000',
        chargeId: '00000000-0005-0015-0070-000600000000',
        cost: 1
      },
      {
        optionId: '00000000-0005-00cb-0070-000600000000',
        chargeId: '00000000-0005-0015-0070-000600000000',
        cost: 1
      }
    ]
  },
  {
    featureId: '00000000-0001-0001-0070-000700000000',
    lifecycleDefinitionId: DND5E_LEGENDARY_RESISTANCE_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '00000000-0005-0014-0070-000700000000',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'LONG_REST',
      amount: 3
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0007-0070-000700000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '21d83c93-e89b-5818-8b0e-c01067cbbf38',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0008-0070-000700000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '4964374a-2d1a-52c0-8b2a-32d9f478a776',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0009-0070-000700000000',
    lifecycleDefinitionId: DND5E_LEGENDARY_ACTION_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '00000000-0005-0015-0070-000700000000',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 3
    },
    actionCosts: [
      {
        optionId: '00000000-0005-00c9-0070-000700000000',
        chargeId: '00000000-0005-0015-0070-000700000000',
        cost: 1
      },
      {
        optionId: '00000000-0005-00ca-0070-000700000000',
        chargeId: '00000000-0005-0015-0070-000700000000',
        cost: 1
      },
      {
        optionId: '00000000-0005-00cb-0070-000700000000',
        chargeId: '00000000-0005-0015-0070-000700000000',
        cost: 1
      }
    ]
  },
  {
    featureId: '00000000-0001-0002-0070-000800000000',
    lifecycleDefinitionId: DND5E_LEGENDARY_RESISTANCE_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '00000000-0005-0014-0070-000800000000',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'LONG_REST',
      amount: 3
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0008-0070-000800000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '1d144844-0983-5762-8c96-c1f83966967b',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0009-0070-000800000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: 'a96dddea-9d9e-54fc-88e4-cb011a06cc52',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-000b-0070-000800000000',
    lifecycleDefinitionId: DND5E_LEGENDARY_ACTION_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '00000000-0005-0015-0070-000800000000',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 3
    },
    actionCosts: [
      {
        optionId: '00000000-0005-00c9-0070-000800000000',
        chargeId: '00000000-0005-0015-0070-000800000000',
        cost: 1
      },
      {
        optionId: '00000000-0005-00ca-0070-000800000000',
        chargeId: '00000000-0005-0015-0070-000800000000',
        cost: 1
      },
      {
        optionId: '00000000-0005-00cb-0070-000800000000',
        chargeId: '00000000-0005-0015-0070-000800000000',
        cost: 1
      }
    ]
  },
  {
    featureId: '00000000-0001-0002-0070-000900000000',
    lifecycleDefinitionId: DND5E_LEGENDARY_RESISTANCE_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '00000000-0005-0014-0070-000900000000',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 3
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0008-0070-000900000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: 'c2de4b8e-0015-5717-ad70-ef2c4e2eca74',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0009-0070-000900000000',
    lifecycleDefinitionId: DND5E_LEGENDARY_ACTION_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '00000000-0005-0015-0070-000900000000',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 3
    },
    actionCosts: [
      {
        optionId: '00000000-0005-00ca-0070-000900000000',
        chargeId: '00000000-0005-0015-0070-000900000000',
        cost: 1
      },
      {
        optionId: '00000000-0005-00cb-0070-000900000000',
        chargeId: '00000000-0005-0015-0070-000900000000',
        cost: 1
      }
    ]
  },
  {
    featureId: '00000000-0001-0001-0070-000a00000000',
    lifecycleDefinitionId: DND5E_LEGENDARY_RESISTANCE_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '00000000-0005-0014-0070-000a00000000',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 3
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0007-0070-000a00000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '20c33932-221f-5b98-8859-fd2eda23666e',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0008-0070-000a00000000',
    lifecycleDefinitionId: DND5E_LEGENDARY_ACTION_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '00000000-0005-0015-0070-000a00000000',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 3
    },
    actionCosts: [
      {
        optionId: '00000000-0005-00ca-0070-000a00000000',
        chargeId: '00000000-0005-0015-0070-000a00000000',
        cost: 1
      },
      {
        optionId: '00000000-0005-00cb-0070-000a00000000',
        chargeId: '00000000-0005-0015-0070-000a00000000',
        cost: 1
      }
    ]
  },
  {
    featureId: '00000000-0001-0001-0070-000b00000000',
    lifecycleDefinitionId: DND5E_LEGENDARY_RESISTANCE_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '00000000-0005-0014-0070-000b00000000',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'LONG_REST',
      amount: 3
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0007-0070-000b00000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: 'e33562e6-0b6b-518b-86a0-ef3a76f95edc',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0008-0070-000b00000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '676bd7ad-c1d0-5523-a2f6-4f2a6b8fe1d9',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0009-0070-000b00000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '8e53bd8a-999f-5989-8e7b-75432f1d4b3c',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-000b-0070-000b00000000',
    lifecycleDefinitionId: DND5E_LEGENDARY_ACTION_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '00000000-0005-0015-0070-000b00000000',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 3
    },
    actionCosts: [
      {
        optionId: '00000000-0005-00c9-0070-000b00000000',
        chargeId: '00000000-0005-0015-0070-000b00000000',
        cost: 1
      },
      {
        optionId: '00000000-0005-00ca-0070-000b00000000',
        chargeId: '00000000-0005-0015-0070-000b00000000',
        cost: 1
      },
      {
        optionId: '00000000-0005-00cb-0070-000b00000000',
        chargeId: '00000000-0005-0015-0070-000b00000000',
        cost: 1
      }
    ]
  },
  {
    featureId: '00000000-0001-0002-0070-000c00000000',
    lifecycleDefinitionId: DND5E_LEGENDARY_RESISTANCE_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '00000000-0005-0014-0070-000c00000000',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'LONG_REST',
      amount: 3
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0008-0070-000c00000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '0a09d7ad-31d0-5d39-b4e0-19d9801d1934',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0009-0070-000c00000000',
    lifecycleDefinitionId: DND5E_LEGENDARY_ACTION_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '00000000-0005-0015-0070-000c00000000',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 3
    },
    actionCosts: [
      {
        optionId: '00000000-0005-00ca-0070-000c00000000',
        chargeId: '00000000-0005-0015-0070-000c00000000',
        cost: 1
      },
      {
        optionId: '00000000-0005-00cb-0070-000c00000000',
        chargeId: '00000000-0005-0015-0070-000c00000000',
        cost: 1
      }
    ]
  },
  {
    featureId: '00000000-0001-0002-0070-000d00000000',
    lifecycleDefinitionId: DND5E_RECHARGE_4_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '94a7a4ad-bb12-5dd5-a822-c26bfe41e4b4',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0002-0070-000e00000000',
    lifecycleDefinitionId: DND5E_LEGENDARY_RESISTANCE_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '00000000-0005-0014-0070-000e00000000',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 3
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0008-0070-000e00000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '71618de4-1e16-5093-87aa-a15b10b1211f',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0009-0070-000e00000000',
    lifecycleDefinitionId: DND5E_LEGENDARY_ACTION_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '00000000-0005-0015-0070-000e00000000',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 3
    },
    actionCosts: [
      {
        optionId: '00000000-0005-00ca-0070-000e00000000',
        chargeId: '00000000-0005-0015-0070-000e00000000',
        cost: 1
      },
      {
        optionId: '00000000-0005-00cb-0070-000e00000000',
        chargeId: '00000000-0005-0015-0070-000e00000000',
        cost: 1
      }
    ]
  },
  {
    featureId: '00000000-0001-0001-0070-000f00000000',
    lifecycleDefinitionId: DND5E_LEGENDARY_RESISTANCE_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '00000000-0005-0014-0070-000f00000000',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 3
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0007-0070-000f00000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '47b516d2-d486-520c-b2ba-dd62e61ddc5e',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0008-0070-000f00000000',
    lifecycleDefinitionId: DND5E_LEGENDARY_ACTION_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '00000000-0005-0015-0070-000f00000000',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 3
    },
    actionCosts: [
      {
        optionId: '00000000-0005-00ca-0070-000f00000000',
        chargeId: '00000000-0005-0015-0070-000f00000000',
        cost: 1
      },
      {
        optionId: '00000000-0005-00cb-0070-000f00000000',
        chargeId: '00000000-0005-0015-0070-000f00000000',
        cost: 1
      }
    ]
  },
  {
    featureId: '00000000-0001-0001-0070-001000000000',
    lifecycleDefinitionId: DND5E_LEGENDARY_RESISTANCE_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '00000000-0005-0014-0070-001000000000',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'LONG_REST',
      amount: 3
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0007-0070-001000000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '86f7beb0-7b63-5c56-9035-35ef6b15b580',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-000b-0070-001000000000',
    lifecycleDefinitionId: DND5E_LEGENDARY_ACTION_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '00000000-0005-0015-0070-001000000000',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 3
    },
    actionCosts: [
      {
        optionId: '00000000-0005-00c9-0070-001000000000',
        chargeId: '00000000-0005-0015-0070-001000000000',
        cost: 1
      },
      {
        optionId: '00000000-0005-00ca-0070-001000000000',
        chargeId: '00000000-0005-0015-0070-001000000000',
        cost: 1
      },
      {
        optionId: '00000000-0005-00cb-0070-001000000000',
        chargeId: '00000000-0005-0015-0070-001000000000',
        cost: 1
      }
    ]
  },
  {
    featureId: '00000000-0001-0002-0070-001100000000',
    lifecycleDefinitionId: DND5E_LEGENDARY_RESISTANCE_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '00000000-0005-0014-0070-151f00000000',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'LONG_REST',
      amount: 3
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0008-0070-001100000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: 'd9756682-ac13-5bc3-b183-a7672ae0ca0a',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0009-0070-001100000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '525a2090-d7c4-5edd-9425-8cf179913b63',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-000b-0070-001100000000',
    lifecycleDefinitionId: DND5E_LEGENDARY_ACTION_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '00000000-0005-0015-0070-151f00000000',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 3
    },
    actionCosts: [
      {
        optionId: '00000000-0005-00c9-0070-001100000000',
        chargeId: '00000000-0005-0015-0070-151f00000000',
        cost: 1
      },
      {
        optionId: '00000000-0005-00ca-0070-001100000000',
        chargeId: '00000000-0005-0015-0070-151f00000000',
        cost: 1
      },
      {
        optionId: '00000000-0005-00cb-0070-001100000000',
        chargeId: '00000000-0005-0015-0070-151f00000000',
        cost: 1
      }
    ]
  },
  {
    featureId: '00000000-0001-0001-0070-001200000000',
    lifecycleDefinitionId: DND5E_LEGENDARY_RESISTANCE_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '00000000-0005-0014-0070-164e00000000',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'LONG_REST',
      amount: 3
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0007-0070-001200000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: 'c709129b-5cc7-519e-b079-6154307a3260',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0008-0070-001200000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: 'bece9554-2a0b-5f1b-8117-8b8bf83956b1',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0009-0070-001200000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '1881caf1-88b4-5215-b59e-c927f31c8470',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-000b-0070-001200000000',
    lifecycleDefinitionId: DND5E_LEGENDARY_ACTION_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '00000000-0005-0015-0070-164e00000000',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 3
    },
    actionCosts: [
      {
        optionId: '00000000-0005-00c9-0070-001200000000',
        chargeId: '00000000-0005-0015-0070-164e00000000',
        cost: 1
      },
      {
        optionId: '00000000-0005-00ca-0070-001200000000',
        chargeId: '00000000-0005-0015-0070-164e00000000',
        cost: 1
      },
      {
        optionId: '00000000-0005-00cb-0070-001200000000',
        chargeId: '00000000-0005-0015-0070-164e00000000',
        cost: 1
      }
    ]
  },
  {
    featureId: '00000000-0001-0002-0070-001300000000',
    lifecycleDefinitionId: DND5E_LEGENDARY_RESISTANCE_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '00000000-0005-0014-0070-001300000000',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'LONG_REST',
      amount: 3
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0008-0070-001300000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '7a3f9498-f492-5597-8624-4aa08c3f3d78',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0009-0070-001300000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: 'f429ee7d-0a01-5631-9048-0a64ab65e956',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-000a-0070-001300000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '3edf57b9-932c-5ecd-a823-6d14da9dc0be',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-000c-0070-001300000000',
    lifecycleDefinitionId: DND5E_LEGENDARY_ACTION_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '00000000-0005-0015-0070-001300000000',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 3
    },
    actionCosts: [
      {
        optionId: '00000000-0005-00c9-0070-001300000000',
        chargeId: '00000000-0005-0015-0070-001300000000',
        cost: 1
      },
      {
        optionId: '00000000-0005-00ca-0070-001300000000',
        chargeId: '00000000-0005-0015-0070-001300000000',
        cost: 1
      },
      {
        optionId: '00000000-0005-00cb-0070-001300000000',
        chargeId: '00000000-0005-0015-0070-001300000000',
        cost: 1
      }
    ]
  },
  {
    featureId: '00000000-0001-0002-0070-001400000000',
    lifecycleDefinitionId: DND5E_LEGENDARY_RESISTANCE_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '00000000-0005-0014-0070-001400000000',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 3
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0008-0070-001400000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '6e346f06-cf1d-5c86-a25c-be4ca3874609',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0009-0070-001400000000',
    lifecycleDefinitionId: DND5E_LEGENDARY_ACTION_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '00000000-0005-0015-0070-001400000000',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 3
    },
    actionCosts: [
      {
        optionId: '00000000-0005-00ca-0070-001400000000',
        chargeId: '00000000-0005-0015-0070-001400000000',
        cost: 1
      },
      {
        optionId: '00000000-0005-00cb-0070-001400000000',
        chargeId: '00000000-0005-0015-0070-001400000000',
        cost: 1
      }
    ]
  },
  {
    featureId: '00000000-0001-0001-0070-001500000000',
    lifecycleDefinitionId: DND5E_LEGENDARY_RESISTANCE_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '00000000-0005-0014-0070-001500000000',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 3
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0007-0070-001500000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: 'ea2f83d2-5875-5ea2-bb0a-cedea680e044',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0008-0070-001500000000',
    lifecycleDefinitionId: DND5E_LEGENDARY_ACTION_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '00000000-0005-0015-0070-001500000000',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 3
    },
    actionCosts: [
      {
        optionId: '00000000-0005-00ca-0070-001500000000',
        chargeId: '00000000-0005-0015-0070-001500000000',
        cost: 1
      },
      {
        optionId: '00000000-0005-00cb-0070-001500000000',
        chargeId: '00000000-0005-0015-0070-001500000000',
        cost: 2
      }
    ]
  },
  {
    featureId: '00000000-0001-0001-0070-001600000000',
    lifecycleDefinitionId: DND5E_LEGENDARY_RESISTANCE_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '00000000-0005-0014-0070-001600000000',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'LONG_REST',
      amount: 3
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0007-0070-001600000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: 'd81eb904-a6eb-5cf9-b111-9ab00a2b566a',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0008-0070-001600000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: 'da622f71-cb72-57a5-9562-c822a028f86f',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0009-0070-001600000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: 'f7e60de5-a2d1-552a-afa0-cbb6b661c3c8',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-000b-0070-001600000000',
    lifecycleDefinitionId: DND5E_LEGENDARY_ACTION_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '00000000-0005-0015-0070-001600000000',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 3
    },
    actionCosts: [
      {
        optionId: '00000000-0005-00c9-0070-001600000000',
        chargeId: '00000000-0005-0015-0070-001600000000',
        cost: 1
      },
      {
        optionId: '00000000-0005-00ca-0070-001600000000',
        chargeId: '00000000-0005-0015-0070-001600000000',
        cost: 1
      },
      {
        optionId: '00000000-0005-00cb-0070-001600000000',
        chargeId: '00000000-0005-0015-0070-001600000000',
        cost: 1
      }
    ]
  },
  {
    featureId: '00000000-0001-0002-0070-001700000000',
    lifecycleDefinitionId: DND5E_LEGENDARY_RESISTANCE_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '00000000-0005-0014-0070-001700000000',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'LONG_REST',
      amount: 3
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0008-0070-001700000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '4269976b-2e2e-5de2-b338-05c92ce6ffaa',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0009-0070-001700000000',
    lifecycleDefinitionId: DND5E_LEGENDARY_ACTION_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '00000000-0005-0015-0070-001700000000',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 3
    },
    actionCosts: [
      {
        optionId: '00000000-0005-00ca-0070-001700000000',
        chargeId: '00000000-0005-0015-0070-001700000000',
        cost: 1
      },
      {
        optionId: '00000000-0005-00cb-0070-001700000000',
        chargeId: '00000000-0005-0015-0070-001700000000',
        cost: 1
      }
    ]
  },
  {
    featureId: '00000000-0001-0006-0070-001800000000',
    lifecycleDefinitionId: DND5E_LEGENDARY_ACTION_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '00000000-0005-0063-0070-001800000000',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 3
    },
    actionCosts: [
      {
        optionId: '00000000-0005-00c9-0070-001800000000',
        chargeId: '00000000-0005-0063-0070-001800000000',
        cost: 1
      },
      {
        optionId: '00000000-0005-00ca-0070-001800000000',
        chargeId: '00000000-0005-0063-0070-001800000000',
        cost: 2
      }
    ]
  },
  {
    featureId: '00000000-0001-0002-0070-001a00000000',
    lifecycleDefinitionId: DND5E_RECHARGE_6_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '00000000-0002-0007-0070-001a00000000',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0004-0070-002b00000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '00000000-0002-000f-0070-002b00000000',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0003-0070-002e00000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '77ca3ee5-a405-508f-8f3d-c3bd1e5d7ff1',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0004-0070-003000000000',
    lifecycleDefinitionId: DND5E_RECHARGE_4_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '00000000-0002-0007-0070-003000000000',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0002-0070-003200000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '491b2282-83d4-5a71-a9fe-a6853b0ee7a4',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0002-0070-003500000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '4c4aeb1e-199a-5b79-aaf1-f87535da170d',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0003-0070-003600000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: 'e7322e9d-9e81-53a5-9e6c-5667823284c3',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0006-0070-003e00000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '015b6483-eaee-5ce1-8fe7-1da0312a6b45',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0008-0070-004000000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: 'f7f61454-c4c9-5854-aafa-d3d9657df7ed',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0003-0070-004600000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '5838eb2e-171a-5a0a-af08-b0bce45f60d0',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0006-0070-005500000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '3e50c070-07c9-5963-a043-175b1841fb82',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0004-0070-005c00000000',
    lifecycleDefinitionId: DND5E_RECHARGE_6_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '5df3894f-3de0-5a60-a03d-e8ee44dcc4e1',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0007-0070-006300000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '53e15d27-cbdd-5794-b573-5e591c713cc1',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0006-0070-006f00000000',
    lifecycleDefinitionId: DND5E_RECHARGE_6_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: 'fea8c6e2-fa56-5c94-99eb-795517c11213',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0005-0070-008700000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '265e1b64-8aef-592f-901c-516c6a05b941',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0005-0070-008d00000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: 'e33990d1-ddc8-53bd-bbde-9dfbd977aeff',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0003-0070-009300000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '0b87065f-0454-5135-a50a-5a2bd27166ac',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0004-0070-009400000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '58dd6d45-233a-5461-81f9-1c44588e0bd1',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0003-0070-009600000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '88ad52cf-aeca-52c4-90df-556399ad94b0',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0006-0070-009d00000000',
    lifecycleDefinitionId: DND5E_LEGENDARY_ACTION_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '00000000-0005-00d0-0070-009d00000000',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 3
    },
    actionCosts: [
      {
        optionId: '00000000-0005-00c9-0070-009d00000000',
        chargeId: '00000000-0005-00d0-0070-009d00000000',
        cost: 1
      },
      {
        optionId: '00000000-0005-00ca-0070-009d00000000',
        chargeId: '00000000-0005-00d0-0070-009d00000000',
        cost: 2
      },
      {
        optionId: '00000000-0005-00cb-0070-009d00000000',
        chargeId: '00000000-0005-00d0-0070-009d00000000',
        cost: 3
      }
    ]
  },
  {
    featureId: '00000000-0001-0005-0070-009e00000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '8d99cfa7-9c02-54ec-a831-e2e7d5de036c',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0005-0070-00a100000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: 'd142fdf2-b382-57c6-b433-52721a41ff25',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0005-0070-00ac00000000',
    lifecycleDefinitionId: DND5E_RECHARGE_6_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '3f9db45c-46f4-530d-9636-c8ed8eba8f4b',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0009-0070-00af00000000',
    lifecycleDefinitionId: DND5E_RECHARGE_6_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: 'ddd9b6a5-7ae2-5452-ac40-db8799e37906',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0001-0070-00b700000000',
    lifecycleDefinitionId: DND5E_LEGENDARY_RESISTANCE_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '00000000-0005-0014-0070-0aea00000000',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 3
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0006-0070-00b700000000',
    lifecycleDefinitionId: DND5E_LEGENDARY_ACTION_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '00000000-0005-0015-0070-0aea00000000',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 3
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0005-0070-00bc00000000',
    lifecycleDefinitionId: DND5E_RECHARGE_6_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: 'd4ae204c-2cb8-5e1c-a850-73769a189417',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0007-0070-00ca00000000',
    lifecycleDefinitionId: DND5E_LEGENDARY_ACTION_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '00000000-0005-01f4-0070-00ca00000000',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 3
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0006-0070-00cb00000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '14582770-e160-5b2f-9be1-d5be60f824bb',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0002-0070-00e900000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '6be4e20b-c9e9-5a60-83a9-5c8278b07d80',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0002-0070-00fe00000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: 'ffb9fef7-acfb-57d1-9ce3-358a4a9d79e5',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0004-0070-010600000000',
    lifecycleDefinitionId: DND5E_RECHARGE_6_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: 'ce64c3ab-0799-51cf-ba77-7b9777bf11f7',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0006-0070-010a00000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '806e54d1-06c2-50a4-b6d4-47ca0c18c77e',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0001-0070-010c00000000',
    lifecycleDefinitionId: DND5E_LEGENDARY_RESISTANCE_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '00000000-0002-00c8-0070-010c00000000',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'LONG_REST',
      amount: 3
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-000b-0070-011400000000',
    lifecycleDefinitionId: DND5E_LEGENDARY_ACTION_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '00000000-0005-0001-0070-011400000000',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 3
    },
    actionCosts: [
      {
        optionId: '00000000-0005-00c9-0070-011400000000',
        chargeId: '00000000-0005-0001-0070-011400000000',
        cost: 1
      },
      {
        optionId: '00000000-0005-00ca-0070-011400000000',
        chargeId: '00000000-0005-0001-0070-011400000000',
        cost: 1
      },
      {
        optionId: '00000000-0005-00cb-0070-011400000000',
        chargeId: '00000000-0005-0001-0070-011400000000',
        cost: 1
      }
    ]
  },
  {
    featureId: '00000000-0001-0002-0070-011500000000',
    lifecycleDefinitionId: DND5E_LEGENDARY_RESISTANCE_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '00000000-0005-0015-0070-011500000000',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 3
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0011-0070-011500000000',
    lifecycleDefinitionId: DND5E_LEGENDARY_ACTION_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '00000000-0005-0017-0070-011500000000',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 3
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0006-0070-011900000000',
    lifecycleDefinitionId: DND5E_RECHARGE_6_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '4645c08d-79e7-504e-8712-d2e736e4845a',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0002-0070-012400000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: 'c5abcf48-4f81-53bb-9cf4-e8e01f6cfde2',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0005-0070-012700000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: 'e311826f-4f53-58cd-8243-aa3c8731abe3',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0005-0070-012d00000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: 'f0685822-c770-5c68-8674-69f73cc74903',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0004-0070-012e00000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: 'd7bf70ec-1cbb-5dbd-8a61-8ff068af6db4',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0004-0070-012f00000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '8aa66284-a077-5064-9a9c-b7e2510bcc3d',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0005-0070-012f00000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: 'a60a1c18-fa2f-5a9e-84bb-21e72ad2ec7b',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0005-0070-013000000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '197d3073-f01f-5850-9b96-bb13bd907b2a',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0006-0070-013000000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: 'd00b9fa5-f0f9-5661-9e96-463cddaab719',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0005-0070-013300000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: 'd7fb5b2a-f6a2-5dcb-9fb6-2d77835ba5a8',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0004-0070-013400000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '68c9daa7-0d89-55df-9c35-5a0cbdcd745a',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0004-0070-013500000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: '6c197d98-0ccc-583c-9a73-2829748c5e5b',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  },
  {
    featureId: '00000000-0001-0005-0070-013600000000',
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
    charge: {
      id: 'cb276526-3768-5bcb-b52e-a348f1d8ff60',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 1
    },
    actionCosts: []
  }
] as const

const rechargeDefinitionIds = new Set([
  DND5E_RECHARGE_4_LIFECYCLE_DEFINITION_ID,
  DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
  DND5E_RECHARGE_6_LIFECYCLE_DEFINITION_ID
])

const allFeatures = srdCreatureRecords.flatMap((creature) => creature.features ?? [])

describe('SRD encounter lifecycle source bindings', () => {
  it('retains canonical Cloaker, Rug, and Clay creature action source facts for the Functions-local tracers', () => {
    const creature = (label: string) => {
      const value = srdCreatureRecords.find((candidate) => candidate.label === label)
      if (!value) throw new Error(`Missing canonical SRD creature: ${label}.`)
      return value
    }
    const actionEffect = (label: string, featureLabel: string) => {
      const feature = (creature(label).features ?? []).find(
        (candidate) => candidate.label === featureLabel
      )
      const effect = feature?.effects?.[0]
      if (!feature || !effect) throw new Error(`Missing ${label} ${featureLabel} action Effect.`)
      expect(feature.id).toMatch(/^[0-9a-f-]{36}$/)
      expect(effect.id).toMatch(/^[0-9a-f-]{36}$/)
      expect(effect.invocation.kind).toBe('ACTION')
      return effect
    }

    const bite = actionEffect('Cloaker', 'Bite')
    expect(bite).toMatchObject({
      invocation: {
        triggerCode: 'MELEE_WEAPON_ATTACK',
        targeting: { selectionKind: 'SINGLE_TARGET' }
      },
      paths: [
        expect.objectContaining({
          pathCode: 'ON_HIT',
          resultBlock: expect.objectContaining({
            outcomes: expect.arrayContaining([
              expect.objectContaining({
                effectKind: 'DAMAGE',
                diceConfig: '2d6',
                bonuses: [
                  expect.objectContaining({ bonusKind: 'ABILITY_BONUS', ability: 'STRENGTH' })
                ]
              }),
              expect.objectContaining({
                effectKind: 'ACTOR_RELATIONSHIP',
                modules: expect.arrayContaining([
                  expect.objectContaining({ kind: 'TARGET_SIZE_MAXIMUM', sizeCode: 'LARGE' })
                ])
              })
            ])
          })
        })
      ]
    })

    const smother = actionEffect('Rug Of Smothering', 'Smother')
    const smotherOutcomes = smother.paths.flatMap((path) =>
      'resultBlock' in path ? path.resultBlock.outcomes : []
    )
    const relationship = smotherOutcomes.find(
      (outcome) => outcome.effectKind === 'ACTOR_RELATIONSHIP'
    )
    if (!relationship || relationship.effectKind !== 'ACTOR_RELATIONSHIP') {
      throw new Error('Missing Rug Smother relationship outcome.')
    }
    expect(relationship).toMatchObject({
      modules: expect.arrayContaining([
        expect.objectContaining({ kind: 'TARGET_SIZE_MAXIMUM', sizeCode: 'MEDIUM' }),
        expect.objectContaining({ kind: 'SOURCE_EXCLUSIVE_TARGET', maximum: 1 }),
        expect.objectContaining({ kind: 'TARGET_CAPABILITY_SUPPRESSION' })
      ]),
      conditions: expect.arrayContaining([
        expect.objectContaining({ conditionId: expect.any(String) })
      ]),
      recurrence: {
        stage: 'START_OF_TURN',
        damage: expect.objectContaining({ diceConfig: '2d6+3' })
      }
    })
    expect(smotherOutcomes.filter((outcome) => outcome.effectKind === 'DAMAGE')).toEqual([])
    const restriction = relationship.modules.find(
      (module) => module.kind === 'SOURCE_ACTION_TARGET_RESTRICTION'
    )
    expect(restriction).toMatchObject({ actionEffectIds: [smother.id] })

    const slam = actionEffect('Clay Golem', 'Slam')
    expect(slam).toMatchObject({
      paths: [
        expect.objectContaining({
          pathCode: 'ON_HIT',
          resultBlock: expect.objectContaining({
            outcomes: expect.arrayContaining([
              expect.objectContaining({
                effectKind: 'DAMAGE',
                diceConfig: '2d10',
                bonuses: [
                  expect.objectContaining({ bonusKind: 'ABILITY_BONUS', ability: 'STRENGTH' })
                ]
              }),
              expect.objectContaining({
                effectKind: 'FOLLOW_UP_SAVE',
                savingThrow: expect.objectContaining({ baseDc: 15 }),
                onFailure: expect.objectContaining({
                  outcomes: [expect.objectContaining({ effectKind: 'HIT_POINT_MAXIMUM_REDUCTION' })]
                })
              })
            ])
          })
        })
      ]
    })
    for (const effect of [bite, smother, slam]) compileEffect(effect)
  })

  it('matches the authoritative lifecycle catalogue without inferred source bindings', () => {
    const expectedByFeatureId = new Map(
      authoritativeLifecycleFeatureCatalogue.map((entry) => [entry.featureId, entry])
    )
    const actualFeatures = allFeatures.filter((feature) =>
      feature.ruleDefinitionIds?.some((definitionId) =>
        [
          DND5E_LEGENDARY_ACTION_LIFECYCLE_DEFINITION_ID,
          DND5E_LEGENDARY_RESISTANCE_LIFECYCLE_DEFINITION_ID,
          ...rechargeDefinitionIds
        ].includes(definitionId)
      )
    )
    expect(actualFeatures.map((feature) => feature.id).sort()).toEqual(
      [...expectedByFeatureId.keys()].sort()
    )
    for (const entry of authoritativeLifecycleFeatureCatalogue) {
      const feature = allFeatures.find((candidate) => candidate.id === entry.featureId)
      expect(feature).toBeDefined()
      expect(feature!.ruleDefinitionIds).toEqual([entry.lifecycleDefinitionId])
      expect(feature!.charges).toEqual(entry.charge)
      expect(
        (feature!.options ?? []).flatMap((option) =>
          (option.effects ?? []).flatMap((effect) =>
            effect.invocation.kind === 'ACTION' && effect.invocation.resourceUse
              ? [
                  {
                    optionId: option.id,
                    chargeId: effect.invocation.resourceUse.chargeId,
                    cost: effect.invocation.resourceUse.cost
                  }
                ]
              : []
          )
        )
      ).toEqual(entry.actionCosts)
    }
    for (const entry of restRecoveryRechargeExclusions) {
      const feature = allFeatures.find((candidate) => candidate.id === entry.featureId)
      expect(feature).toBeDefined()
      expect(feature!.attributes).toEqual(['LIMITED_USE'])
      expect(feature!.charges).toEqual({
        id: entry.chargeId,
        limitKind: 'FIXED_AMOUNT',
        scalingKind: 'NONE',
        resetKind: 'SHORT_REST',
        amount: 1
      })
      expect(
        (feature!.effects ?? []).flatMap((effect) =>
          effect.invocation.kind === 'ACTION' && effect.invocation.resourceUse
            ? [effect.invocation.resourceUse]
            : []
        )
      ).toEqual(entry.actionCosts)
      expect(
        feature!.ruleDefinitionIds?.some((definitionId) => rechargeDefinitionIds.has(definitionId))
      ).not.toBe(true)
    }
  })

  it('binds every structured legendary action to exactly one canonical lifecycle definition', () => {
    const features = allFeatures.filter((feature) => feature.section === 'LEGENDARY_ACTION')
    expect(features).toHaveLength(26)
    for (const feature of features)
      expect(feature.ruleDefinitionIds).toEqual([DND5E_LEGENDARY_ACTION_LIFECYCLE_DEFINITION_ID])
  })

  it('parses and compiles every canonical Legendary Action option with unique identities and exact pool costs', () => {
    const features = allFeatures.filter((feature) => feature.section === 'LEGENDARY_ACTION')
    expect(features).toHaveLength(26)
    const optionIds = new Set<string>()
    for (const feature of features) {
      const parsed = featureDtoSchema.parse(feature)
      const options = parsed.options ?? []
      expect(new Set(options.map((option) => option.id)).size).toBe(options.length)
      expect(parsed.effects?.some((effect) => effect.invocation.kind === 'ACTION') ?? false).toBe(
        false
      )
      for (const option of options) {
        expect(optionIds.has(option.id)).toBe(false)
        optionIds.add(option.id)
      }

      for (const effect of [
        ...(parsed.effects ?? []),
        ...options.flatMap((option) => option.effects ?? [])
      ])
        compileEffect(effect)

      for (const option of options) {
        for (const effect of option.effects ?? []) {
          if (effect.invocation.kind !== 'ACTION') continue
          expect(effect.invocation.resourceUse).toEqual({
            chargeId: parsed.charges?.id,
            cost: expect.any(Number)
          })
          expect(effect.invocation.resourceUse!.cost).toBeGreaterThan(0)
        }
      }
    }
  })

  it('binds every canonical Legendary Resistance Feature to its UUID, resource, and closed rule', () => {
    const features = allFeatures.filter((feature) =>
      feature.ruleDefinitionIds?.includes(DND5E_LEGENDARY_RESISTANCE_LIFECYCLE_DEFINITION_ID)
    )
    expect(features).toHaveLength(23)
    for (const feature of features) {
      expect(feature.ruleDefinitionIds).toEqual([
        DND5E_LEGENDARY_RESISTANCE_LIFECYCLE_DEFINITION_ID
      ])
      expect(feature.charges).toBeDefined()
    }
    expect(
      features
        .filter(
          (feature) =>
            !feature.effects?.some((effect) =>
              effect.paths?.some((path) =>
                ('resultBlock' in path ? path.resultBlock.outcomes : []).some(
                  (outcome) =>
                    outcome.effectKind === 'CLOSED_RULE' &&
                    outcome.ruleKind === CLOSED_RULE_KIND.CREATURE_LEGENDARY_RESISTANCE
                )
              )
            )
        )
        .map((feature) => feature.id)
    ).toEqual([])
    expect(
      allFeatures
        .filter((feature) => unrelatedFeatureIds.has(feature.id))
        .some((feature) =>
          feature.ruleDefinitionIds?.includes(DND5E_LEGENDARY_RESISTANCE_LIFECYCLE_DEFINITION_ID)
        )
    ).toBe(false)
  })

  it('binds each d6 recharge Feature to one canonical UUID and a Feature-owned resource', () => {
    const features = allFeatures.filter((feature) =>
      feature.ruleDefinitionIds?.some((definitionId) => rechargeDefinitionIds.has(definitionId))
    )
    expect(features).toHaveLength(75)
    for (const feature of features) {
      expect(feature.ruleDefinitionIds).toHaveLength(1)
      expect(rechargeDefinitionIds.has(feature.ruleDefinitionIds![0]!)).toBe(true)
      expect(feature.charges).toBeDefined()
    }
    expect(features.length + restRecoveryRechargeExclusions.length).toBe(83)
    expect(
      restRecoveryRechargeExclusions.every((entry) =>
        allFeatures.some(
          (feature) =>
            feature.id === entry.featureId &&
            !feature.ruleDefinitionIds?.some((definitionId) =>
              rechargeDefinitionIds.has(definitionId)
            )
        )
      )
    ).toBe(true)
  })

  it('uses exactly the canonical lifecycle UUIDs at the authored source boundary', () => {
    const expectedLifecycleIds = [
      DND5E_LEGENDARY_ACTION_LIFECYCLE_DEFINITION_ID,
      DND5E_LEGENDARY_RESISTANCE_LIFECYCLE_DEFINITION_ID,
      ...rechargeDefinitionIds
    ].sort()
    const actualLifecycleIds = [
      ...new Set(
        allFeatures.flatMap(
          (feature) =>
            feature.ruleDefinitionIds?.filter((definitionId) =>
              expectedLifecycleIds.includes(definitionId)
            ) ?? []
        )
      )
    ].sort()
    expect(actualLifecycleIds).toEqual(expectedLifecycleIds)
  })

  it('models Quasit Claws and Scare through structured follow-up saves', () => {
    const claws = quasit.features?.find((feature) => feature.label === 'Claws')
    const scare = quasit.features?.find((feature) => feature.label === 'Scare')
    const clawsEffect = claws?.effects?.[0]
    const clawsPath = clawsEffect?.paths?.[0]
    const clawsOutcomes =
      clawsPath && 'resultBlock' in clawsPath ? clawsPath.resultBlock.outcomes : undefined
    const scareEffect = scare?.effects?.[0]
    const scarePath = scareEffect?.paths?.[0]
    const scareResourceUse =
      scareEffect && 'resourceUse' in scareEffect.invocation
        ? scareEffect.invocation.resourceUse
        : undefined
    const scareResultBlock =
      scarePath && 'resultBlock' in scarePath ? scarePath.resultBlock : undefined

    expect(claws?.effects).toHaveLength(1)
    expect(clawsOutcomes).toMatchObject([
      { effectKind: 'DAMAGE', diceConfig: '1d4' },
      {
        effectKind: 'FOLLOW_UP_SAVE',
        timing: 'IMMEDIATE',
        repeatTiming: 'TARGET_TURN_END',
        savingThrow: { baseDc: 10 },
        attempts: { kind: 'ONCE', repeatOnFailure: true },
        onSuccess: { kind: 'END' },
        onFailure: {
          kind: 'OUTCOMES',
          outcomes: [{ effectKind: 'DAMAGE', diceConfig: '2d4' }, { effectKind: 'CONDITION' }]
        }
      }
    ])
    expect(JSON.stringify(clawsEffect)).not.toContain('CREATURE_QUASIT_CLAWS')
    expect(() => compileEffect(clawsEffect!)).not.toThrow()

    expect(scare).toMatchObject({
      attributes: ['LIMITED_USE'],
      charges: { limitKind: 'FIXED_AMOUNT', resetKind: 'DAILY', amount: 1 }
    })
    expect(scareResourceUse).toEqual({
      chargeId: scare?.charges?.id,
      cost: 1
    })
    expect(scareResultBlock).toMatchObject({
      duration: { durationKind: 'ROUND', amount: 10 },
      outcomes: [
        { effectKind: 'CONDITION' },
        {
          effectKind: 'FOLLOW_UP_SAVE',
          timing: 'TARGET_TURN_END',
          attempts: { kind: 'ONCE', repeatOnFailure: true },
          repeatRollInfluence: {
            influence: 'DISADVANTAGE',
            when: { kind: 'PERCEPTION', observer: 'TARGET', subject: 'SOURCE', requirement: 'SEE' }
          },
          onSuccess: { kind: 'END' },
          onFailure: { kind: 'CONTINUE' },
          onDurationComplete: { kind: 'END' }
        }
      ]
    })
    expect(JSON.stringify(scareEffect)).not.toContain('CREATURE_QUASIT_SCARE')
    expect(() => compileEffect(scareEffect!)).not.toThrow()
  })
})
