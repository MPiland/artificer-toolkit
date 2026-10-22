import { SRD_SYSTEM_ID } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { screen, within } from '@testing-library/react'
import { beforeEach, vi } from 'vitest'
import { getFunctionName } from 'convex/server'
import type {
  AuthoredDraftDto,
  ClassResponseDto,
  CreatureResponseDto,
  FeatResponseDto,
  RaceResponseDto,
  SpellResponseDto
} from '@artificer-toolkit/schema/api/content'
import type { AuthoredContentReferenceData } from '#app/data/contentReferences'
import type { SpellDetailReferenceData, SpellReferenceData } from '#app/data/spells/referenceData'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import {
  masterSubclassResponseFixture,
  ownedClassResponseFixture
} from '#domains/classes/class.fixtures'
import { ClassDetailPage } from '#domains/classes/pages/ClassDetailPage'
import { CreatureDetailPage } from '#domains/creatures/pages/CreatureDetailPage'
import {
  masterEquipmentResponseFixture,
  ownedEquipmentResponseFixture
} from '#domains/equipment/equipment.fixtures'
import { EquipmentDetailPage } from '#domains/equipment/pages/EquipmentDetailPage'
import { FeatDetailPage } from '#domains/feats/pages/FeatDetailPage'
import { RaceDetailPage } from '#domains/races/pages/RaceDetailPage'
import { SpellDetailPage } from '#domains/spells/pages/SpellDetailPage'
import { ownedVehicleResponseFixture } from '#domains/vehicles/vehicle.fixtures'
import { VehicleDetailPage } from '#domains/vehicles/pages/VehicleDetailPage'

const nativeQueries = vi.hoisted(() => ({ parent: vi.fn() }))

beforeEach(() => nativeQueries.parent.mockReset())

vi.mock('convex/react', async (importOriginal) => {
  const { api } = await import('@artificer-toolkit/apis/convex/api')
  return {
    ...(await importOriginal<typeof import('convex/react')>()),
    useAction: () => vi.fn(),
    useConvex: () => undefined,
    useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
    useMutation: () => vi.fn(),
    useQuery: (reference: Parameters<typeof getFunctionName>[0], args: unknown) =>
      getFunctionName(reference) === getFunctionName(api.content.details.get)
        ? args === 'skip'
          ? undefined
          : nativeQueries.parent(args)
        : { assetId: null, revision: 0 }
  }
})

const spellResponse: NonNullable<SpellResponseDto> = {
  publicId: '1',
  activeUpdatedAt: '2026-01-01T00:00:00.000Z',
  hasDraft: false,
  item: {
    kind: 'SPELL',
    id: 'spell-sea-step',
    label: 'Sea Step',
    status: 'ACTIVE',
    description: '<p>Move like water.</p>',
    castingTime: {
      amount: 1,
      unit: 'ROUND'
    },
    components: ['VERBAL', 'SOMATIC', 'MATERIAL'],
    materialDescription: 'a drop of water',
    effects: [
      {
        id: 'spell-sea-step-effect',
        order: 1,
        invocation: {
          triggerCode: 'ACTIVATED',
          activation: {
            code: 'ACTION',
            amount: 1
          },
          range: {
            id: 'spell-sea-step-range',
            rangeKind: 'DISTANCE',
            amount: 30,
            unit: 'FEET'
          }
        },
        paths: [
          {
            id: 'spell-sea-step-path',
            order: 1,
            pathCode: 'ON_USE',
            groupType: 'SINGLE',
            selectionKind: 'FIXED',
            resultBlock: {
              id: 'spell-sea-step-result',
              resultKind: 'SINGLE',
              duration: {
                id: 'spell-sea-step-duration',
                durationKind: 'MINUTE',
                amount: 1
              },
              outcomes: [
                {
                  id: 'spell-sea-step-outcome',
                  effectKind: 'DAMAGE',
                  damageTypeId: 'damage-acid',
                  valueKind: 'DICE',
                  scalingKind: 'NONE',
                  diceConfig: '1d6'
                }
              ]
            }
          }
        ]
      }
    ],
    level: 2,
    classIds: ['00000000-0000-0000-0010-000c00000000'],
    magicSchoolId: '00000000-0000-0000-0007-000200000000',
    userId: 'user-1',
    systemId: SRD_SYSTEM_ID
  },
  provenance: {
    kind: 'OWNED',
    ownerUserId: 'user-1'
  },
  permissions: {
    canView: true,
    canEdit: true,
    canCopy: true,
    canDelete: true
  }
}

