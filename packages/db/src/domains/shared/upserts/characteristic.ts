import {
  type DurationAuthored,
  type RangeAuthored,
  type ShapeAuthored
} from '@artificer-toolkit/shared'
import type { SupabaseDatabase, DBLike } from '@db-types'
import { assertNever } from '../../../utils/index.js'

export function mapRangeToRow(
  json_data: RangeAuthored,
  characteristic_id: string
): Omit<
  SupabaseDatabase['public']['Tables']['characteristic_ranges']['Row'],
  'created_at' | 'updated_at'
> {
  switch (json_data.rangeKind) {
    case 'DISTANCE':
      return {
        characteristic_id,
        kind: 'DISTANCE',
        min: json_data.amount,
        max: null,
        unit_code: json_data.unit
      }

    case 'SELF':
    case 'SIGHT':
    case 'TOUCH':
    case 'UNLIMITED':
      return {
        characteristic_id,
        kind: json_data.rangeKind,
        min: null,
        max: null,
        unit_code: null
      }

    default:
      assertNever(json_data)
  }
}

export async function upsertRange(db: DBLike, json_data: RangeAuthored) {
  await db
    .insertInto('characteristics')
    .values({
      id: json_data.id,
      code: 'RANGE'
    })
    .onConflict((oc) => oc.column('id')
      .doUpdateSet(({ ref }) => ({
        code: ref('excluded.code')
      })))
    .returning('id')
    .executeTakeFirstOrThrow()

  const row = mapRangeToRow(json_data, json_data.id)

  await db
    .insertInto('characteristic_ranges')
    .values(row)
    .onConflict((oc) => oc.column('characteristic_id')
      .doUpdateSet(({ ref }) => ({
        kind: ref('excluded.kind'),
        min: ref('excluded.min'),
        max: ref('excluded.max'),
        unit_code: ref('excluded.unit_code')
      })))
    .returning('characteristic_id')
    .executeTakeFirstOrThrow()
}

export function mapDurationToRow(
  json_data: DurationAuthored,
  characteristic_id: string
): Omit<
  SupabaseDatabase['public']['Tables']['characteristic_durations']['Row'],
  'created_at' | 'updated_at'
> {
  switch (json_data.durationKind) {
    case 'INSTANTANEOUS':
      return {
        characteristic_id,
        kind: 'INSTANTANEOUS',
        amount: null
      }

    case 'DAY':
    case 'HOUR':
    case 'MINUTE':
    case 'MONTH':
    case 'ROUND':
    case 'TURN':
    case 'WEEK':
    case 'YEAR':
      return {
        characteristic_id,
        kind: json_data.durationKind,
        amount: json_data.amount ?? null
      }

    default:
      throw new Error('Invalid duration kind')
  }
}

export async function upsertDuration(db: DBLike, json_data: DurationAuthored) {
  await db
    .insertInto('characteristics')
    .values({
      id: json_data.id,
      code: 'DURATION'
    })
    .onConflict((oc) => oc.column('id')
      .doUpdateSet(({ ref }) => ({
        code: ref('excluded.code')
      })))
    .returning('id')
    .executeTakeFirstOrThrow()

  const row = mapDurationToRow(json_data, json_data.id)

  await db
    .insertInto('characteristic_durations')
    .values(row)
    .onConflict((oc) => oc.column('characteristic_id')
      .doUpdateSet(({ ref }) => ({
        kind: ref('excluded.kind'),
        amount: ref('excluded.amount')
      })))
    .returning('characteristic_id')
    .executeTakeFirstOrThrow()
}

export function mapShapeDimensionsToRow(
  json_data: ShapeAuthored,
  characteristic_id: string
): Omit<
  SupabaseDatabase['public']['Tables']['characteristic_shape_dimensions']['Row'],
  'created_at' | 'updated_at'
>[] {
  switch (json_data.shapeKind) {
    case 'LINE':
    case 'CONE':
      return [
        {
          characteristic_id,
          dimension: 'LENGTH',
          amount: json_data.length.amount,
          unit_code: json_data.length.unit
        }
      ]

    case 'CUBE':
      return [
        {
          characteristic_id,
          dimension: 'EDGE_LENGTH',
          amount: json_data.edgeLength.amount,
          unit_code: json_data.edgeLength.unit
        }
      ]
    case 'CYLINDER': {
      const array = [
        {
          characteristic_id,
          dimension: 'RADIUS',
          amount: json_data.radius.amount,
          unit_code: json_data.radius.unit
        }
      ]

      if (json_data.height) {
        array.push({
          characteristic_id,
          dimension: 'HEIGHT',
          amount: json_data.height.amount,
          unit_code: json_data.height.unit
        })
      }
      return array
    }

    case 'CIRCLE':
    case 'SPHERE':
    case 'DOME':
      return [
        {
          characteristic_id,
          dimension: 'RADIUS',
          amount: json_data.radius.amount,
          unit_code: json_data.radius.unit
        }
      ]
    case 'WALL': {
      const array = [
        {
          characteristic_id,
          dimension: 'LENGTH',
          amount: json_data.length.amount,
          unit_code: json_data.length.unit
        },
        {
          characteristic_id,
          dimension: 'HEIGHT',
          amount: json_data.height.amount,
          unit_code: json_data.height.unit
        }
      ]

      if (json_data.thickness) {
        array.push({
          characteristic_id,
          dimension: 'THICKNESS',
          amount: json_data.thickness.amount,
          unit_code: json_data.thickness.unit
        })
      }
      return array
    }

    default:
      assertNever(json_data)
  }
}

export async function upsertShape(db: DBLike, json_data: ShapeAuthored) {
  await db
    .insertInto('characteristics')
    .values({
      id: json_data.id,
      code: 'SHAPE'
    })
    .onConflict((oc) => oc.column('id')
      .doUpdateSet(({ ref }) => ({
        code: ref('excluded.code')
      })))
    .returning('id')
    .executeTakeFirstOrThrow()

  await db
    .insertInto('characteristic_shapes')
    .values({
      characteristic_id: json_data.id,
      kind: json_data.shapeKind
    })
    .onConflict((oc) => oc.column('characteristic_id')
      .doUpdateSet(({ ref }) => ({
        kind: ref('excluded.kind')
      })))
    .execute()

  const rows = mapShapeDimensionsToRow(json_data, json_data.id)

  await db
    .deleteFrom('characteristic_shape_dimensions')
    .where('characteristic_id', '=', json_data.id)
    .execute()

  await db
    .insertInto('characteristic_shape_dimensions')
    .values(rows)
    .onConflict((oc) => oc.columns(['characteristic_id', 'dimension'])
      .doUpdateSet(({ ref }) => ({
        amount: ref('excluded.amount'),
        unit_code: ref('excluded.unit_code')
      })))
    .execute()
}
