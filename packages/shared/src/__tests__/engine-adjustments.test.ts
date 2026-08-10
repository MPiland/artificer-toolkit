import { describe, expect, it } from 'vitest'

import {
  dnd5e2014RulesSystem,
  rollCharacterDice,
  runEngine,
  SenseCode,
  toCharacterMechanicalAdjustment,
  type CharacterAssemblyRegistry,
  type CharacterBuildSnapshot,
  type CharacterSpellSourceRef
} from '@artificer-toolkit/shared'

function createSnapshot(overrides: Partial<CharacterBuildSnapshot> = {}): CharacterBuildSnapshot {
  return {
    characterId: 'character-1',
    systemId: 'dnd5e2014',
    totalLevel: 3,
    classes: [{ classId: 'fighter', level: 3 }],
    abilities: {
      CHARISMA: 10,
      CONSTITUTION: 12,
      DEXTERITY: 14,
      INTELLIGENCE: 10,
      STRENGTH: 14,
      WISDOM: 14
    },
    hitpoints: [
      { classId: 'fighter', classLevel: 1, value: 11 },
      { classId: 'fighter', classLevel: 2, value: 7 },
      { classId: 'fighter', classLevel: 3, value: 7 }
    ],
    features: [],
    equipmentItems: [],
    ...overrides
  }
}

function createRegistry(
  overrides: Partial<CharacterAssemblyRegistry> = {}
): CharacterAssemblyRegistry {
  return {
    classes: {},
    equipment: {},
    feats: {},
    features: {},
    races: {},
    spells: {},
    ...overrides
  }
}