function draft(payload: Record<string, unknown>): AuthoredDraftDto {
  return {
    subjectKind: 'CLASS',
    subjectId: 'class-owned',
    publicId: '2',
    userId: 'user-1',
    systemId: SRD_SYSTEM_ID,
    label: 'Draft Class',
    status: 'DRAFT',
    draftState: 'ACTIVE_WITH_DRAFT',
    baseActiveUpdatedAt: '2026-01-01T00:00:00.000Z',
    payload
  }
}

const spellReferences = {
  systemId: SRD_SYSTEM_ID,
  abilities: [{ value: 'ability-dexterity', label: 'Dexterity' }],
  magicSchools: [{ value: '00000000-0000-0000-0007-000200000000', label: 'Conjuration' }],
  classes: [{ value: '00000000-0000-0000-0010-000c00000000', label: 'Wizard' }],
  damageTypes: [{ value: 'damage-acid', label: 'Acid' }],
  conditionTypes: [],
  skills: [{ value: 'performance', label: 'Performance' }],
  speeds: [],
  creatures: []
} satisfies SpellReferenceData

const cachedSpellListReferences = {
  magicSchools: spellReferences.magicSchools,
  classes: spellReferences.classes,
  damageTypes: [],
  conditionTypes: []
} satisfies SpellDetailReferenceData

const detailReferences = {
  systemId: SRD_SYSTEM_ID,
  challengeRatings: [],
  conditionTypes: [],
  creatureTypes: [],
  currencies: [{ value: 'gp', label: 'Gold Piece' }],
  damageTypes: [],
  heritages: [{ value: 'dwarven', label: 'Dwarven Heritage' }],
  languages: [],
  magicSchools: spellReferences.magicSchools,
  rarities: [{ value: 'common', label: 'Common' }],
  skills: [{ value: 'performance', label: 'Performance' }],
  speeds: [],
  classes: [
    {
      value: ownedClassResponseFixture.item.id,
      label: ownedClassResponseFixture.item.label
    }
  ],
  creatures: [],
  equipment: [
    {
      value: masterEquipmentResponseFixture.item!.id,
      label: masterEquipmentResponseFixture.item!.label
    },
    { value: 'torch', label: 'Torch' }
  ],
  races: []
} satisfies AuthoredContentReferenceData

const dragonbornResponse: NonNullable<RaceResponseDto> = {
  publicId: 'dragonborn',
  activeUpdatedAt: '2026-01-01T00:00:00.000Z',
  hasDraft: false,
  item: {
    id: 'dragonborn',
    label: 'Dragonborn',
    description: 'Dragonborn bear draconic heritage.',
    status: 'ACTIVE',
    category: 'BASE',
    selectionMode: 'DIRECT',
    size: 'MEDIUM',
    speeds: [{ speedId: 'walk', amount: 30, unit: 'FEET' }],
    features: [
      {
        id: 'dragonborn-feature',
        label: 'Ability Score Increase',
        description: 'Your Strength score increases by 2, and your Charisma score increases by 1.',
        availableAtLevel: 1,
        order: 0
      }
    ],
    ancestry: {
      id: 'draconic-ancestry',
      label: 'Draconic Ancestry',
      description: 'Choose one dragon type.',
      options: [
        {
          id: 'black',
          label: 'Black (Acid)',
          description:
            'Your draconic ancestry is black dragon. Damage type: acid. Breath weapon: 5 by 30 ft. line (DEX save).',
          order: 0
        },
        {
          id: 'blue',
          label: 'Blue (Lightning)',
          description:
            'Your draconic ancestry is blue dragon. Damage type: lightning. Breath weapon: 5 by 30 ft. line (DEX save).',
          order: 1
        },
        {
          id: 'green',
          label: 'Green (Poison)',
          description:
            'Your draconic ancestry is green dragon. Damage type: poison. Breath weapon: 15 ft. cone (CON save).',
          order: 2
        },
        {
          id: 'red',
          label: 'Red (Fire)',
          description:
            'Your draconic ancestry is red dragon. Damage type: fire. Breath weapon: 15 ft. cone (DEX save).',
          order: 3
        }
      ]
    },
    userId: 'master',
    systemId: SRD_SYSTEM_ID
  },
  provenance: { kind: 'MASTER', ownerUserId: null },
  permissions: {
    canView: true,
    canEdit: false,
    canCopy: true,
    canDelete: false
  }
}

