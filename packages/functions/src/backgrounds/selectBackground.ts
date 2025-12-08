import type { Database } from '@artificer/db'
import type { Background } from '@artificer/shared/types'
import { details, startingEquipment } from '@functions/fragments'
import type { ExpressionBuilder, RawBuilder } from 'kysely'
import { subfeatureProficiencies } from '@functions/subfeatureProficiencies'
import { features } from '@functions/features'
import { jsonBuildObject } from 'kysely/helpers/postgres'

export function selectBackground(eb: ExpressionBuilder<Database, 'backgrounds'>): RawBuilder<Background> {
  return jsonBuildObject({
    id: eb.ref('id'),
    label: eb.ref('label'),
    description: eb.ref('description'),
    proficiencies: subfeatureProficiencies(eb, (eb2) => eb2
      .selectFrom('background_subfeature_proficiencies as bridge')
      .select([
        'bridge.subfeature_proficiency_id',
        'bridge.position'
      ])
      .whereRef('background_id', '=', 'id')
      .orderBy('bridge.position', 'asc')),
    details: details(eb, (eb2) => eb2
      .selectFrom('background_details as bridge')
      .select([
        'bridge.detail_id',
        'bridge.position'
      ])
      .whereRef('background_id', '=', 'id')
      .orderBy('bridge.position', 'asc')),
    equipment: eb
      .case()
      .when(eb.ref('starting_equipment_id'), 'is not', null)
      .then(startingEquipment(eb))
      .else(null)
      .end(),
    features: features(eb, (eb2) => eb2
      .selectFrom('background_features as bridge')
      .select([
        'bridge.feature_id',
        'bridge.position'
      ])
      .whereRef('background_id', '=', 'id')
      .orderBy('bridge.position', 'asc')),
    userId: eb
      .case()
      .when(eb.ref('is_master'), 'is', true)
      .then('master')
      .else(eb.ref('user_id'))
      .end()
      .$notNull(),
    systemId: eb.ref('system_id')
  })
}
