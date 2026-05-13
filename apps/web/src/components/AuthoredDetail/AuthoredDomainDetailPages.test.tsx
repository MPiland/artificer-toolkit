import { screen } from '@testing-library/react'
import type {
  AuthoredDraftDto,
  FeatResponseDto,
  RaceResponseDto,
  SpellResponseDto
} from '@artificer-toolkit/schema/api/content'
import type { AuthoredContentReferenceData } from '#app/data/contentReferences'
import type {
  SpellDetailReferenceData,
  SpellReferenceData
} from '#app/data/spells/referenceData'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { ownedClassResponseFixture } from '#domains/classes/class.fixtures'
import { ClassDetailPage } from '#domains/classes/pages/ClassDetailPage'
import { masterEquipmentResponseFixture } from '#domains/equipment/equipment.fixtures'
import { EquipmentDetailPage } from '#domains/equipment/pages/EquipmentDetailPage'
import { FeatDetailPage } from '#domains/feats/pages/FeatDetailPage'
import { RaceDetailPage } from '#domains/races/pages/RaceDetailPage'
import { SpellDetailPage } from '#domains/spells/pages/SpellDetailPage'

const spellResponse: NonNullable<SpellResponseDto> = {
  publicId: '1',
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
    systemId: 'system-5e'
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
    id: 'draft-row-id',
    subjectKind: 'CLASS',
    subjectId: 'class-owned',
    publicId: '2',
    userId: 'user-1',
    systemId: 'system-5e',
    label: 'Draft Class',
    status: 'DRAFT',
    draftState: 'ACTIVE_WITH_DRAFT',
    payload
  }
}

const spellReferences = {
  systemId: 'system-5e',
  magicSchools: [{ value: '00000000-0000-0000-0007-000200000000', label: 'Conjuration' }],
  classes: [{ value: '00000000-0000-0000-0010-000c00000000', label: 'Wizard' }],
  damageTypes: [{ value: 'damage-acid', label: 'Acid' }],
  conditionTypes: [],
  skills: [],
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
  systemId: 'system-5e',
  challengeRatings: [],
  conditionTypes: [],
  creatureTypes: [],
  currencies: [],
  damageTypes: [],
  heritages: [],
  languages: [],
  magicSchools: spellReferences.magicSchools,
  rarities: [{ value: 'common', label: 'Common' }],
  skills: [],
  speeds: [],
  classes: [{ value: ownedClassResponseFixture.item.id, label: ownedClassResponseFixture.item.label }],
  creatures: [],
  equipment: [
    { value: masterEquipmentResponseFixture.item.id, label: masterEquipmentResponseFixture.item.label },
    { value: 'torch', label: 'Torch' }
  ],
  races: []
} satisfies AuthoredContentReferenceData

const dragonbornResponse: NonNullable<RaceResponseDto> = {
  publicId: 'dragonborn',
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
        { id: 'black', label: 'Black (Acid)', description: 'Your draconic ancestry is black dragon. Damage type: acid. Breath weapon: 5 by 30 ft. line (DEX save).', order: 0 },
        { id: 'blue', label: 'Blue (Lightning)', description: 'Your draconic ancestry is blue dragon. Damage type: lightning. Breath weapon: 5 by 30 ft. line (DEX save).', order: 1 },
        { id: 'green', label: 'Green (Poison)', description: 'Your draconic ancestry is green dragon. Damage type: poison. Breath weapon: 15 ft. cone (CON save).', order: 2 },
        { id: 'red', label: 'Red (Fire)', description: 'Your draconic ancestry is red dragon. Damage type: fire. Breath weapon: 15 ft. cone (DEX save).', order: 3 }
      ]
    },
    userId: 'master',
    systemId: 'system-5e'
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
  item: {
    id: 'grappler',
    label: 'Grappler',
    description: 'You have developed the skills necessary to hold your own in close-quarters grappling. Prerequisite: Strength 13 or higher.',
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
    systemId: 'system-5e'
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
      <SpellDetailPage draft={null} references={spellReferences} response={spellResponse} spellId='spell-sea-step' view='active' />
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
        references={cachedSpellListReferences}
        response={{
          ...spellResponse,
          item: {
            ...spellResponse.item,
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
        equipmentId={masterEquipmentResponseFixture.item.id}
        references={detailReferences}
        response={masterEquipmentResponseFixture}
        view='active'
      />
    )

    expect(screen.getByRole('heading', { name: /backpack/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^edit$/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /duplicate/i })).toBeInTheDocument()
  })

  it('renders dragonborn ancestry options as a compact table without order labels', () => {
    renderWithAppProviders(
      <RaceDetailPage
        draft={null}
        raceId='dragonborn'
        references={{ speeds: [{ value: 'walk', label: 'Walking Speed' }] }}
        response={dragonbornResponse}
        view='active'
      />
    )

    expect(screen.getByRole('heading', { name: /dragonborn/i })).toBeInTheDocument()
    expect(screen.getAllByText('Dragonborn bear draconic heritage.')).toHaveLength(1)
    expect(screen.getByRole('columnheader', { name: /dragon/i })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /damage type/i })).toBeInTheDocument()
    expect(screen.getByText('Black')).toBeInTheDocument()
    expect(screen.getAllByText('5 by 30 ft. line (DEX save)').length).toBeGreaterThan(0)
    expect(screen.queryByText(/option 0/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/level 1/i)).not.toBeInTheDocument()
  })

  it('renders feat prerequisites from structured data and hides empty mechanics', () => {
    renderWithAppProviders(
      <FeatDetailPage
        draft={null}
        featId='grappler'
        response={grapplerResponse}
        view='active'
      />
    )

    expect(screen.getByRole('heading', { name: /grappler/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /prerequisite/i })).toBeInTheDocument()
    expect(screen.getByText(/strength 13 or higher/i, { selector: 'li' })).toBeInTheDocument()
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
    expect(screen.getByText('Draft Preview')).toBeInTheDocument()
    expect(screen.getByText(/active class remains unchanged/i)).toBeInTheDocument()
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
    expect(screen.getByRole('button', { name: /discard draft/i })).toBeInTheDocument()
  })
})