const brassDragonResponse: NonNullable<CreatureResponseDto> = {
  publicId: 'adult-brass-dragon',
  activeUpdatedAt: '2026-01-01T00:00:00.000Z',
  hasDraft: false,
  item: {
    id: 'adult-brass-dragon',
    label: 'Adult Brass Dragon',
    details: [],
    proficiencies: [],
    senses: [],
    damageVulnerabilities: [],
    damageResistances: [],
    damageImmunities: [],
    qualifiedDamageDefenses: [],
    conditionImmunities: [],
    description: '<p>A brass dragon.</p>',
    status: 'ACTIVE',
    category: 'MONSTER',
    creatureTypeId: 'dragon',
    size: 'HUGE',
    abilityScores: {
      STRENGTH: 23,
      DEXTERITY: 10,
      CONSTITUTION: 21,
      INTELLIGENCE: 14,
      WISDOM: 13,
      CHARISMA: 17
    },
    naturalArmorBonus: 8,
    hitPoints: 172,
    speeds: [
      { speedId: 'walk', amount: 40, unit: 'FEET' },
      { speedId: 'fly', amount: 80, unit: 'FEET' }
    ],
    features: [
      {
        id: 'legendary-resistance',
        label: 'Legendary Resistance (3/Day)',
        description: 'If the dragon fails a saving throw, it can choose to succeed instead.',
        order: 1
      },
      {
        id: 'multiattack',
        label: 'Multiattack',
        description: 'The dragon makes three attacks.',
        order: 2
      },
      {
        id: 'bite',
        label: 'Bite',
        description:
          'Melee Weapon Attack: +11 to hit, reach 10 ft., one target. Hit: 17 piercing damage.',
        effects: [
          {
            id: 'bite-effect',
            order: 1,
            invocation: {
              triggerCode: 'MELEE_WEAPON_ATTACK',
              activation: {
                code: 'ACTION',
                amount: 1
              },
              range: {
                id: 'bite-range',
                rangeKind: 'DISTANCE',
                amount: 10,
                unit: 'FEET'
              },
              targeting: {
                selectionKind: 'SINGLE_TARGET'
              }
            },
            paths: [
              {
                id: 'bite-path',
                order: 1,
                pathCode: 'ON_HIT',
                groupType: 'SINGLE',
                selectionKind: 'FIXED',
                resultBlock: {
                  id: 'bite-result',
                  resultKind: 'SINGLE',
                  outcomes: [
                    {
                      id: 'bite-damage',
                      effectKind: 'DAMAGE',
                      damageTypeId: 'piercing',
                      valueKind: 'DICE',
                      scalingKind: 'NONE',
                      diceConfig: '2d10'
                    }
                  ]
                }
              }
            ]
          }
        ],
        order: 3
      },
      {
        id: 'legendary-actions',
        label: 'Legendary Actions',
        description:
          '<p>The dragon can take 3 legendary actions, choosing from the options below.</p>',
        section: 'LEGENDARY_ACTION',
        options: [
          {
            id: 'detect',
            label: 'Detect',
            description: 'The dragon makes a Wisdom (Perception) check.',
            order: 1
          },
          {
            id: 'tail-attack',
            label: 'Tail Attack',
            description: 'The dragon makes a tail attack.',
            order: 2
          },
          {
            id: 'wing-attack',
            label: 'Wing Attack (Costs 2 Actions)',
            description: 'The dragon beats its wings.',
            order: 3
          }
        ],
        order: 10
      }
    ],
    userId: 'master',
    systemId: SRD_SYSTEM_ID
  },
  meta: {
    challengeRatings: [],
    conditionTypes: [],
    creatureTypes: [{ value: 'dragon', label: 'Dragon' }],
    damageTypes: [],
    equipment: [],
    speeds: [
      { value: 'walk', label: 'Walking Speed' },
      { value: 'fly', label: 'Flying Speed' }
    ]
  },
  provenance: { kind: 'MASTER', ownerUserId: null },
  permissions: {
    canView: true,
    canEdit: false,
    canCopy: true,
    canDelete: false
  }
}

