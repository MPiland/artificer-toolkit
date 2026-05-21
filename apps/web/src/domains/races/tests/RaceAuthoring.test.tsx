import { useMemo, useState } from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type {
  NodeRuntimeResolveResponseDto
} from '@artificer-toolkit/schema/api/nodeRuntime'
import type {
  RaceAuthoringInputDto,
  RaceAuthoredDto
} from '@artificer-toolkit/schema/subjects/race'
import {
  AuthoringFormLayout,
  AuthoringFormProvider,
  clearResolvedNodeFormPaths,
  useAppForm,
  useAuthoringFormRegistration,
  type AuthoringFormActionHandlers,
  type AuthoringFormRegistration
} from '#forms'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import {
  normalizeRaceForSubmit,
  toRaceFormValues
} from '../raceAuthoring.utils'
import { RaceAuthoringRenderer } from '../components/RaceAuthoringRenderer'
import {
  masterRaceFixture,
  ownedSubraceFixture,
  raceRuntimeFixture
} from '../race.fixtures'

function RaceAuthoringHarness({
  model = raceRuntimeFixture,
  race,
  readOnly = false
}: {
  model?: NodeRuntimeResolveResponseDto
  race: RaceAuthoringInputDto | RaceAuthoredDto
  readOnly?: boolean
}) {
  return (
    <AuthoringFormProvider>
      <RaceAuthoringHarnessContent model={model} race={race} readOnly={readOnly} />
    </AuthoringFormProvider>
  )
}

function RaceAuthoringHarnessContent({
  model,
  race,
  readOnly
}: {
  model: NodeRuntimeResolveResponseDto
  race: RaceAuthoringInputDto | RaceAuthoredDto
  readOnly: boolean
}) {
  const [formValues] = useState(() => toRaceFormValues(race))
  const form = useAppForm({
    defaultValues: formValues,
    onSubmit: async ({ value }) => {
      normalizeRaceForSubmit(value)
    }
  })
  const registration = useMemo<AuthoringFormRegistration>(() => ({
    activateLabel: 'Activate Race',
    canCopy: readOnly,
    canSaveDraft: !readOnly,
    hasActiveDraft: false,
    mapId: 'race',
    mode: readOnly ? 'view' : 'edit',
    providedModel: model,
    readOnly,
    resolveModel: false,
    saveDraftLabel: 'Save Draft',
    subjectKindLabel: 'Race',
    subjectLabel: formValues.label || 'Untitled Race',
    systemId: formValues.systemId
  }), [
    formValues.label,
    formValues.systemId,
    readOnly
  ])
  const actions = useMemo<AuthoringFormActionHandlers>(() => ({
    onActivate: () => form.handleSubmit(),
    onClearPaths: (paths) => clearResolvedNodeFormPaths(form, paths),
    onCopy: readOnly ? () => undefined : undefined,
    onSaveDraft: readOnly ? undefined : () => undefined
  }), [
    form,
    readOnly
  ])

  useAuthoringFormRegistration(registration, actions)

  return (
    <form.AppForm>
      <AuthoringFormLayout>
        <RaceAuthoringRenderer form={form} resolveModel={false} />
      </AuthoringFormLayout>
    </form.AppForm>
  )
}

describe('Race authoring renderer', () => {
  it('renders locked master view as read-only with duplicate affordance', () => {
    renderWithAppProviders(
      <RaceAuthoringHarness
        race={masterRaceFixture}
        readOnly
      />
    )

    expect(screen.getByText(/locked for direct editing/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /duplicate to edit/i })).toBeEnabled()
    expect(screen.getByRole('combobox', { name: /category/i })).toHaveAttribute('readonly')
  })

  it('uses subrace content steps without the base ancestry step', async () => {
    const user = userEvent.setup()

    renderWithAppProviders(
      <RaceAuthoringHarness race={ownedSubraceFixture} />
    )

    expect(screen.queryByRole('button', { name: /ancestry/i })).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /parent race/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByRole('combobox', { name: /size/i })).toBeInTheDocument()
  })

  it('renders the single ancestry object inline without exposing managed IDs', () => {
    renderWithAppProviders(
      <RaceAuthoringHarness
        model={ancestryRuntimeFixture}
        race={masterRaceFixture}
      />
    )

    expect(screen.queryByRole('heading', { level: 2, name: /details/i })).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /^name$/i })).toHaveValue('Draconic Ancestry')
    expect(screen.getByLabelText(/description/i).tagName).not.toBe('INPUT')
    expect(screen.getByRole('button', { name: /edit red/i })).toBeInTheDocument()
    expect(screen.queryByText('Option 1')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /^id$/i })).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/edit ancestry/i)).not.toBeInTheDocument()
  })

  it('opens ancestry option editors with the full root breadcrumb trail and nested step footer', async () => {
    const user = userEvent.setup()

    renderWithAppProviders(
      <RaceAuthoringHarness
        model={ancestryRuntimeFixture}
        race={masterRaceFixture}
      />
    )

    await user.click(screen.getByRole('button', { name: /edit red/i }))

    const editorLocation = screen.getByRole('navigation', { name: /editor location/i })
    expect(editorLocation).toHaveTextContent('Races')
    expect(editorLocation).toHaveTextContent('Elf')
    expect(editorLocation).toHaveTextContent('Ancestry')
    expect(editorLocation).toHaveTextContent('Options')
    expect(editorLocation).toHaveTextContent('Red')
    expect(editorLocation).not.toHaveTextContent('Details')
    expect(screen.queryByRole('spinbutton', { name: /order/i })).not.toBeInTheDocument()

    const redEditor = within(screen.getAllByRole('dialog').at(-1)!)
    await user.click(redEditor.getByRole('button', { name: /^next$/i }))

    expect(redEditor.getByRole('button', { name: /add feature/i })).toBeInTheDocument()
    expect(redEditor.getByRole('navigation', { name: /form sections/i })).toHaveTextContent('Features')
  })

  it('hydrates ancestry option feature values before reset step is used', async () => {
    const user = userEvent.setup()

    renderWithAppProviders(
      <RaceAuthoringHarness
        model={ancestryRuntimeFixture}
        race={dragonbornRaceWithBreathWeapon}
      />
    )

    await user.click(screen.getByRole('button', { name: /edit red/i }))
    const redEditor = within(screen.getAllByRole('dialog').at(-1)!)
    await user.click(redEditor.getByRole('button', { name: /^next$/i }))
    await user.click(redEditor.getByRole('button', { name: /edit breath weapon/i }))

    await waitFor(() => {
      const activeEditor = within(screen.getAllByRole('dialog').at(-1)!)
      expect(activeEditor.getByRole('textbox', { name: /^name$/i })).toHaveValue('Breath Weapon')
    })

    const editor = within(screen.getAllByRole('dialog').at(-1)!)
    expect(editor.getByRole('textbox', { name: /available at level/i })).toHaveValue('1')
    expect(editor.getByText('Limited Use')).toBeInTheDocument()

    await user.click(editor.getByRole('button', { name: /mechanics/i }))

    expect(editor.getByRole('button', { name: /edit saving throw/i })).toBeInTheDocument()
    expect(editor.queryByRole('button', { name: /reset step/i })).toBeDisabled()
  })

  it('does not enable save draft when initial clear-path normalization removes stale hidden values', async () => {
    const user = userEvent.setup()
    const staleBaseRace = {
      ...masterRaceFixture,
      parentRaceId: 'elf'
    }

    renderWithAppProviders(
      <RaceAuthoringHarness
        model={ancestryRuntimeFixtureWithClearPath}
        race={staleBaseRace}
      />
    )

    const saveDraftButton = screen.getByRole('button', { name: /save draft/i })
    await waitFor(() => expect(saveDraftButton).toBeDisabled())

    await user.clear(screen.getByRole('textbox', { name: /^name$/i }))
    await user.type(screen.getByRole('textbox', { name: /^name$/i }), 'Draconic Lineage')

    expect(saveDraftButton).toBeEnabled()
  })
})

