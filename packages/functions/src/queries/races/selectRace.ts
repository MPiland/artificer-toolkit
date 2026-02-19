import type { Database } from '@artificer-toolkit/db/types'
import { RaceAncestryOption, type Race, type Speed } from '@artificer-toolkit/shared/types'
import { details } from '#queries/fragments'
import { features } from '#queries/features'
import type { ExpressionBuilder, RawBuilder } from 'kysely'
import { jsonBuildObject, jsonArrayFrom } from 'kysely/helpers/postgres'

export function selectRace(eb: ExpressionBuilder<Database, 'races'>): RawBuilder<Race> {
  return jsonBuildObject({
    id: eb.ref('id'),
    label: eb.ref('label'),
    quote: eb.ref('quote'),
    description: eb.ref('description'),
    playable: eb
      .case()
      .when(eb.ref('playable'))
      .then('yes')
      .else('no')
      .end(),
    categoryId: eb.ref('category_id'),
    parentRaceId: eb.ref('parent_race_id'),
    traits: jsonBuildObject({
      sizeId: eb.ref('size_id').$notNull(),
      details:
        details(eb, (eb2) => eb2
          .selectFrom('race_details as bridge')
          .select([
            'bridge.detail_id',
            'bridge.position'
          ])
          .whereRef('bridge.race_id', '=', eb.ref('id'))
          .orderBy('bridge.position')),
      speeds: jsonArrayFrom<Speed>(
        eb
          .selectFrom('race_speeds')
          .select([
            'speed_id as id',
            'amount',
            'unit_id as unitId'
          ])
          .whereRef('race_id', '=', 'id')
      )
    }),
    ancestry: eb
      .selectFrom('race_ancestry')
      .select((eb2) => [
        'id',
        'label',
        'description',
        jsonArrayFrom<RaceAncestryOption>(
          eb2
            .selectFrom('race_ancestry_options')
            .select((eb3) => [
              'id',
              'label',
              'description',
              'position',
              features(eb3, (eb4) => eb4
                .selectFrom('race_ancestry_option_features as bridge')
                .select([
                  'bridge.feature_id',
                  'bridge.position'
                ])
                .whereRef('bridge.feature_id', '=', 'id')).as('features')
            ])
            .$narrowType<{ description: string }>()
            .whereRef('race_ancestry_id', '=', 'id')
        ).as('options')
      ])
      .whereRef('race_id', '=', 'id'),
    features: features(eb, (eb2) => eb2
      .selectFrom('race_features as bridge')
      .select([
        'bridge.feature_id',
        'bridge.position'
      ])
      .whereRef('bridge.race_id', '=', 'id')
      .orderBy('bridge.position')),
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