const grapplerResponse: NonNullable<FeatResponseDto> = {
  publicId: 'grappler',
  activeUpdatedAt: '2026-01-01T00:00:00.000Z',
  hasDraft: false,
  item: {
    id: 'grappler',
    label: 'Grappler',
    description:
      'You have developed the skills necessary to hold your own in close-quarters grappling. Prerequisite: Strength 13 or higher.',
    status: 'ACTIVE',
    prerequisites: {
      id: 'grappler-prerequisite',
      groups: [
        {
          id: 'grappler-group',
          order: 0,
          contexts: [
            {
              id: 'grappler-context',
              order: 0,
              subject: 'CHARACTER',
              conditions: [
                {
                  id: 'grappler-condition',
                  order: 0,
                  kind: 'PREDICATE',
                  constraint: 'INCLUDE',
                  predicateCode: 'ABILITY_SCORE',
                  authoringModeKind: 'SELECTED',
                  abilities: 'STRENGTH',
                  min: 13
                }
              ]
            }
          ]
        }
      ]
    },
    features: [
      {
        id: 'grappler-feature',
        label: 'Advantage on Grappled Target',
        description: 'You have advantage on attack rolls against a creature you are grappling.',
        order: 0
      }
    ],
    userId: 'master',
    systemId: SRD_SYSTEM_ID
  },
  provenance: { kind: 'MASTER', ownerUserId: null },
  permissions: {
    canView: true,
    canEdit: false,
    canCopy: true,
    canDelete: false
  }
}

