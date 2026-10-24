import type { SpeedDto } from '@artificer-toolkit/schema/shared/speed'
import type { FunctionArgs, FunctionReturnType } from 'convex/server'
import { describe, expectTypeOf, it } from 'vitest'

import type { api } from './_generated/api'

/**
 * Type-level proof, checked by `typecheck:convex`: `zodToConvex` types a zod intersection as `any`,
 * so a DTO that reaches a Convex boundary through one loses its type in the generated API.
 */
describe('generated Convex API types stay real', () => {
  type Panel = FunctionReturnType<typeof api.characters.panels.get>
  type Command = FunctionArgs<typeof api.campaigns.characterSheet.execute>['command']

  it('types each senses panel row', () => {
    type SensesPanel = Extract<Panel, { kind: 'SENSES' }>
    expectTypeOf<SensesPanel['senses'][number]>().not.toBeAny()
    expectTypeOf<SensesPanel['senses'][number]['senseId']>().toEqualTypeOf<string>()
  })

  it('types each movement panel row', () => {
    type MovementPanel = Extract<Panel, { kind: 'MOVEMENT' }>
    expectTypeOf<MovementPanel['speeds'][number]>().not.toBeAny()
  })

  it('types a Sheet adjustment on every campaign read and write', () => {
    type Saved = FunctionReturnType<typeof api.campaigns.gmWrites.saveAdjustment>
    expectTypeOf<
      FunctionReturnType<typeof api.campaigns.gmReads.adjustments>[number]['adjustment']
    >().not.toBeAny()
    expectTypeOf<
      FunctionArgs<typeof api.campaigns.gmWrites.saveAdjustment>['adjustment']
    >().not.toBeAny()
    expectTypeOf<Saved['adjustment']>().not.toBeAny()
  })

  it('types an encounter stat block speed as the stored Creature speed', () => {
    type Projection = NonNullable<FunctionReturnType<typeof api.encounters.projectionReads.get>>
    type StatBlock = NonNullable<
      Extract<Projection['actors'][number], { statBlock: unknown }>['statBlock']
    >
    expectTypeOf<StatBlock['speeds'][number]>().not.toBeAny()
    expectTypeOf<StatBlock['speeds'][number]>().toEqualTypeOf<SpeedDto>()
  })

  it('types the adjustment of a Sheet command', () => {
    type Upsert = Extract<Command, { type: 'UPSERT_SHEET_ADJUSTMENT' }>
    expectTypeOf<Upsert['adjustment']>().not.toBeAny()
  })
})