describe('character engine adjustments and provenance', () => {
  it('does not add advantage grants to numeric derived totals', () => {
    const snapshot = createSnapshot({
      features: [
        {
          acquisitionId: 'acquisition-advantage',
          featureId: 'initiative-advantage',
          source: { kind: 'CLASS', classId: 'fighter' },
          timing: { kind: 'CLASS_LEVEL', classId: 'fighter', classLevel: 1 }
        }
      ]
    })
    const registry = createRegistry({
      features: {
        'initiative-advantage': {
          modifiers: [
            {
              id: 'initiative-advantage',
              grantKind: 'MODIFIER_GRANT',
              valueDomainCode: 'INITIATIVE',
              modifierKind: 'ADVANTAGE',
              domain: {},
              scope: 'GLOBAL',
              selectionKind: 'GRANTED',
              order: 0
            }
          ]
        }
      }
    })

    const output = runEngine(snapshot, registry, dnd5e2014RulesSystem)
    expect(output.derivedStats.initiative).toBe(2)
    expect(output.rollModes.initiative).toBe('ADVANTAGE')

    registry.features['initiative-advantage']?.modifiers?.push({
      id: 'initiative-disadvantage',
      grantKind: 'MODIFIER_GRANT',
      valueDomainCode: 'INITIATIVE',
      modifierKind: 'DISADVANTAGE',
      domain: {},
      scope: 'GLOBAL',
      selectionKind: 'GRANTED',
      order: 1
    })
    expect(runEngine(snapshot, registry, dnd5e2014RulesSystem).rollModes.initiative).toBe('NORMAL')
  })

  it('combines global, ability, and skill roll modes without last-wins behavior', () => {
    const featureIds = ['global-advantage', 'dexterity-disadvantage', 'athletics-disadvantage']
    const snapshotFor = (activeFeatureIds: string[]) =>
      createSnapshot({
        features: activeFeatureIds.map((featureId) => ({
          acquisitionId: `acquisition-${featureId}`,
          featureId,
          source: { kind: 'CLASS' as const, classId: 'fighter' },
          timing: { kind: 'CLASS_LEVEL' as const, classId: 'fighter', classLevel: 1 }
        }))
      })
    const registry = createRegistry({
      system: {
        skills: [{ id: 'skill-athletics', code: 'ATHLETICS', label: 'Athletics' }]
      },
      features: {
        'global-advantage': {
          modifiers: [
            {
              id: 'global-advantage',
              grantKind: 'MODIFIER_GRANT',
              valueDomainCode: 'ABILITY_CHECK',
              modifierKind: 'ADVANTAGE',
              domain: {},
              scope: 'GLOBAL',
              selectionKind: 'GRANTED',
              order: 0
            }
          ]
        },
        'dexterity-disadvantage': {
          modifiers: [
            {
              id: 'dexterity-disadvantage',
              grantKind: 'MODIFIER_GRANT',
              valueDomainCode: 'ABILITY_CHECK',
              modifierKind: 'DISADVANTAGE',
              domain: { ability: 'DEXTERITY' },
              scope: 'GLOBAL',
              selectionKind: 'GRANTED',
              order: 0
            }
          ]
        },
        'athletics-disadvantage': {
          modifiers: [
            {
              id: 'athletics-disadvantage',
              grantKind: 'MODIFIER_GRANT',
              valueDomainCode: 'SKILL_MODIFIER',
              modifierKind: 'DISADVANTAGE',
              domain: { skillId: 'skill-athletics' },
              scope: 'GLOBAL',
              selectionKind: 'GRANTED',
              order: 0
            }
          ]
        }
      }
    })

    const normal = runEngine(snapshotFor([]), registry, dnd5e2014RulesSystem).rollModes
    expect(normal.abilityChecks.DEXTERITY).toBe('NORMAL')
    expect(normal.skillChecks.athletics).toBe('NORMAL')

    const globalAdvantage = runEngine(
      snapshotFor(['global-advantage']),
      registry,
      dnd5e2014RulesSystem
    ).rollModes
    expect(globalAdvantage.abilityChecks.STRENGTH).toBe('ADVANTAGE')
    expect(globalAdvantage.skillChecks.athletics).toBe('ADVANTAGE')

    const abilityDisadvantage = runEngine(
      snapshotFor(['dexterity-disadvantage']),
      registry,
      dnd5e2014RulesSystem
    ).rollModes
    expect(abilityDisadvantage.abilityChecks.DEXTERITY).toBe('DISADVANTAGE')
    expect(abilityDisadvantage.skillChecks.acrobatics).toBe('DISADVANTAGE')

    const skillDisadvantage = runEngine(
      snapshotFor(['athletics-disadvantage']),
      registry,
      dnd5e2014RulesSystem
    ).rollModes
    expect(skillDisadvantage.abilityChecks.STRENGTH).toBe('NORMAL')
    expect(skillDisadvantage.skillChecks.athletics).toBe('DISADVANTAGE')

    const cancelled = runEngine(snapshotFor(featureIds), registry, dnd5e2014RulesSystem).rollModes
    expect(cancelled.abilityChecks.DEXTERITY).toBe('NORMAL')
    expect(cancelled.skillChecks.acrobatics).toBe('NORMAL')
    expect(cancelled.abilityChecks.STRENGTH).toBe('ADVANTAGE')
    expect(cancelled.skillChecks.athletics).toBe('NORMAL')
  })

  it('applies authored and manual additions before an absolute override and restores them when cleared', () => {
    const snapshot = createSnapshot({
      abilities: { STRENGTH: 14 },
      features: [
        {
          acquisitionId: 'acquisition-powerful-build',
          featureId: 'powerful-build',
          source: { kind: 'CLASS', classId: 'fighter' },
          timing: {
            kind: 'CLASS_LEVEL',
            classId: 'fighter',
            classLevel: 1
          }
        }
      ],
      adjustments: [
        {
          id: 'strength-manual',
          family: 'ABILITY',
          ability: 'STRENGTH',
          field: 'OTHER_MODIFIER',
          value: 1
        },
        {
          id: 'strength-override',
          family: 'ABILITY',
          ability: 'STRENGTH',
          field: 'SCORE_OVERRIDE',
          value: 20
        }
      ]
    })
    const registry = createRegistry({
      features: {
        'powerful-build': {
          modifiers: [
            {
              id: 'powerful-build-strength',
              grantKind: 'MODIFIER_GRANT',
              valueDomainCode: 'ABILITY_SCORE',
              modifierKind: 'BONUS',
              domain: { ability: 'STRENGTH' },
              scope: 'GLOBAL',
              selectionKind: 'GRANTED',
              payload: { valueKind: 'FIXED', amount: 2 },
              order: 0
            }
          ]
        }
      }
    })

    const overridden = runEngine(snapshot, registry, dnd5e2014RulesSystem).calculations
      .abilityScores.STRENGTH

    expect(overridden).toMatchObject({
      base: 14,
      effective: 20,
      override: { adjustmentId: 'strength-override', value: 20 }
    })
    expect(overridden?.contributions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: expect.objectContaining({
            kind: 'AUTHORED',
            definitionId: 'powerful-build'
          }),
          value: 2,
          state: 'SUPPRESSED'
        }),
        expect.objectContaining({
          source: {
            kind: 'MANUAL_ADJUSTMENT',
            adjustmentId: 'strength-manual'
          },
          value: 1,
          state: 'SUPPRESSED'
        })
      ])
    )

    const cleared = runEngine(
      {
        ...snapshot,
        adjustments: snapshot.adjustments?.filter(
          (adjustment) => adjustment.id !== 'strength-override'
        )
      },
      registry,
      dnd5e2014RulesSystem
    ).calculations.abilityScores.STRENGTH

    expect(cleared).toMatchObject({ base: 14, effective: 17 })
    expect(cleared?.override).toBeUndefined()
    expect(cleared?.contributions.every(({ state }) => state === 'APPLIED')).toBe(true)
  })

  it('propagates adjusted abilities through saves, skills, passives, spells, HP, and resources', () => {
    const snapshot = createSnapshot({
      classes: [{ classId: 'warden', level: 3 }],
      hitpoints: [
        { classId: 'warden', classLevel: 1, value: 9 },
        { classId: 'warden', classLevel: 2, value: 7 },
        { classId: 'warden', classLevel: 3, value: 7 }
      ],
      features: [
        {
          acquisitionId: 'acquisition-warden-training',
          featureId: 'warden-training',
          source: { kind: 'CLASS', classId: 'warden' },
          timing: {
            kind: 'CLASS_LEVEL',
            classId: 'warden',
            classLevel: 1
          }
        }
      ],
      adjustments: [
        {
          id: 'wisdom-manual',
          family: 'ABILITY',
          ability: 'WISDOM',
          field: 'OTHER_MODIFIER',
          value: 2
        },
        {
          id: 'constitution-manual',
          family: 'ABILITY',
          ability: 'CONSTITUTION',
          field: 'OTHER_MODIFIER',
          value: 2
        }
      ]
    })
    const registry = createRegistry({
      classes: {
        warden: {
          id: 'warden',
          category: 'BASE',
          spellcasting: {
            ability: 'WISDOM',
            maxSpellLevel: 9,
            charges: {
              id: 'warden-spellcasting',
              resetKind: 'LONG_REST',
              limitKind: 'FIXED_AMOUNT',
              scalingKind: 'NONE',
              amount: 1
            }
          },
          resources: {
            id: 'warden-focus',
            label: 'Warden Focus',
            availableAtLevel: 1,
            charges: {
              id: 'warden-focus-charges',
              resetKind: 'LONG_REST',
              limitKind: 'ABILITY_MODIFIER',
              scalingKind: 'NONE',
              ability: 'WISDOM',
              min: 1
            }
          }
        } as never
      },
      features: {
        'warden-training': {
          proficiencies: [
            {
              id: 'warden-wisdom-save',
              grantKind: 'PROFICIENCY_GRANT',
              proficiencyKind: 'SAVE_ABILITY',
              level: 'FULL',
              selectionKind: 'GRANTED',
              authoringModeKind: 'SELECTED',
              abilities: ['WISDOM'],
              order: 0
            },
            {
              id: 'warden-perception',
              grantKind: 'PROFICIENCY_GRANT',
              proficiencyKind: 'SKILL',
              level: 'FULL',
              selectionKind: 'GRANTED',
              authoringModeKind: 'SELECTED',
              skillIds: ['perception'],
              order: 1
            }
          ]
        }
      }
    })

    const output = runEngine(snapshot, registry, dnd5e2014RulesSystem)

    expect(output.derivedStats.abilityScores.WISDOM).toBe(16)
    expect(output.derivedStats.savingThrows.WISDOM).toBe(5)
    expect(output.derivedStats.skillBonuses.perception).toBe(5)
    expect(output.derivedStats.passiveChecks.perception).toBe(15)
    expect(output.derivedStats.spellSaveDC).toBe(13)
    expect(output.derivedStats.spellAttackBonus).toBe(5)
    expect(output.derivedStats.maxHitPoints).toBe(26)
    expect(output.resources).toContainEqual(
      expect.objectContaining({
        resourceId: 'warden-focus',
        maxCount: 3
      })
    )
    expect(
      output.calculations.skillProficiencyLevels.perception?.contributions[0]?.source
    ).toMatchObject({
      kind: 'AUTHORED',
      definitionId: 'warden-training'
    })
  })

  it('applies governing-ability and proficiency overrides before skill totals', () => {
    const output = runEngine(
      createSnapshot({
        abilities: {
          STRENGTH: 10,
          WISDOM: 16
        },
        adjustments: [
          {
            id: 'athletics-ability',
            family: 'SKILL',
            skillId: 'athletics',
            field: 'GOVERNING_ABILITY_OVERRIDE',
            value: 'WISDOM'
          },
          {
            id: 'athletics-proficiency',
            family: 'SKILL',
            skillId: 'athletics',
            field: 'PROFICIENCY_OVERRIDE',
            value: 'DOUBLE'
          }
        ]
      }),
      createRegistry(),
      dnd5e2014RulesSystem
    )

    expect(output.derivedStats.skillGoverningAbilities.athletics).toBe('WISDOM')
    expect(output.derivedStats.skillBonuses.athletics).toBe(7)
  })

  it('suppresses target contributions under a hard skill total without deleting them', () => {
    const output = runEngine(
      createSnapshot({
        adjustments: [
          {
            id: 'stealth-proficiency',
            family: 'SKILL',
            skillId: 'stealth',
            field: 'PROFICIENCY_OVERRIDE',
            value: 'FULL'
          },
          {
            id: 'stealth-magic',
            family: 'SKILL',
            skillId: 'stealth',
            field: 'MAGIC_BONUS',
            value: 3
          },
          {
            id: 'stealth-total',
            family: 'SKILL',
            skillId: 'stealth',
            field: 'TOTAL_OVERRIDE',
            value: 11
          }
        ]
      }),
      createRegistry(),
      dnd5e2014RulesSystem
    )
    const calculation = output.calculations.skillBonuses.stealth

    expect(calculation).toMatchObject({
      base: 2,
      effective: 11,
      override: { adjustmentId: 'stealth-total', value: 11 }
    })
    expect(calculation?.contributions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: 2, state: 'SUPPRESSED' }),
        expect.objectContaining({
          source: {
            kind: 'MANUAL_ADJUSTMENT',
            adjustmentId: 'stealth-magic'
          },
          value: 3,
          state: 'SUPPRESSED'
        })
      ])
    )
  })
})

