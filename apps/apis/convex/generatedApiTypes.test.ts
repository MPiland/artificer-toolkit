import { reusableDefinitionWorkspaceDtoSchema } from '@artificer-toolkit/schema/api/reusableDefinitions'
import { conditionDtoSchema } from '@artificer-toolkit/schema/effects/condition'
import { createFollowUpCheckDtoSchema } from '@artificer-toolkit/schema/effects/followUpCheck'
import { createFollowUpSaveDtoSchema } from '@artificer-toolkit/schema/effects/followUpSave'
import type { SpeedDto } from '@artificer-toolkit/schema/shared/speed'
import type { FunctionArgs, FunctionReturnType } from 'convex/server'
import { zodToConvex } from 'convex-helpers/server/zod4'
import { describe, expect, expectTypeOf, it } from 'vitest'

import type { api } from './_generated/api'

/** The parts of Convex's validator JSON (an internal getter) that locate its `any` leaves. */
type ValidatorJson = {
  type: string
  value?: unknown
  values?: { fieldType: ValidatorJson }
}

/**
 * Lists each `v.any()` leaf of a validator, naming a union member by its `kind` literal, or by its
 * index when it has none (a member whose `kind` is itself a union).
 */
function anyLeafPaths(node: ValidatorJson, path = ''): string[] {
  switch (node.type) {
    case 'any':
      return [path]
    case 'object':
      return Object.entries(node.value as Record<string, { fieldType: ValidatorJson }>).flatMap(
        ([key, field]) => anyLeafPaths(field.fieldType, path ? `${path}.${key}` : key)
      )
    case 'union':
      return (node.value as ValidatorJson[]).flatMap((member, index) => {
        const kind =
          member.type === 'object'
            ? (member.value as Record<string, { fieldType: ValidatorJson }>).kind?.fieldType.value
            : undefined
        return anyLeafPaths(member, `${path}|${typeof kind === 'string' ? kind : index}`)
      })
    case 'array':
      return anyLeafPaths(node.value as ValidatorJson, `${path}[]`)
    case 'record':
      return node.values ? anyLeafPaths(node.values.fieldType, `${path}{}`) : []
    default:
      return []
  }
}

/** The sorted `v.any()` leaves of the Convex validator `zodToConvex` builds from a schema. */
function leaves(schema: Parameters<typeof zodToConvex>[0]): string[] {
  return anyLeafPaths((zodToConvex(schema) as unknown as { json: ValidatorJson }).json).sort()
}

/**
 * Type-level proof, checked by `typecheck:convex`: `zodToConvex` types a zod intersection as `any`,
 * so a DTO that reaches a Convex boundary through one loses its type in the generated API. The
 * D194 leaves are `any` on purpose; the validator walks prove no other leaf is.
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

  it('leaves a follow-up save or check untyped only at its outcomes (D194)', () => {
    // A typed outcome schema still yields an untyped leaf: the opaque leaf is named, not inferred.
    expect(leaves(createFollowUpSaveDtoSchema(conditionDtoSchema))).toEqual([
      'onDurationComplete|OUTCOMES.outcomes[]',
      'onFailure|OUTCOMES.outcomes[]',
      'onSuccess|OUTCOMES.outcomes[]'
    ])
    expect(leaves(createFollowUpCheckDtoSchema(conditionDtoSchema))).toEqual([
      'onFailure|OUTCOMES.outcomes[]',
      'onSuccess|OUTCOMES.outcomes[]'
    ])
  })

  it('leaves the Reusable Definition workspace untyped only at its facet and path leaves (D194)', () => {
    type Workspace = FunctionReturnType<typeof api.content.definitions.get>
    type BasicAction = Extract<
      NonNullable<Workspace['current']>['document'],
      { kind: 'BASIC_ACTION' }
    >
    expectTypeOf<BasicAction>().not.toBeAny()
    expectTypeOf<BasicAction['rulesText']>().toEqualTypeOf<string>()
    expectTypeOf<BasicAction['effects'][number]>().not.toBeAny()
    expectTypeOf<BasicAction['restrictions']>().toBeAny()
    expectTypeOf<BasicAction['effects'][number]['paths'][number]>().toBeAny()

    type Mark = Extract<
      Extract<NonNullable<Workspace['current']>['document'], { parameters: unknown }>['parameters'],
      { kind: 'MARK' }
    >
    expectTypeOf<Mark['effect']>().not.toBeAny()
    expectTypeOf<Mark['effect']['paths'][number]>().toBeAny()

    type RaisedEffect = NonNullable<
      Extract<
        NonNullable<Workspace['current']>['document'],
        { parameters: unknown }
      >['raisedEffects']
    >[number]
    expectTypeOf<RaisedEffect>().not.toBeAny()
    expectTypeOf<RaisedEffect['paths'][number]>().toBeAny()
    expect(leaves(reusableDefinitionWorkspaceDtoSchema)).toEqual([
      'current|0.document|3.parameters|CLIMB_ONTO_LARGER_CREATURE.effect.paths[]',
      'current|0.document|3.parameters|MARK.effect.paths[]',
      'current|0.document|3.raisedEffects[].paths[]',
      'current|0.document|BASIC_ACTION.effects[].paths[]',
      'current|0.document|BASIC_ACTION.restrictions|0',
      'draft|0.document|3.parameters|CLIMB_ONTO_LARGER_CREATURE.effect.paths[]',
      'draft|0.document|3.parameters|MARK.effect.paths[]',
      'draft|0.document|3.raisedEffects[].paths[]',
      'draft|0.document|BASIC_ACTION.effects[].paths[]',
      'draft|0.document|BASIC_ACTION.restrictions|0'
    ])
  })
})
