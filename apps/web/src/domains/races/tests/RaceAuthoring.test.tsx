import { useMemo, useState } from 'react'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
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
  }, 10000)
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
  }, 10000)

  it('uses subrace content steps without the base ancestry step', async () => {
    const user = userEvent.setup()

    renderWithAppProviders(
      <RaceAuthoringHarness race={ownedSubraceFixture} />
    )

    expect(screen.queryByRole('button', { name: /ancestry/i })).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /parent race/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByRole('combobox', { name: /size/i })).toBeInTheDocument()
  }, 10000)

  it('renders the single ancestry object inline without exposing managed IDs', () => {
    renderWithAppProviders(
      <RaceAuthoringHarness
        model={ancestryRuntimeFixture}
        race={masterRaceFixture}
      />
    )

    expect(screen.queryByRole('heading', { level: 2, name: /details/i })).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /^name$/i })).toHaveValue('Draconic Ancestry')
    expect(screen.getAllByLabelText(/description/i).some((field) => field.tagName === 'INPUT')).toBe(false)
    expect(screen.getByRole('button', { name: /^red$/i })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('button', { name: /edit red/i })).not.toBeInTheDocument()
    expect(screen.queryByText('Option 1')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /^id$/i })).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/edit ancestry/i)).not.toBeInTheDocument()
  }, 10000)

  it('renders ancestry option basics inline and opens nested feature editors with the full root breadcrumb trail', async () => {
    const user = userEvent.setup()

    renderWithAppProviders(
      <RaceAuthoringHarness
        model={ancestryRuntimeFixture}
        race={dragonbornRaceWithBreathWeapon}
      />
    )

    await user.click(screen.getByRole('button', { name: /^red$/i }))

    expect(getEditorWorkspaces()).toHaveLength(0)
    await waitFor(() => {
      expect(screen.getAllByRole('textbox', { name: /^name$/i }).some((input) => (
        input instanceof HTMLInputElement && input.value === 'Red'
      ))).toBe(true)
    })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /edit breath weapon/i })).toBeInTheDocument()
    })
    expect(screen.queryByRole('spinbutton', { name: /order/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /edit breath weapon/i }))

    expect(screen.getByRole('region', {
      name: /races \/ elf \/ ancestry \/ options \/ red \/ features \/ breath weapon/i
    })).toBeInTheDocument()
  })

  it('hydrates ancestry option feature values before reset step is used', async () => {
    const user = userEvent.setup()

    renderWithAppProviders(
      <RaceAuthoringHarness
        model={ancestryRuntimeFixture}
        race={dragonbornRaceWithBreathWeapon}
      />
    )

    await user.click(screen.getByRole('button', { name: /^red$/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /edit breath weapon/i })).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /edit breath weapon/i }))

    await waitFor(() => {
      const activeEditor = within(getActiveEditorWorkspace())
      expect(activeEditor.getByRole('textbox', { name: /^name$/i })).toHaveValue('Breath Weapon')
    })

    const editor = within(getActiveEditorWorkspace())
    expect(editor.getByRole('textbox', { name: /available at level/i })).toHaveValue('1')
    expect(editor.getByText('Limited Use')).toBeInTheDocument()

    await user.click(editor.getByRole('button', { name: /mechanics/i }))

    expect(editor.getByRole('button', { name: /^saving throw/i })).toHaveAttribute('aria-expanded', 'false')
    expect(editor.queryByRole('button', { name: /edit saving throw/i })).not.toBeInTheDocument()
    expect(editor.queryByRole('button', { name: /reset step/i })).toBeDisabled()
  })

  it('disables save draft when resetting the only dirty saving throw edit', async () => {
    const user = userEvent.setup()

    renderWithAppProviders(
      <RaceAuthoringHarness
        model={ancestryRuntimeFixture}
        race={dragonbornRaceWithBreathWeapon}
      />
    )

    const featureEditor = await openBreathWeaponSavingThrowDetails(user)
    const baseDcInput = featureEditor.getByRole('textbox', { name: /base dc/i })
    fireEvent.change(baseDcInput, { target: { value: '10' } })

    expect(getSaveDraftButtons().some((button) => !button.disabled)).toBe(true)

    await user.click(featureEditor.getByRole('button', { name: /reset step/i }))

    await waitFor(() => expect(baseDcInput).toHaveValue('8'))
    expect(getSaveDraftButtons().every((button) => button.disabled)).toBe(true)
  }, 10000)

  it('keeps save draft enabled after resetting saving throw edits when another field is dirty', async () => {
    const user = userEvent.setup()

    renderWithAppProviders(
      <RaceAuthoringHarness
        model={ancestryRuntimeFixture}
        race={dragonbornRaceWithBreathWeapon}
      />
    )

    const ancestryName = screen.getByRole('textbox', { name: /^name$/i })
    fireEvent.change(ancestryName, { target: { value: 'Draconic Lineage' } })

    const featureEditor = await openBreathWeaponSavingThrowDetails(user)
    const baseDcInput = featureEditor.getByRole('textbox', { name: /base dc/i })
    fireEvent.change(baseDcInput, { target: { value: '10' } })

    await user.click(featureEditor.getByRole('button', { name: /reset step/i }))

    await waitFor(() => expect(baseDcInput).toHaveValue('8'))
    expect(getSaveDraftButtons().some((button) => !button.disabled)).toBe(true)
  }, 10000)

  it('shows saving throw effects and outcome rows inline on the feature mechanics step', async () => {
    const user = userEvent.setup()

    renderWithAppProviders(
      <RaceAuthoringHarness
        model={ancestryRuntimeFixture}
        race={dragonbornRaceWithBreathWeapon}
      />
    )

    const featureEditor = await openBreathWeaponMechanicsEditor(user)
    const effectRow = featureEditor.getByRole('button', { name: /^saving throw/i })
    const featureWorkspaceCount = getEditorWorkspaces().length

    expect(effectRow).toHaveAttribute('aria-expanded', 'false')
    await user.click(effectRow)
    expect(getEditorWorkspaces()).toHaveLength(featureWorkspaceCount)

    const saveFailureRow = featureEditor.getByRole('button', { name: /^on save failure$/i })
    const saveSuccessRow = featureEditor.getByRole('button', { name: /^on save success$/i })

    expect(saveFailureRow).toHaveAttribute('aria-expanded', 'false')
    expect(saveSuccessRow).toHaveAttribute('aria-expanded', 'false')

    await user.click(saveFailureRow)

    expect(getEditorWorkspaces()).toHaveLength(featureWorkspaceCount)
    expect(featureEditor.getByRole('combobox', { name: /outcome path/i })).toBeInTheDocument()
    expect(featureEditor.getByRole('combobox', { name: /selection model/i })).toBeInTheDocument()
    expect(featureEditor.getByRole('combobox', { name: /starts from/i })).toBeInTheDocument()
    expect(featureEditor.getByRole('button', { name: /^range override$/i })).toBeInTheDocument()
    expect(featureEditor.getByRole('button', { name: /^targeting override$/i })).toBeInTheDocument()
    expect(featureEditor.getByRole('combobox', { name: /outcome type/i })).toBeInTheDocument()
    expect(featureEditor.getAllByText('Outcomes').length).toBeGreaterThan(0)
    expect(featureEditor.getByRole('button', { name: /edit damage/i })).toBeInTheDocument()

    await user.click(featureEditor.getByRole('button', { name: /edit damage/i }))

    const outcomeEditor = within(getActiveEditorWorkspace())
    expect(outcomeEditor.getByRole('combobox', { name: /effect kind/i })).toBeInTheDocument()
    expect(outcomeEditor.getByRole('textbox', { name: /dice config/i })).toHaveValue('2d6')
  }, 10000)

  it('returns from nested outcome editing to the feature mechanics step', async () => {
    const user = userEvent.setup()

    renderWithAppProviders(
      <RaceAuthoringHarness
        model={ancestryRuntimeFixture}
        race={dragonbornRaceWithBreathWeapon}
      />
    )

    const featureEditor = await openBreathWeaponMechanicsEditor(user)
    await user.click(featureEditor.getByRole('button', { name: /^saving throw/i }))
    await user.click(featureEditor.getByRole('button', { name: /^on save failure$/i }))
    await user.click(featureEditor.getByRole('button', { name: /edit damage/i }))

    const outcomeEditor = within(getActiveEditorWorkspace())
    expect(outcomeEditor.getByRole('combobox', { name: /effect kind/i })).toBeInTheDocument()

    await user.click(outcomeEditor.getByRole('button', { name: /^back$/i }))

    const restoredFeatureEditor = within(getActiveEditorWorkspace())
    expect(restoredFeatureEditor.getByRole('button', { name: /^saving throw/i })).toBeInTheDocument()
    expect(restoredFeatureEditor.queryByRole('textbox', { name: /available at level/i })).not.toBeInTheDocument()
  }, 10000)

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
                    originKind: 'SOURCE',
                    rangeOverride: { rangeKind: 'SELF' },
                    targetingOverride: {
                      selectionKind: 'AREA_CONTENTS',
                      dispositionKind: 'ANY'
                    },
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
                  },
                  {
                    id: 'breath-weapon-success',
                    order: 2,
                    pathCode: 'ON_SAVE_SUCCESS',
                    selectionKind: 'FIXED',
                    resultBlock: {
                      id: 'breath-weapon-success-result',
                      resultKind: 'SINGLE',
                      outcomes: [
                        {
                          id: 'breath-weapon-half-damage',
                          effectKind: 'DAMAGE',
                          amountKind: 'HALF',
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

async function openBreathWeaponMechanicsEditor(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /^red$/i }))
  await waitFor(() => {
    expect(screen.getByRole('button', { name: /edit breath weapon/i })).toBeInTheDocument()
  })
  await user.click(screen.getByRole('button', { name: /edit breath weapon/i }))

  await waitFor(() => {
    expect(within(getActiveEditorWorkspace()).getByRole('textbox', { name: /^name$/i })).toHaveValue('Breath Weapon')
  })

  const featureEditor = within(getActiveEditorWorkspace())
  await user.click(featureEditor.getByRole('button', { name: /mechanics/i }))

  return featureEditor
}

async function openBreathWeaponSavingThrowDetails(user: ReturnType<typeof userEvent.setup>) {
  const featureEditor = await openBreathWeaponMechanicsEditor(user)
  await user.click(featureEditor.getByRole('button', { name: /^saving throw/i }))

  await waitFor(() => {
    expect(featureEditor.getByRole('button', { name: /^on save failure$/i })).toBeInTheDocument()
  })

  await user.click(featureEditor.getByRole('button', { name: /^saving throw$/i }))

  await waitFor(() => {
    expect(featureEditor.getByRole('textbox', { name: /base dc/i })).toHaveValue('8')
  })

  return featureEditor
}

function getEditorWorkspaces() {
  return screen.queryAllByRole('region').filter((region) => (
    within(region).queryByRole('button', { name: /close editor/i }) != null
  ))
}

function getActiveEditorWorkspace() {
  const workspace = getEditorWorkspaces().at(-1)
  if (!workspace) throw new Error('Expected an active editor workspace.')
  return workspace
}

function getSaveDraftButtons() {
  return screen.getAllByRole('button', { name: /save draft/i }) as HTMLButtonElement[]
}