describe('character engine source and instance isolation', () => {
  const spellSourceA: CharacterSpellSourceRef = {
    spellId: 'fire-bolt',
    sourceKind: 'CLASS',
    sourceInstanceId: 'wizard-primary'
  }
  const spellSourceB: CharacterSpellSourceRef = {
    spellId: 'fire-bolt',
    sourceKind: 'CLASS',
    sourceInstanceId: 'wizard-multiclass'
  }

  it('keeps identical spell definitions isolated by acquisition source', () => {
    const output = runEngine(
      createSnapshot({
        classes: [{ classId: 'wizard', level: 3 }],
        abilities: { INTELLIGENCE: 14 },
        spellSources: [spellSourceA, spellSourceB],
        adjustments: [
          {
            id: 'primary-fire-bolt-attack',
            family: 'SPELL',
            source: spellSourceA,
            field: 'ATTACK_BONUS',
            value: 2
          },
          {
            id: 'multiclass-fire-bolt-dc',
            family: 'SPELL',
            source: spellSourceB,
            field: 'DC_OVERRIDE',
            value: 15
          }
        ]
      }),
      createRegistry({
        classes: {
          wizard: {
            id: 'wizard',
            category: 'BASE',
            spellcasting: {
              ability: 'INTELLIGENCE',
              maxSpellLevel: 9,
              charges: {
                id: 'wizard-spellcasting',
                resetKind: 'LONG_REST',
                limitKind: 'FIXED_AMOUNT',
                scalingKind: 'NONE',
                amount: 1
              }
            }
          } as never
        }
      }),
      dnd5e2014RulesSystem
    )

    expect(output.spellMechanics).toEqual([
      expect.objectContaining({
        source: spellSourceA,
        attackBonus: 6,
        saveDC: 12
      }),
      expect.objectContaining({
        source: spellSourceB,
        attackBonus: 4,
        saveDC: 15
      })
    ])
  })

  it('keeps owned item adjustments isolated by instance UUID', () => {
    const item = (instanceId: string): CharacterBuildSnapshot['equipmentItems'][number] => ({
      instanceId,
      contentRef: {
        definitionId: 'silver-knife',
        binding: { kind: 'ACTIVE' },
        systemId: 'dnd5e2014'
      },
      attuned: false,
      compiledItem: {
        id: 'silver-knife',
        category: 'ADVENTURING_GEAR',
        properties: [],
        weight: { amount: 2, unit: 'POUNDS' }
      } as never
    })
    const output = runEngine(
      createSnapshot({
        equipmentItems: [item('knife-1'), item('knife-2')],
        adjustments: [
          {
            id: 'knife-1-attack',
            family: 'ITEM',
            itemInstanceId: 'knife-1',
            field: 'ATTACK_BONUS',
            value: 2
          },
          {
            id: 'knife-1-silvered',
            family: 'ITEM',
            itemInstanceId: 'knife-1',
            field: 'SILVERED',
            value: true
          },
          {
            id: 'knife-2-weight',
            family: 'ITEM',
            itemInstanceId: 'knife-2',
            field: 'WEIGHT_OVERRIDE',
            value: 5
          }
        ]
      }),
      createRegistry(),
      dnd5e2014RulesSystem
    )

    expect(output.itemMechanics).toEqual([
      expect.objectContaining({
        itemInstanceId: 'knife-1',
        attackBonus: 2,
        properties: expect.objectContaining({ silvered: true }),
        weight: { amount: 2, unit: 'POUNDS' }
      }),
      expect.objectContaining({
        itemInstanceId: 'knife-2',
        attackBonus: 0,
        properties: expect.objectContaining({ silvered: false }),
        weight: { amount: 5, unit: 'POUNDS' }
      })
    ])
  })

  it('calculates duplicate companions from their own instance context', () => {
    const output = runEngine(
      createSnapshot({
        companions: [
          {
            companionInstanceId: 'owl-1',
            creatureId: 'owl',
            abilityScores: { DEXTERITY: 13 },
            armorClass: 11,
            maxHitPoints: 1,
            size: 'TINY'
          },
          {
            companionInstanceId: 'owl-2',
            creatureId: 'owl',
            abilityScores: { DEXTERITY: 15 },
            armorClass: 12,
            maxHitPoints: 3,
            size: 'TINY'
          }
        ],
        adjustments: [
          {
            id: 'owl-1-armor',
            family: 'COMPANION',
            companionInstanceId: 'owl-1',
            field: 'ARMOR_CLASS_OVERRIDE',
            value: 20
          },
          {
            id: 'owl-1-size',
            family: 'COMPANION',
            companionInstanceId: 'owl-1',
            field: 'SIZE_OVERRIDE',
            value: 'LARGE'
          }
        ]
      }),
      createRegistry(),
      dnd5e2014RulesSystem
    )

    expect(output.companions).toEqual([
      expect.objectContaining({
        companionInstanceId: 'owl-1',
        abilityScores: { DEXTERITY: 13 },
        armorClass: 20,
        maxHitPoints: 1,
        size: 'LARGE'
      }),
      expect.objectContaining({
        companionInstanceId: 'owl-2',
        abilityScores: { DEXTERITY: 15 },
        armorClass: 12,
        maxHitPoints: 3,
        size: 'TINY'
      })
    ])
  })
})

