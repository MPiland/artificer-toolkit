import { describe, expect, it } from 'vitest'

import { compileSpell } from '@artificer-toolkit/shared/compilers'

import { prismaticSpray } from '../source-data/srd/spells/prismatic-spray.js'
import { prismaticWall } from '../source-data/srd/spells/prismatic-wall.js'

describe('Prismatic spell mechanics', () => {
  it('compiles Prismatic Spray effects and repeat rule', () => {
    const group = compileSpell(prismaticSpray).effects?.[0]
    expect(group?.invocation.triggerCode).toBe('SAVING_THROW')
    expect(group?.entries).toHaveLength(16)

    const repeats = group?.entries.filter((entry) => entry.resolutionKind === 'ROLL_TABLE_REPEAT')
    expect(repeats).toHaveLength(2)
    expect(repeats).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pathCode: 'ON_SAVE_FAIL',
          rollValue: 8,
          repeatCount: 2,
          rerollValues: [8]
        }),
        expect.objectContaining({
          pathCode: 'ON_SAVE_SUCCESS',
          rollValue: 8,
          repeatCount: 2,
          rerollValues: [8]
        })
      ])
    )

    const damageEntries = group?.entries.filter(
      (entry) => entry.resolutionKind === 'ROLL_TABLE' && entry.outcome.effectKind === 'DAMAGE'
    )
    expect(damageEntries).toHaveLength(10)
    expect(
      damageEntries
        ?.filter((entry) => entry.pathCode === 'ON_SAVE_SUCCESS')
        .every(
          (entry) =>
            entry.resolutionKind === 'ROLL_TABLE' &&
            entry.outcome.effectKind === 'DAMAGE' &&
            entry.outcome.amountKind === 'HALF'
        )
    ).toBe(true)
    expect(
      group?.entries.some(
        (entry) =>
          entry.resolutionKind === 'ROLL_TABLE' &&
          entry.pathCode === 'ON_SAVE_SUCCESS' &&
          'rollValue' in entry &&
          (entry.rollValue === 6 || entry.rollValue === 7)
      )
    ).toBe(false)

    const indigo = group?.entries.find(
      (entry) =>
        entry.resolutionKind === 'ROLL_TABLE' &&
        entry.rollTableKind === 'EXACT' &&
        entry.pathCode === 'ON_SAVE_FAIL' &&
        entry.rollValue === 6 &&
        entry.outcome.effectKind === 'FOLLOW_UP_SAVE'
    )
    expect(indigo).toMatchObject({
      outcome: {
        timing: 'TARGET_TURN_END',
        attempts: {
          kind: 'THRESHOLDS',
          successesToEnd: 3,
          failuresToResolve: 3,
          consecutive: false
        },
        onFailure: {
          kind: 'OUTCOMES',
          outcomes: [expect.objectContaining({ effectKind: 'CONDITION' })]
        }
      }
    })

    const violet = group?.entries.find(
      (entry) =>
        entry.resolutionKind === 'ROLL_TABLE' &&
        entry.rollTableKind === 'EXACT' &&
        entry.pathCode === 'ON_SAVE_FAIL' &&
        entry.rollValue === 7 &&
        entry.outcome.effectKind === 'FOLLOW_UP_SAVE'
    )
    expect(violet).toMatchObject({
      outcome: {
        timing: 'SOURCE_NEXT_TURN_START',
        attempts: { kind: 'ONCE' },
        onSuccess: { kind: 'END' },
        onFailure: {
          kind: 'OUTCOMES',
          endCurrent: true,
          outcomes: [
            expect.objectContaining({ effectKind: 'TELEPORT' }),
            expect.objectContaining({
              effectKind: 'MANUAL_ADJUDICATION',
              reasonCode: 'GM_CHOICE'
            })
          ]
        }
      }
    })
  })

  it('compiles both Prismatic Wall shapes and all seven ordered layers', () => {
    const group = compileSpell(prismaticWall).effects?.[0]
    expect(group?.invocation.triggerCode).toBe('ACTIVATED')
    expect(group?.entries).toHaveLength(2)

    const manifests = group?.entries.flatMap((entry) =>
      entry.resolutionKind !== 'ROLL_TABLE_REPEAT' &&
      entry.outcome.effectKind === 'MANIFEST' &&
      entry.outcome.manifestKind === 'ZONE'
        ? [entry.outcome]
        : []
    )
    expect(manifests?.map((manifest) => manifest.label)).toEqual([
      'Prismatic Wall',
      'Prismatic Sphere'
    ])

    for (const manifest of manifests ?? []) {
      expect(manifest).toMatchObject({
        componentsMustResolveInOrder: true,
        destructionMustResolveInOrder: true,
        destroyedComponentsRemainDestroyed: true,
        placementMustBeUnoccupied: true,
        invalidPlacementConsumesInvocation: true,
        designatedCreatureImmunity: true,
        suppressionImmunities: ['ANTIMAGIC_FIELD'],
        proximityRule: {
          events: ['MOVE_WITHIN', 'START_TURN'],
          distance: { amount: 20, unit: 'FEET' },
          requiresSight: true
        }
      })
      expect(manifest.proximityRule?.behavior.entries).toEqual([
        expect.objectContaining({ pathCode: 'ON_SAVE_FAIL' })
      ])
      expect(manifest.components?.map((component) => component.label)).toEqual([
        'Red',
        'Orange',
        'Yellow',
        'Green',
        'Blue',
        'Indigo',
        'Violet'
      ])
      expect(
        manifest.components?.every(
          (component) =>
            component.interactionKind === 'ENTER_OR_PASS_THROUGH' &&
            component.behaviors?.[0]?.entries.some((entry) => entry.pathCode === 'ON_SAVE_FAIL')
        )
      ).toBe(true)
      expect(
        manifest.components
          ?.slice(0, 5)
          .every((component) =>
            component.behaviors?.[0]?.entries.some((entry) => entry.pathCode === 'ON_SAVE_SUCCESS')
          )
      ).toBe(true)
      expect(
        manifest.components
          ?.slice(5)
          .every((component) =>
            component.behaviors?.[0]?.entries.every((entry) => entry.pathCode !== 'ON_SAVE_SUCCESS')
          )
      ).toBe(true)

      const violet = manifest.components?.[6]
      expect(violet?.destructionCriteria).toEqual([
        expect.objectContaining({
          kind: 'SPELL_CAPABILITY',
          capability: 'END_SPELL_OR_MAGICAL_EFFECT',
          minimumSpellLevel: 3
        })
      ])
      expect(violet?.behaviors?.[0]?.entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            pathCode: 'ON_SAVE_FAIL',
            outcome: expect.objectContaining({ effectKind: 'FOLLOW_UP_SAVE' })
          })
        ])
      )
    }

    expect(manifests?.[0]?.shape).toMatchObject({
      shapeKind: 'WALL',
      length: { amount: 90, unit: 'FEET' },
      height: { amount: 30, unit: 'FEET' },
      thickness: { amount: 1, unit: 'INCHES' }
    })
    expect(manifests?.[1]?.shape).toMatchObject({
      shapeKind: 'SPHERE',
      radius: { amount: 15, unit: 'FEET' }
    })
  })
})