const ancestryRuntimeFixture: NodeRuntimeResolveResponseDto = {
  mapId: 'race',
  clearPaths: [],
  steps: [
    {
      id: 'ancestry',
      label: 'Ancestry',
      order: 30,
      sections: [
        {
          id: 'ancestry',
          label: 'Ancestry',
          order: 30,
          nodes: [
            {
              id: 'ancestry',
              path: ['ancestry'],
              label: 'Ancestry',
              kind: 'GROUP',
              groupKind: 'OBJECT',
              childMapId: 'raceAncestry',
              visible: true,
              required: false,
              clearPaths: []
            }
          ]
        }
      ]
    }
  ]
}

const ancestryRuntimeFixtureWithClearPath: NodeRuntimeResolveResponseDto = {
  ...ancestryRuntimeFixture,
  clearPaths: [['parentRaceId']]
}

const dragonbornRaceWithBreathWeapon: RaceAuthoredDto = {
  ...masterRaceFixture,
  ancestry: {
    ...masterRaceFixture.ancestry!,
    options: [
      {
        id: 'red-dragon',
        label: 'Red',
        description: 'Fire damage and fire resistance.',
        order: 1,
        features: [
          {
            id: 'breath-weapon',
            label: 'Breath Weapon',
            description: 'Exhale destructive energy tied to your draconic ancestry.',
            attributes: ['LIMITED_USE'],
            availableAtLevel: 1,
            charges: {
              id: 'breath-weapon-charges',
              resetKind: 'SHORT_REST',
              limitKind: 'FIXED_AMOUNT',
              scalingKind: 'NONE',
              amount: 1,
              bonuses: []
            },
            effects: [
              {
                id: 'breath-weapon-effect',
                order: 1,
                invocation: {
                  kind: 'ACTION',
                  triggerCode: 'SAVING_THROW',
                  activation: { code: 'ACTION', amount: 1 },
                  savingThrow: {
                    id: 'breath-weapon-save',
                    dcMethod: 'DERIVED_DC',
                    ability: 'DEXTERITY',
                    baseDc: 8,
                    bonuses: [
                      {
                        id: 'breath-weapon-dc-ability',
                        bonusKind: 'ABILITY_MODIFIER',
                        ability: 'CONSTITUTION'
                      },
                      {
                        id: 'breath-weapon-dc-proficiency',
                        bonusKind: 'PROFICIENCY_BONUS'
                      }
                    ]
                  },
                  range: { rangeKind: 'SELF' },
                  targeting: {
                    selectionKind: 'AREA_CONTENTS',
                    dispositionKind: 'ANY'
                  }
                },
                paths: [
                  {
                    id: 'breath-weapon-failure',
                    order: 1,
                    pathCode: 'ON_SAVE_FAIL',
                    selectionKind: 'FIXED',
                    resultBlock: {
                      id: 'breath-weapon-failure-result',
                      resultKind: 'SINGLE',
                      outcomes: [
                        {
                          id: 'breath-weapon-damage',
                          effectKind: 'DAMAGE',
                          valueKind: 'DICE',
                          scalingKind: 'NONE',
                          diceConfig: '2d6',
                          damageTypeId: 'fire'
                        }
                      ]
                    }
                  }
                ]
              }
            ],
            order: 1
          }
        ]
      }
    ]
  }
}