describe('movement, dice, and engine input boundaries', () => {
  const registry = createRegistry({
    races: {
      elf: {
        id: 'elf',
        speeds: [
          { speedId: 'speed-fly', amount: 40, unit: 'FEET' },
          { speedId: 'speed-walk', amount: 30, unit: 'FEET' }
        ]
      } as never,
      bird: {
        id: 'bird',
        speeds: [{ speedId: 'speed-fly', amount: 40, unit: 'FEET' }]
      } as never
    },
    system: {
      speeds: [
        { id: 'speed-fly', code: 'FLY', label: 'Flying' },
        { id: 'speed-walk', code: 'WALK', label: 'Walking' }
      ]
    }
  })

  it('selects walking for AUTO, otherwise the first backend-ordered available speed', () => {
    expect(
      runEngine(createSnapshot({ raceId: 'elf' }), registry, dnd5e2014RulesSystem).derivedStats
        .primaryMovementSpeedId
    ).toBe('speed-walk')
    expect(
      runEngine(createSnapshot({ raceId: 'bird' }), registry, dnd5e2014RulesSystem).derivedStats
        .primaryMovementSpeedId
    ).toBe('speed-fly')
    expect(
      runEngine(
        createSnapshot({
          raceId: 'elf',
          movementDisplayPreference: {
            mode: 'EXPLICIT',
            speedId: 'speed-fly'
          }
        }),
        registry,
        dnd5e2014RulesSystem
      ).derivedStats.primaryMovementSpeedId
    ).toBe('speed-fly')
  })

  it('applies a speed override with provenance and falls back to the available primary speed', () => {
    const output = runEngine(
      createSnapshot({
        movementDisplayPreference: { mode: 'EXPLICIT', speedId: 'missing-speed' },
        adjustments: [
          {
            id: 'walk-speed-override',
            family: 'MOVEMENT',
            speedId: 'speed-walk',
            field: 'SPEED_OVERRIDE',
            value: 45
          }
        ]
      }),
      registry,
      dnd5e2014RulesSystem
    )

    expect(output.derivedStats.movementSpeeds).toContainEqual({
      speedId: 'speed-walk',
      amount: 45,
      unit: 'FEET'
    })
    expect(output.derivedStats.primaryMovementSpeedId).toBe('speed-walk')
    expect(output.calculations.movementSpeeds['speed-walk']).toMatchObject({
      effective: 45,
      override: { adjustmentId: 'walk-speed-override', value: 45 }
    })
  })

  it('applies a sense range override and suppresses the prior modifier contribution', () => {
    const output = runEngine(
      createSnapshot({
        features: [
          {
            acquisitionId: 'acquisition-darkvision',
            featureId: 'darkvision',
            source: { kind: 'CLASS', classId: 'fighter' },
            timing: { kind: 'CLASS_LEVEL', classId: 'fighter', classLevel: 1 }
          }
        ],
        adjustments: [
          {
            id: 'darkvision-range-override',
            family: 'SENSE',
            senseId: SenseCode.DARKVISION,
            field: 'RANGE_OVERRIDE',
            value: 120
          }
        ]
      }),
      createRegistry({
        features: {
          darkvision: {
            senses: [
              {
                id: 'darkvision-sense',
                grantKind: 'SENSE_GRANT',
                selectionKind: 'GRANTED',
                authoringModeKind: 'SELECTED',
                senseIds: [SenseCode.DARKVISION],
                scalingKind: 'NONE',
                range: { id: 'darkvision-range', rangeKind: 'DISTANCE', amount: 60, unit: 'FEET' },
                order: 0
              }
            ],
            modifiers: [
              {
                id: 'darkvision-range-bonus',
                grantKind: 'MODIFIER_GRANT',
                valueDomainCode: 'SENSE_RANGE',
                modifierKind: 'BONUS',
                domain: { senseCode: SenseCode.DARKVISION },
                scope: 'GLOBAL',
                payload: { amount: 30 },
                selectionKind: 'GRANTED',
                order: 1
              }
            ]
          }
        }
      }),
      dnd5e2014RulesSystem
    )
    const calculation = output.calculations.senseRanges.DARKVISION

    expect(output.senses).toContainEqual({
      senseCode: 'DARKVISION',
      range: { id: 'darkvision-range', rangeKind: 'DISTANCE', amount: 120, unit: 'FEET' }
    })
    expect(calculation).toMatchObject({
      effective: 120,
      override: { adjustmentId: 'darkvision-range-override', value: 120 }
    })
    expect(calculation?.contributions).toEqual([
      expect.objectContaining({ value: 30, state: 'SUPPRESSED' })
    ])
  })

  it('uses an injected deterministic random source for canonical dice evidence', () => {
    const values = [0, 5]
    const result = rollCharacterDice(
      { count: 2, die: 6, modifier: 3 },
      {
        nextInt: () => values.shift() ?? 0
      }
    )

    expect(result).toEqual({
      spec: { count: 2, die: 6, modifier: 3 },
      rolls: [1, 6],
      total: 10
    })
  })

  it('projects only mechanical intent into the engine snapshot boundary', () => {
    const mechanical = toCharacterMechanicalAdjustment({
      id: 'strength-adjustment',
      characterId: 'character-1',
      family: 'ABILITY',
      ability: 'STRENGTH',
      field: 'OTHER_MODIFIER',
      value: 1,
      sourceNote: 'Temporary table ruling',
      createdBy: 'user-1',
      updatedBy: 'user-1',
      createdAt: '2026-07-24T00:00:00.000Z',
      updatedAt: '2026-07-24T00:00:00.000Z'
    })

    expect(mechanical).toEqual({
      id: 'strength-adjustment',
      family: 'ABILITY',
      ability: 'STRENGTH',
      field: 'OTHER_MODIFIER',
      value: 1
    })
    expect(mechanical).not.toHaveProperty('characterId')
    expect(mechanical).not.toHaveProperty('sourceNote')
    expect(mechanical).not.toHaveProperty('createdBy')
  })
})
