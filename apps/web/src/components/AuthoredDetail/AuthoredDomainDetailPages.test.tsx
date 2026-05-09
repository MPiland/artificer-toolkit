import { screen } from '@testing-library/react'
import type {
  AuthoredDraftDto,
  SpellResponseDto
} from '@artificer-toolkit/schema/api/content'
import type { AuthoredContentReferenceData } from '#app/data/contentReferences'
import type { SpellReferenceData } from '#app/data/spells/referenceData'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { ownedClassResponseFixture } from '#domains/classes/class.fixtures'
import { ClassDetailPage } from '#domains/classes/pages/ClassDetailPage'
import { masterEquipmentResponseFixture } from '#domains/equipment/equipment.fixtures'
import { EquipmentDetailPage } from '#domains/equipment/pages/EquipmentDetailPage'
import { SpellDetailPage } from '#domains/spells/pages/SpellDetailPage'

const spellResponse: NonNullable<SpellResponseDto> = {
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
    effects: [],
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
  damageTypes: [],
  conditionTypes: [],
  skills: [],
  speeds: [],
  creatures: []
} satisfies SpellReferenceData

const detailReferences = {
  systemId: 'system-5e',
  challengeRatings: [],
  conditionTypes: [],
  creatureTypes: [],
  damageTypes: [],
  heritages: [],
  magicSchools: spellReferences.magicSchools,
  rarities: [{ value: 'common', label: 'Common' }],
  speeds: [],
  classes: [{ value: ownedClassResponseFixture.item.id, label: ownedClassResponseFixture.item.label }],
  creatures: [],
  equipment: [
    { value: masterEquipmentResponseFixture.item.id, label: masterEquipmentResponseFixture.item.label },
    { value: 'torch', label: 'Torch' }
  ],
  races: []
} satisfies AuthoredContentReferenceData

describe('authored domain detail pages', () => {
  it('renders an active spell detail page', () => {
    renderWithAppProviders(
      <SpellDetailPage draft={null} references={spellReferences} response={spellResponse} spellId='spell-sea-step' />
    )

    expect(screen.getByRole('heading', { name: /sea step/i })).toBeInTheDocument()
    expect(screen.getByText('Spell')).toBeInTheDocument()
    expect(screen.getAllByText('Move like water.')).toHaveLength(2)
    expect(screen.getByText('Conjuration')).toBeInTheDocument()
    expect(screen.getByText('Wizard')).toBeInTheDocument()
    expect(screen.queryByText('00000000-0000-0000-0007-000200000000')).not.toBeInTheDocument()
  })

  it('renders locked master equipment as readable with duplicate available', () => {
    renderWithAppProviders(
      <EquipmentDetailPage
        draft={null}
        equipmentId={masterEquipmentResponseFixture.item.id}
        references={detailReferences}
        response={masterEquipmentResponseFixture}
      />
    )

    expect(screen.getByRole('heading', { name: /backpack/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^edit$/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /duplicate/i })).toBeInTheDocument()
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
      />
    )

    expect(screen.getByText(/draft cannot be previewed/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /discard draft/i })).toBeInTheDocument()
  })
})