describe('authored domain detail pages', () => {
  it('renders an active spell detail page', () => {
    renderWithAppProviders(
      <SpellDetailPage
        draft={null}
        response={{ ...spellResponse, meta: spellReferences }}
        spellId='spell-sea-step'
        view='active'
      />
    )

    expect(screen.getByRole('heading', { name: /sea step/i })).toBeInTheDocument()
    expect(screen.queryByText('Spell')).not.toBeInTheDocument()
    expect(screen.getAllByText('Move like water.')).toHaveLength(1)
    expect(screen.queryByRole('navigation', { name: /detail sections/i })).not.toBeInTheDocument()
    expect(screen.getByText('Conjuration')).toBeInTheDocument()
    expect(screen.getByText('Wizard')).toBeInTheDocument()
    expect(screen.getByText('2nd')).toBeInTheDocument()
    expect(screen.getByText('30 feet')).toBeInTheDocument()
    expect(screen.getByText('V, S, M *')).toBeInTheDocument()
    expect(screen.getByText('1 minute')).toBeInTheDocument()
    expect(screen.getByText('None')).toBeInTheDocument()
    expect(screen.getByText('Acid')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /material components/i })).toBeInTheDocument()
    expect(screen.getByText('a drop of water')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /^effects$/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/outcome path/i)).not.toBeInTheDocument()
    expect(screen.queryByText('00000000-0000-0000-0007-000200000000')).not.toBeInTheDocument()
  })

  it('infers spell damage labels when detail references came from list metadata', () => {
    renderWithAppProviders(
      <SpellDetailPage
        draft={null}
        response={{
          ...spellResponse,
          meta: cachedSpellListReferences,
          item: {
            ...spellResponse.item!,
            description: '<p>The target takes acid damage.</p>'
          }
        }}
        spellId='spell-sea-step'
        view='active'
      />
    )

    expect(screen.getByText('Acid')).toBeInTheDocument()
    expect(screen.queryByText('Utility')).not.toBeInTheDocument()
  })

  it('renders locked master equipment as readable with duplicate available', () => {
    renderWithAppProviders(
      <EquipmentDetailPage
        draft={null}
        equipmentId={masterEquipmentResponseFixture.item!.id}
        references={detailReferences}
        response={masterEquipmentResponseFixture}
        view='active'
      />
    )

    expect(screen.getByRole('heading', { name: /backpack/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^edit$/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /duplicate/i })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: /detail sections/i })).not.toBeInTheDocument()
  })

  it('renders equipment economy, attunement, quote, and eligibility as player-facing details', () => {
    const ownedEquipment = ownedEquipmentResponseFixture.item
    if (!ownedEquipment) throw new Error('Expected owned equipment fixture.')

    renderWithAppProviders(
      <EquipmentDetailPage
        draft={null}
        equipmentId={ownedEquipment.id}
        references={detailReferences}
        response={{
          ...ownedEquipmentResponseFixture,
          item: {
            ...ownedEquipment,
            requiresAttunement: true,
            restrictions: {
              id: 'equipment-restrictions',
              groups: [
                {
                  id: 'equipment-restriction-group',
                  order: 1,
                  contexts: [
                    {
                      id: 'equipment-restriction-context',
                      order: 1,
                      subject: 'CHARACTER',
                      conditions: [
                        {
                          id: 'equipment-class-level',
                          order: 1,
                          kind: 'PREDICATE',
                          constraint: 'INCLUDE',
                          predicateCode: 'CLASS_LEVEL',
                          classIds: [ownedClassResponseFixture.item.id],
                          min: 1
                        },
                        {
                          id: 'equipment-heritage',
                          order: 2,
                          kind: 'PREDICATE',
                          constraint: 'INCLUDE',
                          predicateCode: 'HERITAGE',
                          authoringModeKind: 'SELECTED',
                          heritageIds: ['dwarven']
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          }
        }}
        view='active'
      />
    )

    expect(screen.getByText('Everything you need when the road gets muddy.')).toBeInTheDocument()
    expect(screen.getByText('10 Gold Piece')).toBeInTheDocument()
    expect(screen.getByText('Required')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Eligibility' })).toBeInTheDocument()
    expect(screen.getByText('Fighter level 1+ and Dwarven Heritage')).toBeInTheDocument()
    expect(screen.queryByText(/currency/i)).not.toBeInTheDocument()
  })

  it('renders vehicle capacity and economy with resolved currency labels', () => {
    renderWithAppProviders(
      <VehicleDetailPage
        draft={null}
        response={{
          ...ownedVehicleResponseFixture,
          meta: {
            currencies: [{ value: 'gp', label: 'Gold Piece' }]
          }
        }}
        vehicleId={ownedVehicleResponseFixture.item.id}
        view='active'
      />
    )

    expect(screen.getByRole('heading', { name: /sky skiff/i })).toBeInTheDocument()
    expect(screen.getByText('Crew')).toBeInTheDocument()
    expect(screen.getByText('1 - 4')).toBeInTheDocument()
    expect(screen.getByText('Passengers')).toBeInTheDocument()
    expect(screen.getByText('6')).toBeInTheDocument()
    expect(screen.getByText('5,000 Gold Piece')).toBeInTheDocument()
    expect(screen.queryByText(/currency/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: /detail sections/i })).not.toBeInTheDocument()
  })

  it('renders creature stats as compact scores and shows legendary action options', () => {
    renderWithAppProviders(
      <CreatureDetailPage
        creatureId='adult-brass-dragon'
        draft={null}
        response={brassDragonResponse}
        view='active'
      />
    )

    expect(screen.getByRole('heading', { name: /adult brass dragon/i })).toBeInTheDocument()
    expect(screen.getByText('STR')).toBeInTheDocument()
    expect(screen.getByText('+6')).toBeInTheDocument()
    expect(screen.getByText('Flying Speed')).toBeInTheDocument()
    expect(screen.getByText('Legendary Resistance (3/Day)')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Details & Features' })).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: /detail sections/i })).not.toBeInTheDocument()

    const traitsSection = screen.getByRole('heading', { name: 'Traits' }).closest('section')
    const actionsSection = screen.getByRole('heading', { name: 'Actions' }).closest('section')

    const legendaryActionsSection = screen
      .getByRole('heading', { name: 'Legendary Actions' })
      .closest('section')

    expect(traitsSection).not.toBeNull()
    expect(actionsSection).not.toBeNull()
    expect(legendaryActionsSection).not.toBeNull()
    expect(
      within(traitsSection as HTMLElement).getByText('Legendary Resistance (3/Day)')
    ).toBeInTheDocument()
    expect(within(actionsSection as HTMLElement).getByText('Multiattack')).toBeInTheDocument()
    expect(within(actionsSection as HTMLElement).getByText('Bite')).toBeInTheDocument()
    expect(
      within(actionsSection as HTMLElement).queryByText('Legendary Resistance (3/Day)')
    ).not.toBeInTheDocument()
    expect(within(legendaryActionsSection as HTMLElement).getByText('Detect')).toBeInTheDocument()
    expect(
      within(legendaryActionsSection as HTMLElement).getByText('Tail Attack')
    ).toBeInTheDocument()
    expect(
      within(legendaryActionsSection as HTMLElement).getByText('Wing Attack (Costs 2 Actions)')
    ).toBeInTheDocument()
    expect(
      within(legendaryActionsSection as HTMLElement).queryByText('Legendary Resistance (3/Day)')
    ).not.toBeInTheDocument()
  })

  it('shows a visible creature legendary action option gap', () => {
    const response = {
      ...brassDragonResponse,
      item: {
        ...brassDragonResponse.item!,
        features: brassDragonResponse.item!.features?.map((feature) =>
          feature.label === 'Legendary Actions' ? { ...feature, options: [] } : feature
        )
      }
    } satisfies NonNullable<CreatureResponseDto>

    renderWithAppProviders(
      <CreatureDetailPage
        creatureId='adult-brass-dragon'
        draft={null}
        response={response}
        view='active'
      />
    )

    expect(screen.getByText('No legendary action options have been added.')).toBeInTheDocument()
  })

  it('renders dragonborn ancestry options as a compact table without order labels', () => {
    renderWithAppProviders(
      <RaceDetailPage
        draft={null}
        raceId='dragonborn'
        response={dragonbornResponse}
        view='active'
      />
    )

    expect(screen.getByRole('heading', { name: /dragonborn/i })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: /detail sections/i })).toBeInTheDocument()
    expect(screen.getByText('Playable')).toBeInTheDocument()
    expect(screen.getAllByText('Dragonborn bear draconic heritage.')).toHaveLength(1)
    expect(screen.getByRole('columnheader', { name: /dragon/i })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /damage type/i })).toBeInTheDocument()
    expect(screen.getByText('Black')).toBeInTheDocument()
    expect(screen.getAllByText('5 by 30 ft. line (DEX save)').length).toBeGreaterThan(0)
    expect(screen.queryByRole('heading', { name: /speeds/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/option 0/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/level 1/i)).not.toBeInTheDocument()
  })

  it('renders subrace detail with inherited parent race content', () => {
    const parentResponse: NonNullable<RaceResponseDto> = {
      ...dragonbornResponse,
      publicId: 'elf',
      item: {
        ...dragonbornResponse.item!,
        id: 'elf',
        label: 'Elf',
        description: 'Elves carry ancient senses.',
        category: 'BASE',
        selectionMode: 'REQUIRES_SUBRACE',
        size: 'MEDIUM',
        speeds: [{ speedId: 'walk', amount: 30, unit: 'FEET' }],
        ancestry: undefined,
        features: [
          {
            id: 'darkvision',
            label: 'Darkvision',
            description: 'You can see in dim light.',
            order: 0
          }
        ]
      }
    }
    const subraceResponse: NonNullable<RaceResponseDto> = {
      ...dragonbornResponse,
      publicId: 'wood-elf',
      item: {
        id: 'wood-elf',
        label: 'Wood Elf',
        description: 'Wood elves move quietly through the wild.',
        status: 'ACTIVE',
        category: 'SUBRACE',
        parentRaceId: 'elf',
        features: [
          {
            id: 'fleet-of-foot',
            label: 'Fleet of Foot',
            description: 'Your base walking speed increases.',
            order: 0
          }
        ],
        userId: 'master',
        systemId: SRD_SYSTEM_ID
      }
    }

    nativeQueries.parent.mockReturnValue(parentResponse)
    renderWithAppProviders(
      <RaceDetailPage draft={null} raceId='wood-elf' response={subraceResponse} view='active' />
    )

    expect(screen.getByRole('heading', { name: /wood elf/i })).toBeInTheDocument()
    expect(screen.getByText('Playable')).toBeInTheDocument()
    expect(screen.getByText('Elves carry ancient senses.')).toBeInTheDocument()
    expect(screen.getByText('Darkvision')).toBeInTheDocument()
    expect(nativeQueries.parent).toHaveBeenCalledWith({
      id: 'elf',
      subjectKind: 'RACE',
      view: 'active'
    })
    expect(screen.getByText('Wood elves move quietly through the wild.')).toBeInTheDocument()
    expect(screen.getByText('Fleet of Foot')).toBeInTheDocument()
    expect(screen.queryByText('Category')).not.toBeInTheDocument()
    expect(screen.queryByText('Base Race')).not.toBeInTheDocument()
    expect(screen.queryByText('Builder')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /base race/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /speeds/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/parent race content is inherited/i)).not.toBeInTheDocument()
  })

  it('renders feat prerequisites from structured data and hides empty mechanics', () => {
    renderWithAppProviders(
      <FeatDetailPage draft={null} featId='grappler' response={grapplerResponse} view='active' />
    )

    expect(screen.getByRole('heading', { name: /grappler/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /prerequisite/i })).toBeInTheDocument()
    expect(screen.getByText(/strength 13 or higher/i, { selector: 'li' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: /detail sections/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/requirements are configured/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /mechanics/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /grants/i })).not.toBeInTheDocument()
  })

  it('shows valid drafts as the default preview over active content', () => {
    renderWithAppProviders(
      <ClassDetailPage
        classId={ownedClassResponseFixture.item.id}
        draft={draft({
          ...ownedClassResponseFixture.item,
          label: 'Fighter Draft'
        })}
        references={detailReferences}
        response={ownedClassResponseFixture}
        view='draft'
      />
    )

    expect(screen.getByRole('heading', { name: /fighter draft/i })).toBeInTheDocument()
    expect(screen.getByText('Draft')).toBeInTheDocument()
    expect(screen.queryByText('Draft Preview')).not.toBeInTheDocument()
    expect(screen.queryByText('Draft Only')).not.toBeInTheDocument()
    expect(screen.getByText(/active class remains unchanged/i)).toBeInTheDocument()
  })

  it('shows the parent class tag for subclasses only', () => {
    const subclassResponse = {
      ...masterSubclassResponseFixture,
      meta: {
        classes: [
          {
            value: ownedClassResponseFixture.item.id,
            label: ownedClassResponseFixture.item.label
          }
        ]
      }
    } satisfies NonNullable<ClassResponseDto>

    renderWithAppProviders(
      <ClassDetailPage
        classId={masterSubclassResponseFixture.item.id}
        draft={null}
        references={detailReferences}
        response={subclassResponse}
        view='active'
      />
    )

    expect(screen.getByRole('heading', { name: /champion/i })).toBeInTheDocument()
    expect(screen.getByText('Fighter subclass')).toBeInTheDocument()
  })

  it('does not show a subclass parent tag for base classes', () => {
    renderWithAppProviders(
      <ClassDetailPage
        classId={ownedClassResponseFixture.item.id}
        draft={null}
        references={detailReferences}
        response={ownedClassResponseFixture}
        view='active'
      />
    )

    expect(screen.getByRole('heading', { name: /fighter/i })).toBeInTheDocument()
    expect(screen.queryByText('Fighter subclass')).not.toBeInTheDocument()
  })

  it('renders class details in SRD reading order without spellcasting metadata rows', () => {
    const bardResponse = {
      ...ownedClassResponseFixture,
      item: {
        ...ownedClassResponseFixture.item,
        label: 'Bard',
        hitpoint: {
          ability: 'CONSTITUTION',
          dieConfig: 'd8'
        },
        spellcasting: {
          spellLimits: [
            {
              classLevel: 1,
              slots: [{ spellLevel: 1, slotCount: 2 }],
              learnedSpellsLimit: 4,
              cantripsLimit: 2
            },
            {
              classLevel: 3,
              slots: [
                { spellLevel: 1, slotCount: 4 },
                { spellLevel: 2, slotCount: 2 }
              ],
              learnedSpellsLimit: 6,
              cantripsLimit: 2
            }
          ],
          details: [
            {
              id: 'bard-spellcasting-detail',
              label: 'Cantrips',
              description: '<p>You know two cantrips of your choice from the bard spell list.</p>',
              order: 1
            }
          ],
          ability: 'CHARISMA',
          maxSpellLevel: 9,
          charges: {
            id: 'bard-spellcasting-charge',
            resetKind: 'LONG_REST',
            limitKind: 'FIXED_AMOUNT',
            scalingKind: 'NONE',
            amount: 1
          }
        },
        proficiencies: [
          {
            id: 'bard-skill-proficiency',
            grantKind: 'PROFICIENCY_GRANT',
            scalingKind: 'NONE',
            proficiencyKind: 'SKILL',
            selectionKind: 'GRANTED',
            level: 'FULL',
            authoringModeKind: 'SELECTED',
            skillIds: ['performance'],
            order: 1
          }
        ],
        resources: {
          id: 'bardic-inspiration',
          label: 'Bardic Inspiration',
          description: '<p>You can inspire others through stirring words or music.</p>',
          availableAtLevel: 1,
          charges: {
            id: 'bardic-inspiration-charge',
            resetKind: 'LONG_REST',
            limitKind: 'FIXED_AMOUNT',
            scalingKind: 'NONE',
            amount: 0,
            bonuses: [
              {
                id: 'bardic-inspiration-charisma',
                bonusKind: 'ABILITY_MODIFIER',
                ability: 'CHARISMA',
                min: 1,
                order: 1
              }
            ]
          }
        },
        features: [
          {
            id: 'spellcasting-feature',
            label: 'Spellcasting',
            description: 'Metadata duplicate.',
            availableAtLevel: 1,
            order: 1
          },
          {
            id: 'font-of-inspiration',
            label: 'Font of Inspiration',
            description: 'You regain Bardic Inspiration on a short or long rest.',
            availableAtLevel: 5,
            order: 2
          }
        ]
      }
    } satisfies NonNullable<ClassResponseDto>

    renderWithAppProviders(
      <ClassDetailPage
        classId={bardResponse.item!.id}
        draft={null}
        references={detailReferences}
        response={bardResponse}
        view='active'
      />
    )

    const hitPoints = screen.getByRole('heading', { name: 'Hit Points' })
    const proficiencies = screen.getByRole('heading', {
      name: 'Proficiencies'
    })

    expect(
      hitPoints.compareDocumentPosition(proficiencies) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Progression' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: /detail sections/i })).toBeInTheDocument()
    const progressionTable = screen.getByRole('table')
    expect(
      within(progressionTable).getByRole('columnheader', { name: 'Prof.' })
    ).toBeInTheDocument()
    expect(
      within(progressionTable).getByRole('columnheader', { name: 'Known' })
    ).toBeInTheDocument()
    expect(
      within(progressionTable).getByRole('columnheader', {
        name: 'Spell Slots per Spell Level'
      })
    ).toBeInTheDocument()
    expect(within(progressionTable).getByRole('columnheader', { name: '1st' })).toBeInTheDocument()
    expect(within(progressionTable).getByRole('columnheader', { name: '2nd' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Spellcasting' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Resources' })).toBeInTheDocument()
    expect(screen.getAllByText('Bardic Inspiration').length).toBeGreaterThan(0)
    expect(screen.queryByText('Spell Limits')).not.toBeInTheDocument()
    expect(screen.queryByText('Charges')).not.toBeInTheDocument()
    expect(screen.queryByText('Metadata duplicate.')).not.toBeInTheDocument()
  })

  it('shows invalid draft-only recovery without rendering broken content', () => {
    renderWithAppProviders(
      <ClassDetailPage
        classId='class-draft-only'
        draft={draft({ id: 'class-draft-only' })}
        references={detailReferences}
        response={null}
        view='draft'
      />
    )

    expect(screen.getByText(/draft cannot be previewed/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^delete$/i })).toBeInTheDocument()
  })
})
