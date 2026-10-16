import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type {
  EncounterCommandResultDto,
  EncounterGmProjectionDto,
  EndHeldGrantInputDto,
  EscapeRelationshipInputDto,
  ResolveEncounterActionInputDto
} from '@artificer-toolkit/schema/api/encounters'
import {
  encounterActionChoiceDtoSchema,
  encounterActionChoicesDtoSchema,
  type EncounterActionChoiceDto,
  type EncounterActionChoicesDto,
  type EncounterEscapeChoiceDto
} from '@artificer-toolkit/schema/api/encounterActionChoices'
import {
  directedAreaSizeInSceneCoordinates,
  pointAreaInSceneCoordinates
} from '@artificer-toolkit/shared/vtt'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { validated } from '../../../test/validatedFixture'
import { CampaignTabletopActionDrawer } from './CampaignTabletopActionDrawer'
import { tabletopGmEncounter, tabletopLiveScene } from './CampaignTabletop.stories.fixtures'
import { LiveSessionCommandRejectedError } from './liveSessionClient'
import type { VttActionPreview, VttAreaAim, VttAreaSize } from './vttSceneRenderer.model'

vi.mock('#app/settings/useGmRollVisibilityPreference', () => ({
  useGmRollVisibilityPreference: () => ({
    gmRollVisibility: 'PUBLIC',
    setGmRollVisibility: vi.fn()
  })
}))

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn()
  })
})

const validatedChoice = validated(encounterActionChoiceDtoSchema)
const validatedChoices = validated(encounterActionChoicesDtoSchema.shape.actions)
const actions = validatedChoices([
  {
    id: 'equipment-staff:attack',
    label: 'Quarterstaff',
    sourceLabel: 'Equipment',
    rangeLabel: '5 ft',
    attackBonus: 4,
    grip: null,
    wieldConflict: null,
    warnings: [],
    target: { kind: 'ACTOR', self: 'ALLOWED' },
    attackSlot: null
  }
])
const warnings = [
  { code: 'ACTION_ECONOMY_UNAVAILABLE' as const, message: 'No action left this turn.' },
  { code: 'TARGET_OUT_OF_RANGE' as const, message: 'The target is out of range.' }
]
const resolved: EncounterCommandResultDto = {
  projection: tabletopGmEncounter,
  roll: null,
  occurrence: null,
  evidenceRoll: null
}

function drawerElement(
  onResolve: (command: ResolveEncounterActionInputDto) => Promise<unknown>,
  {
    choices = actions,
    unavailableActions = [],
    authoredBasicActions = [],
    escapes = [],
    heldGrantEnds = [],
    openAttackAction = null,
    encounter = tabletopGmEncounter,
    onEscape = vi.fn(),
    onEndHeldGrant = vi.fn(),
    escapeResult = resolved,
    isGm = false,
    waitingOn = null,
    scene = tabletopLiveScene,
    areaAim = null,
    onAreaAimChange = vi.fn(),
    onAreaSizeChange = vi.fn(),
    onActionPreviewChange = vi.fn(),
    actorIdByTokenId = new Map(),
    onPickAreaOrigin = vi.fn()
  }: {
    choices?: EncounterActionChoiceDto[]
    unavailableActions?: EncounterActionChoicesDto['unavailableActions']
    authoredBasicActions?: EncounterActionChoiceDto[]
    escapes?: EncounterEscapeChoiceDto[]
    heldGrantEnds?: EncounterActionChoicesDto['heldGrantEnds']
    openAttackAction?: EncounterActionChoicesDto['openAttackAction']
    encounter?: EncounterGmProjectionDto
    onEscape?: (command: EscapeRelationshipInputDto) => Promise<unknown>
    onEndHeldGrant?: (command: EndHeldGrantInputDto) => Promise<unknown>
    /** What the room answers an escape with. */
    escapeResult?: EncounterCommandResultDto
    isGm?: boolean
    waitingOn?: 'GM' | 'PLAYER' | null
    scene?: typeof tabletopLiveScene | null
    areaAim?: VttAreaAim | null
    onAreaAimChange?: (aim: VttAreaAim | null) => void
    onAreaSizeChange?: (size: VttAreaSize | null) => void
    onActionPreviewChange?: (preview: VttActionPreview | null) => void
    actorIdByTokenId?: ReadonlyMap<string, string>
    onPickAreaOrigin?: () => void
  } = {}
) {
  return (
    <CampaignTabletopActionDrawer
      actionChoicesError={null}
      actions={choices}
      basicActionChoices={authoredBasicActions}
      escapes={escapes}
      heldGrantEnds={heldGrantEnds}
      openAttackAction={openAttackAction}
      actionsLoading={false}
      actorIdByTokenId={actorIdByTokenId}
      connected
      encounter={encounter}
      isGm={isGm}
      opened
      optionalRules={[]}
      pending={false}
      unavailableActions={unavailableActions}
      scene={scene}
      areaAim={areaAim}
      waitingOn={waitingOn}
      onAreaAimChange={onAreaAimChange}
      onAreaSizeChange={onAreaSizeChange}
      onActionPreviewChange={onActionPreviewChange}
      onPickAreaOrigin={onPickAreaOrigin}
      onClose={vi.fn()}
      onLoadOptionalChoices={vi.fn()}
      onOpen={vi.fn()}
      onResolve={async (command) => {
        await onResolve(command)
        return resolved
      }}
      onEscape={async (command) => {
        await onEscape(command)
        return escapeResult
      }}
      onEndHeldGrant={async (command) => {
        await onEndHeldGrant(command)
        return resolved
      }}
    />
  )
}

function renderDrawer(...args: Parameters<typeof drawerElement>) {
  return renderWithAppProviders(drawerElement(...args))
}

async function chooseActionAndTarget(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('combobox', { name: 'Action' }))
  await user.keyboard('{ArrowDown}{Enter}')
  await user.click(screen.getByRole('combobox', { name: 'Target' }))
  await user.keyboard('{ArrowDown}{Enter}')
  await user.click(screen.getByRole('button', { name: 'Resolve action' }))
}

describe('CampaignTabletopActionDrawer roll visibility', () => {
  it('sends the GM visibility (Public until chosen) and sends none for a player', async () => {
    const user = userEvent.setup()
    const onResolve = vi.fn<(command: ResolveEncounterActionInputDto) => Promise<unknown>>()
    const gm = renderDrawer(onResolve, { isGm: true })
    await chooseActionAndTarget(user)
    expect(onResolve).toHaveBeenLastCalledWith(expect.objectContaining({ visibility: 'PUBLIC' }))
    expect(screen.getByRole('radio', { name: 'Public' })).toBeChecked()
    gm.unmount()

    renderDrawer(onResolve)
    expect(screen.queryByRole('radiogroup', { name: 'Roll visibility' })).not.toBeInTheDocument()
    await chooseActionAndTarget(user)
    expect(onResolve.mock.lastCall?.[0]).not.toHaveProperty('visibility')
  })
})

describe('CampaignTabletopActionDrawer rule warnings', () => {
  it('shows the server warnings and resends with them acknowledged on "Do it anyway"', async () => {
    const user = userEvent.setup()
    const onResolve = vi
      .fn<(command: ResolveEncounterActionInputDto) => Promise<unknown>>()
      .mockImplementationOnce(async (command) => {
        throw new LiveSessionCommandRejectedError({
          code: 'DOMAIN_REJECTED',
          commandId: command.commandId,
          currentSequence: 3,
          message: 'This action breaks a rule. Do it anyway?',
          reason: 'RULE_WARNINGS',
          warnings
        })
      })
      .mockResolvedValue(resolved)
    renderDrawer(onResolve)

    await chooseActionAndTarget(user)
    const confirmation = await screen.findByRole('alert')
    expect(within(confirmation).getByText('No action left this turn.')).toBeVisible()
    expect(within(confirmation).getByText('The target is out of range.')).toBeVisible()
    expect(onResolve).toHaveBeenCalledWith(expect.objectContaining({ acknowledgedWarnings: [] }))

    await user.click(within(confirmation).getByRole('button', { name: 'Do it anyway' }))
    expect(onResolve).toHaveBeenCalledTimes(2)
    const [first, second] = onResolve.mock.calls.map(([command]) => command)
    expect(second).toMatchObject({
      actionId: first!.actionId,
      target: first!.target,
      acknowledgedWarnings: ['ACTION_ECONOMY_UNAVAILABLE', 'TARGET_OUT_OF_RANGE']
    })
    expect(second!.commandId).not.toBe(first!.commandId)
  })

  it('offers a versatile attack once, with a grip control that picks its action (D57)', async () => {
    const user = userEvent.setup()
    const onResolve = vi
      .fn<(command: ResolveEncounterActionInputDto) => Promise<unknown>>()
      .mockResolvedValue(resolved)
    const longsword = (grip: 'ONE_HANDED' | 'TWO_HANDED') => ({
      id: `erinyes:FEATURE:longsword:EFFECT:${grip}`,
      label: 'Longsword',
      attackBonus: 8,
      grip: { value: grip, attackKey: 'longsword::MELEE_WEAPON_ATTACK' },
      wieldConflict: null,
      warnings: [],
      target: { kind: 'ACTOR' as const, self: 'ALLOWED' as const },
      attackSlot: null
    })
    renderDrawer(onResolve, { choices: [longsword('ONE_HANDED'), longsword('TWO_HANDED')] })

    await user.click(await screen.findByRole('combobox', { name: 'Action' }))
    expect(screen.getAllByRole('option', { name: 'Longsword' })).toHaveLength(1)
    await user.keyboard('{ArrowDown}{Enter}')
    await user.click(screen.getByRole('radio', { name: 'Two hands' }))
    await user.click(screen.getByRole('combobox', { name: 'Target' }))
    await user.keyboard('{ArrowDown}{Enter}')
    await user.click(screen.getByRole('button', { name: 'Resolve action' }))
    expect(onResolve).toHaveBeenCalledWith(
      expect.objectContaining({ actionId: longsword('TWO_HANDED').id })
    )
  })

  it('cancels without resending', async () => {
    const user = userEvent.setup()
    const onResolve = vi
      .fn<(command: ResolveEncounterActionInputDto) => Promise<unknown>>()
      .mockRejectedValueOnce(
        new LiveSessionCommandRejectedError({
          code: 'DOMAIN_REJECTED',
          commandId: crypto.randomUUID(),
          currentSequence: 3,
          message: 'This action breaks a rule. Do it anyway?',
          reason: 'RULE_WARNINGS',
          warnings: warnings.slice(0, 1)
        })
      )
    renderDrawer(onResolve)

    await chooseActionAndTarget(user)
    await user.click(await screen.findByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('button', { name: 'Do it anyway' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resolve action' })).toBeEnabled()
    expect(onResolve).toHaveBeenCalledTimes(1)
  })
})

describe('CampaignTabletopActionDrawer availability', () => {
  it('shows why an action already breaks a rule before it is chosen', async () => {
    const user = userEvent.setup()
    renderDrawer(vi.fn(), {
      choices: [
        {
          ...actions[0]!,
          warnings: [
            { code: 'ACTION_ECONOMY_UNAVAILABLE', message: 'No bonus action left this turn.' }
          ]
        }
      ]
    })

    await user.click(await screen.findByRole('combobox', { name: 'Action' }))
    expect(await screen.findByText('No bonus action left this turn.')).toBeInTheDocument()
    await user.keyboard('{ArrowDown}{Enter}')
    expect(screen.getByRole('listitem')).toHaveTextContent('No bonus action left this turn.')
  })

  it('lists an action whose authored mechanics cannot run with its reason, never selectable', async () => {
    const user = userEvent.setup()
    renderDrawer(vi.fn(), {
      unavailableActions: [
        {
          id: 'unavailable-action',
          label: 'Quill Volley',
          reason:
            'Encounter feature attack action "Quill Volley" must author exactly one ATTACK roll definition.'
        }
      ]
    })

    await user.click(await screen.findByRole('combobox', { name: 'Action' }))
    const option = await screen.findByRole('option', { name: /Quill Volley/ })
    expect(option).toHaveAttribute('data-combobox-disabled')
    expect(option).toHaveTextContent('must author exactly one ATTACK roll definition')
    await user.click(option)
    expect(screen.getByRole('combobox', { name: 'Action' })).toHaveValue('')
  })

  it('waits on whoever the server says must answer the pending decision', async () => {
    const { unmount } = renderDrawer(vi.fn(), { waitingOn: 'GM' })
    expect(screen.getByText('Waiting on the GM')).toBeVisible()
    expect(screen.getByRole('combobox', { name: 'Action' })).toBeDisabled()
    unmount()

    renderDrawer(vi.fn(), { waitingOn: 'PLAYER' })
    expect(screen.getByText('Waiting on another player')).toBeVisible()
  })
})

const basicActionChoices = validatedChoices([
  {
    ...actions[0]!,
    id: 'dash-action',
    label: 'Dash',
    rulesText: 'You gain extra movement for the current turn.',
    target: { kind: 'SELF' }
  },
  {
    ...actions[0]!,
    id: 'help-action',
    label: 'Help',
    rulesText: 'You aid an ally.',
    target: { kind: 'ACTOR', self: 'REFUSED' }
  },
  {
    ...actions[0]!,
    id: 'first-aid-action',
    label: 'First Aid',
    rulesText: 'You make a DC 10 Wisdom (Medicine) check to stabilize a dying creature.',
    target: { kind: 'ACTOR', self: 'REFUSED' }
  }
])

describe('CampaignTabletopActionDrawer basic actions', () => {
  it('lists the System basic actions in their own section, apart from feature actions', async () => {
    renderDrawer(vi.fn(), { authoredBasicActions: basicActionChoices })

    const section = await screen.findByRole('region', { name: 'Basic actions' })
    expect(within(section).getByText('Dash')).toBeVisible()
    expect(within(section).getByText('Help')).toBeVisible()
    expect(within(section).queryByText('Quarterstaff')).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Action' })).toBeVisible()
  })

  it('uses a basic action for the current actor', async () => {
    const user = userEvent.setup()
    const onResolve = vi.fn().mockResolvedValue(resolved)
    renderDrawer(onResolve, { choices: [], authoredBasicActions: basicActionChoices })

    await user.click(await screen.findByRole('button', { name: 'Use Dash' }))
    expect(onResolve).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'RESOLVE_ACTION',
        encounterId: tabletopGmEncounter.id,
        expectedVersion: tabletopGmEncounter.version,
        actorId: tabletopGmEncounter.currentActorId,
        actionId: basicActionChoices[0].id,
        target: { kind: 'ACTOR', actorId: tabletopGmEncounter.currentActorId },
        acknowledgedWarnings: []
      })
    )
    expect(await screen.findByText('Dash used.')).toBeVisible()
  })

  it('resolves an authored basic action on the current actor', async () => {
    const user = userEvent.setup()
    const onResolve = vi.fn().mockResolvedValue(resolved)
    const dodge = validatedChoice({
      ...actions[0]!,
      id: 'dodge-action',
      label: 'Dodge',
      rulesText: 'You dodge.',
      target: { kind: 'SELF' }
    })
    renderDrawer(onResolve, { choices: [], authoredBasicActions: [dodge] })

    await user.click(await screen.findByRole('button', { name: 'Use Dodge' }))
    expect(onResolve).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'RESOLVE_ACTION',
        actorId: tabletopGmEncounter.currentActorId,
        actionId: 'dodge-action',
        target: { kind: 'ACTOR', actorId: tabletopGmEncounter.currentActorId },
        acknowledgedWarnings: []
      })
    )
    expect(await screen.findByText('Dodge used.')).toBeVisible()
  })

  it('aims a basic action at the creature chosen for it', async () => {
    const user = userEvent.setup()
    const onResolve = vi.fn().mockResolvedValue(resolved)
    renderDrawer(onResolve, { choices: [], authoredBasicActions: basicActionChoices })

    const use = await screen.findByRole('button', { name: 'Use Help' })
    expect(use).toBeDisabled()
    await user.click(screen.getByRole('combobox', { name: 'Target of help' }))
    await user.click(await screen.findByRole('option', { name: 'Vault Warden' }))
    expect(use).toBeEnabled()
    await user.click(use)
    expect(onResolve).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: basicActionChoices[1].id,
        target: { kind: 'ACTOR', actorId: '99999999-9999-4999-8999-999999999902' }
      })
    )
  })

  it('leaves the acting creature out of the Target list when the action refuses itself', async () => {
    const user = userEvent.setup()
    const [staff] = actions
    const helping = validatedChoice({
      ...staff,
      id: 'equipment-staff:help',
      label: 'Lend aid',
      target: { kind: 'ACTOR', self: 'REFUSED' }
    })
    const actor = tabletopGmEncounter.actors.find(
      (candidate) => candidate.id === tabletopGmEncounter.currentActorId
    )!
    const other = tabletopGmEncounter.actors.find((candidate) => candidate.id !== actor.id)!
    renderDrawer(vi.fn(), { choices: [helping, staff!] })

    await user.click(await screen.findByRole('combobox', { name: 'Action' }))
    await user.click(await screen.findByRole('option', { name: /Lend aid/ }))
    await user.click(screen.getByRole('combobox', { name: 'Target' }))
    expect(await screen.findByRole('option', { name: other.label })).toBeVisible()
    expect(screen.queryByRole('option', { name: actor.label })).toBeNull()

    await user.click(await screen.findByRole('combobox', { name: 'Action' }))
    await user.click(await screen.findByRole('option', { name: /Quarterstaff/ }))
    await user.click(screen.getByRole('combobox', { name: 'Target' }))
    expect(await screen.findByRole('option', { name: actor.label })).toBeVisible()
  })

  it('asks for the creature First Aid stabilizes before it can be used', async () => {
    const user = userEvent.setup()
    const onResolve = vi.fn().mockResolvedValue(resolved)
    renderDrawer(onResolve, { choices: [], authoredBasicActions: basicActionChoices })

    const use = await screen.findByRole('button', { name: 'Use First Aid' })
    expect(use).toBeDisabled()
    await user.click(screen.getByRole('combobox', { name: 'Target of first aid' }))
    await user.click(await screen.findByRole('option', { name: 'Vault Warden' }))
    expect(use).toBeEnabled()
  })

  it('offers no target to an action that only affects its user', async () => {
    renderDrawer(vi.fn(), { choices: [], authoredBasicActions: basicActionChoices })

    expect(await screen.findByRole('button', { name: 'Use Dash' })).toBeEnabled()
    expect(screen.queryByRole('combobox', { name: 'Target of dash' })).not.toBeInTheDocument()
  })

  it('lists the user among the creatures for an action that only warns about aiming at it', async () => {
    const user = userEvent.setup()
    const onResolve = vi.fn().mockResolvedValue(resolved)
    const warnsAboutSelf = validatedChoice({
      ...actions[0]!,
      id: 'warns-action',
      label: 'Steady',
      rulesText: 'You steady a creature.',
      target: { kind: 'ACTOR', self: 'WARN' }
    })
    renderDrawer(onResolve, { choices: [], authoredBasicActions: [warnsAboutSelf] })

    const use = await screen.findByRole('button', { name: 'Use Steady' })
    expect(use).toBeDisabled()
    await user.click(screen.getByRole('combobox', { name: 'Target of steady' }))
    await user.click(await screen.findByRole('option', { name: "Ember's Wake" }))
    expect(use).toBeEnabled()
    await user.click(use)
    expect(onResolve).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: 'warns-action',
        target: { kind: 'ACTOR', actorId: tabletopGmEncounter.currentActorId }
      })
    )
  })

  it('leaves the user out of the creatures for an action that refuses aiming at it', async () => {
    const user = userEvent.setup()
    renderDrawer(vi.fn(), { choices: [], authoredBasicActions: basicActionChoices })

    await user.click(await screen.findByRole('combobox', { name: 'Target of help' }))
    expect(await screen.findByRole('option', { name: 'Vault Warden' })).toBeVisible()
    expect(screen.queryByRole('option', { name: "Ember's Wake" })).not.toBeInTheDocument()
  })

  it('resends a basic action with its warnings acknowledged on "Do it anyway"', async () => {
    const user = userEvent.setup()
    const onResolve = vi
      .fn<(command: ResolveEncounterActionInputDto) => Promise<unknown>>()
      .mockImplementationOnce(async (command) => {
        throw new LiveSessionCommandRejectedError({
          code: 'DOMAIN_REJECTED',
          commandId: command.commandId,
          currentSequence: 3,
          message: 'This action breaks a rule. Do it anyway?',
          reason: 'RULE_WARNINGS',
          warnings: warnings.slice(0, 1)
        })
      })
      .mockResolvedValue(resolved)
    renderDrawer(onResolve, { choices: [], authoredBasicActions: basicActionChoices })

    await user.click(await screen.findByRole('button', { name: 'Use Dash' }))
    await user.click(await screen.findByRole('button', { name: 'Do it anyway' }))
    expect(onResolve).toHaveBeenLastCalledWith(
      expect.objectContaining({ acknowledgedWarnings: ['ACTION_ECONOMY_UNAVAILABLE'] })
    )
  })
})

const escapeChoices = validated(encounterActionChoicesDtoSchema.shape.escapes)([
  {
    activeEffectId: '00000000-0000-4000-8000-000000000e01',
    label: 'Escape from Giant Toad',
    dc: 13,
    actionCost: 'ACTION',
    checks: [
      {
        checkDefinitionId: '00000000-0000-4000-8000-000000000e11',
        label: 'Dexterity (Acrobatics)'
      },
      { checkDefinitionId: '00000000-0000-4000-8000-000000000e12', label: 'Strength (Athletics)' }
    ],
    warnings: []
  }
])

const heldGrantEndChoices = validated(encounterActionChoicesDtoSchema.shape.heldGrantEnds)([
  {
    activeEffectId: '00000000-0000-4000-8000-000000000f01',
    label: 'End Rage',
    actionCost: 'BONUS_ACTION',
    warnings: []
  }
])

describe('CampaignTabletopActionDrawer held grant ends', () => {
  it('offers each effect the actor may end with its cost, and sends the end command', async () => {
    const user = userEvent.setup()
    const onEndHeldGrant = vi.fn().mockResolvedValue(resolved)
    renderDrawer(vi.fn(), { heldGrantEnds: heldGrantEndChoices, onEndHeldGrant })

    const section = await screen.findByRole('region', { name: 'Active effects' })
    expect(within(section).getByText('End Rage')).toBeVisible()
    expect(within(section).getByText(/Bonus action/i)).toBeVisible()

    await user.click(within(section).getByRole('button', { name: 'End Rage' }))
    expect(onEndHeldGrant).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: 'END_HELD_GRANT',
        encounterId: tabletopGmEncounter.id,
        expectedVersion: tabletopGmEncounter.version,
        actorId: tabletopGmEncounter.currentActorId,
        activeEffectId: heldGrantEndChoices[0].activeEffectId,
        acknowledgedWarnings: []
      })
    )
    expect(await screen.findByText('Effect ended.')).toBeVisible()
  })

  it('shows no section when the actor holds nothing it may end', async () => {
    renderDrawer(vi.fn())

    await screen.findByRole('button', { name: 'Resolve action' })
    expect(screen.queryByRole('region', { name: 'Active effects' })).not.toBeInTheDocument()
  })
})

describe('CampaignTabletopActionDrawer escapes', () => {
  it('offers the escape with its DC and cost in its own section', async () => {
    renderDrawer(vi.fn(), { escapes: escapeChoices })

    const section = await screen.findByRole('region', { name: 'Escape' })
    expect(within(section).getByText('Escape from Giant Toad')).toBeVisible()
    expect(within(section).getByText(/DC 13/)).toBeVisible()
    expect(within(section).getByText(/Action/)).toBeVisible()
  })

  it('sends the first allowed check unless another is chosen', async () => {
    const user = userEvent.setup()
    const onEscape = vi.fn().mockResolvedValue(resolved)
    renderDrawer(vi.fn(), { escapes: escapeChoices, onEscape })

    await user.click(await screen.findByRole('button', { name: 'Escape from Giant Toad' }))
    expect(onEscape).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: 'ESCAPE_RELATIONSHIP',
        encounterId: tabletopGmEncounter.id,
        expectedVersion: tabletopGmEncounter.version,
        actorId: tabletopGmEncounter.currentActorId,
        activeEffectId: escapeChoices[0].activeEffectId,
        checkDefinitionId: escapeChoices[0].checks[0].checkDefinitionId,
        acknowledgedWarnings: []
      })
    )
    expect(await screen.findByText('Escape attempted.')).toBeVisible()

    await user.click(screen.getByRole('combobox', { name: 'Check for escape from giant toad' }))
    await user.click(await screen.findByRole('option', { name: 'Strength (Athletics)' }))
    await user.click(screen.getByRole('button', { name: 'Escape from Giant Toad' }))
    expect(onEscape).toHaveBeenLastCalledWith(
      expect.objectContaining({ checkDefinitionId: escapeChoices[0].checks[1].checkDefinitionId })
    )
  })

  it('asks for no check when the effect allows only one', async () => {
    renderDrawer(vi.fn(), {
      escapes: [{ ...escapeChoices[0], checks: [escapeChoices[0].checks[1]] }]
    })

    await screen.findByRole('button', { name: 'Escape from Giant Toad' })
    expect(screen.queryByRole('combobox', { name: /Check for/ })).not.toBeInTheDocument()
  })

  it('says a roll is awaited when the escape waits on the d20, and not when it settled', async () => {
    const user = userEvent.setup()
    const awaitingRoll: EncounterCommandResultDto = {
      ...resolved,
      occurrence: {
        occurrenceId: '00000000-0000-4000-8000-000000000e21',
        occurrenceVersion: 1,
        status: 'PENDING',
        pending: {
          kind: 'D20_EVIDENCE',
          occurrenceId: '00000000-0000-4000-8000-000000000e21',
          occurrenceVersion: 1,
          encounterVersion: tabletopGmEncounter.version,
          rollerActorId: null,
          request: {
            requestId: 'escape-roll',
            min: 1,
            max: 20,
            rollMode: 'NORMAL',
            derivedRollModeReasons: []
          },
          allowedResponses: ['ENTER_DICE', 'SYSTEM_ROLL']
        }
      }
    }
    const waiting = renderDrawer(vi.fn(), { escapes: escapeChoices, escapeResult: awaitingRoll })
    await user.click(await screen.findByRole('button', { name: 'Escape from Giant Toad' }))
    expect(
      await screen.findByText('Escape started. Roll the d20 to see if it works.')
    ).toBeVisible()
    waiting.unmount()

    renderDrawer(vi.fn(), { escapes: escapeChoices })
    await user.click(await screen.findByRole('button', { name: 'Escape from Giant Toad' }))
    expect(await screen.findByText('Escape attempted.')).toBeVisible()
    expect(screen.queryByText(/Roll the d20/)).not.toBeInTheDocument()
  })

  it('starts the check and the outcome afresh when a different effect holds the actor', async () => {
    const user = userEvent.setup()
    const onEscape = vi.fn().mockResolvedValue(resolved)
    const view = renderDrawer(vi.fn(), { escapes: escapeChoices, onEscape })

    await user.click(
      await screen.findByRole('combobox', { name: 'Check for escape from giant toad' })
    )
    await user.click(await screen.findByRole('option', { name: 'Strength (Athletics)' }))
    await user.click(screen.getByRole('button', { name: 'Escape from Giant Toad' }))
    expect(await screen.findByText('Escape attempted.')).toBeVisible()
    expect(screen.getByRole('combobox', { name: /Check for/ })).toHaveValue('Strength (Athletics)')

    view.rerender(
      drawerElement(vi.fn(), {
        escapes: [{ ...escapeChoices[0], activeEffectId: '00000000-0000-4000-8000-000000000e02' }],
        onEscape
      })
    )
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: /Check for/ })).toHaveValue(
        'Dexterity (Acrobatics)'
      )
    )
    expect(screen.queryByText('Escape attempted.')).not.toBeInTheDocument()
  })

  it('resends the escape with its warnings acknowledged on "Do it anyway"', async () => {
    const user = userEvent.setup()
    const onEscape = vi
      .fn<(command: EscapeRelationshipInputDto) => Promise<unknown>>()
      .mockImplementationOnce(async (command) => {
        throw new LiveSessionCommandRejectedError({
          code: 'DOMAIN_REJECTED',
          commandId: command.commandId,
          currentSequence: 3,
          message: 'This action breaks a rule. Do it anyway?',
          reason: 'RULE_WARNINGS',
          warnings: warnings.slice(0, 1)
        })
      })
      .mockResolvedValue(resolved)
    renderDrawer(vi.fn(), { escapes: escapeChoices, onEscape })

    await user.click(await screen.findByRole('button', { name: 'Escape from Giant Toad' }))
    expect(await screen.findByText('No action left this turn.')).toBeVisible()
    await user.click(await screen.findByRole('button', { name: 'Do it anyway' }))
    expect(onEscape).toHaveBeenLastCalledWith(
      expect.objectContaining({ acknowledgedWarnings: ['ACTION_ECONOMY_UNAVAILABLE'] })
    )
  })
})

const target = tabletopGmEncounter.actors[1]!
// The closed option list stays mounted, so the selected action's own label is the one outside it.
const selectedSlotLabel = (text: string) => {
  const outsideOptions = screen
    .getAllByText(text)
    .filter((node) => !node.closest('[role="listbox"]'))
  expect(outsideOptions).toHaveLength(1)
  return outsideOptions[0]!
}
const slotted = (number: number, total = 2): EncounterActionChoiceDto => ({
  ...actions[0]!,
  attackSlot: { number, total }
})
const openAction = (made: number): EncounterActionChoicesDto['openAttackAction'] => ({
  made,
  total: 2,
  lastActionId: actions[0]!.id,
  lastTargetIds: [target.id]
})

describe('CampaignTabletopActionDrawer attack slots (D93)', () => {
  it('labels the attack an action would make in the list and for the selected action', async () => {
    const user = userEvent.setup()
    renderDrawer(vi.fn(), { choices: [slotted(1)] })

    await user.click(await screen.findByRole('combobox', { name: 'Action' }))
    expect(await screen.findByRole('option', { name: /Attack 1 of 2/ })).toBeVisible()
    await user.keyboard('{ArrowDown}{Enter}')
    expect(selectedSlotLabel('Attack 1 of 2')).toBeVisible()
  })

  it('preselects the last weapon and target of the open Attack action without submitting', async () => {
    const user = userEvent.setup()
    const onResolve = vi.fn<(command: ResolveEncounterActionInputDto) => Promise<unknown>>()
    renderDrawer(onResolve, { choices: [slotted(2)], openAttackAction: openAction(1) })

    expect(await screen.findByRole('combobox', { name: 'Action' })).toHaveValue(
      'Quarterstaff · Equipment'
    )
    expect(screen.getByRole('combobox', { name: 'Target' })).toHaveValue(target.label)
    expect(selectedSlotLabel('Attack 2 of 2')).toBeVisible()
    expect(onResolve).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Resolve action' }))
    expect(onResolve).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: actions[0]!.id,
        target: { kind: 'ACTOR', actorId: target.id }
      })
    )
  })

  it('keeps the weapon and target for the next attack once the first resolves', async () => {
    const user = userEvent.setup()
    const onResolve = vi.fn<(command: ResolveEncounterActionInputDto) => Promise<unknown>>()
    const view = renderDrawer(onResolve, { choices: [slotted(1)] })
    await chooseActionAndTarget(user)
    expect(onResolve).toHaveBeenCalledTimes(1)

    view.rerender(
      drawerElement(onResolve, {
        choices: [slotted(2)],
        openAttackAction: openAction(1),
        encounter: { ...tabletopGmEncounter, version: tabletopGmEncounter.version + 1 }
      })
    )
    await waitFor(() => expect(selectedSlotLabel('Attack 2 of 2')).toBeVisible())
    await user.click(screen.getByRole('button', { name: 'Resolve action' }))
    expect(onResolve).toHaveBeenCalledTimes(2)
    expect(onResolve.mock.calls[1]![0]).toMatchObject({
      actionId: onResolve.mock.calls[0]![0].actionId,
      target: onResolve.mock.calls[0]![0].target
    })
  })

  it('does not preselect a weapon or target that is no longer a valid choice', async () => {
    const stale = openAction(1)!
    const defeatedTarget = {
      ...tabletopGmEncounter,
      actors: tabletopGmEncounter.actors.map((actor) =>
        actor.id === target.id ? { ...actor, defeated: true } : actor
      )
    }

    const missing = renderDrawer(vi.fn(), {
      choices: [slotted(2)],
      openAttackAction: { ...stale, lastActionId: 'gone:attack', lastTargetIds: ['gone-target'] }
    })
    expect(await screen.findByRole('combobox', { name: 'Action' })).toHaveValue('')
    expect(screen.getByRole('combobox', { name: 'Target' })).toHaveValue('')
    missing.unmount()

    const defeated = renderDrawer(vi.fn(), {
      choices: [slotted(2)],
      openAttackAction: stale,
      encounter: defeatedTarget
    })
    expect(await screen.findByRole('combobox', { name: 'Target' })).toHaveValue('')
    defeated.unmount()

    renderDrawer(vi.fn(), { choices: [actions[0]!], openAttackAction: stale })
    expect(await screen.findByRole('combobox', { name: 'Action' })).toHaveValue('')
  })

  it('still warns about an attack outside the action and offers "Do it anyway"', async () => {
    const user = userEvent.setup()
    const outside = { ...actions[0]!, warnings: [warnings[0]!] }
    const onResolve = vi
      .fn<(command: ResolveEncounterActionInputDto) => Promise<unknown>>()
      .mockImplementationOnce(async (command) => {
        throw new LiveSessionCommandRejectedError({
          code: 'DOMAIN_REJECTED',
          commandId: command.commandId,
          currentSequence: 3,
          message: 'This action breaks a rule. Do it anyway?',
          reason: 'RULE_WARNINGS',
          warnings: [warnings[0]!]
        })
      })
      .mockResolvedValue(resolved)
    renderDrawer(onResolve, { choices: [outside], openAttackAction: openAction(2) })

    await user.click(await screen.findByRole('combobox', { name: 'Action' }))
    expect(await screen.findByText('No action left this turn.')).toBeVisible()
    expect(screen.queryByText(/Attack \d of \d/)).not.toBeInTheDocument()
    await user.keyboard('{ArrowDown}{Enter}')
    await user.click(screen.getByRole('combobox', { name: 'Target' }))
    await user.keyboard('{ArrowDown}{Enter}')
    await user.click(screen.getByRole('button', { name: 'Resolve action' }))
    await user.click(await screen.findByRole('button', { name: 'Do it anyway' }))
    expect(onResolve).toHaveBeenLastCalledWith(
      expect.objectContaining({ acknowledgedWarnings: ['ACTION_ECONOMY_UNAVAILABLE'] })
    )
  })
})

describe('CampaignTabletopActionDrawer area origin (D103)', () => {
  const fireballArea = {
    kind: 'RADIUS' as const,
    radius: { amount: 20, unit: 'FEET' as const }
  }
  const fireball = validatedChoice({
    ...actions[0]!,
    id: 'spell-fireball:cast',
    label: 'Fireball',
    sourceLabel: 'Spell',
    rangeLabel: '150 ft',
    attackBonus: undefined,
    target: { kind: 'POINT' as const, area: fireballArea }
  })
  const ember = tabletopLiveScene.tokens[0]!

  async function chooseFireball(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole('combobox', { name: 'Action' }))
    await user.keyboard('{ArrowDown}{Enter}')
  }

  it('asks for an origin instead of a target, then sends the point with the Scene it was picked on', async () => {
    const user = userEvent.setup()
    const onResolve = vi.fn<(command: ResolveEncounterActionInputDto) => Promise<unknown>>()
    const onAreaAimChange = vi.fn()
    const onAreaSizeChange = vi.fn()
    const onPickAreaOrigin = vi.fn()
    const options = {
      choices: [fireball],
      onAreaAimChange,
      onAreaSizeChange,
      onPickAreaOrigin
    }
    const view = renderDrawer(onResolve, options)

    await chooseFireball(user)
    expect(screen.queryByRole('combobox', { name: 'Target' })).not.toBeInTheDocument()
    expect(screen.getByText('Area origin')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Resolve action' })).toBeDisabled()
    expect(onAreaSizeChange).toHaveBeenLastCalledWith(
      pointAreaInSceneCoordinates(fireballArea, tabletopLiveScene.grid)
    )

    await user.click(screen.getByRole('button', { name: 'Pick on map' }))
    expect(onPickAreaOrigin).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('combobox', { name: 'Center on token' }))
    await user.click(screen.getByRole('option', { name: ember.label }))
    expect(onAreaAimChange).toHaveBeenLastCalledWith({ origin: ember.position, toward: null })

    view.rerender(
      drawerElement(onResolve, { ...options, areaAim: { origin: ember.position, toward: null } })
    )
    expect(await screen.findByText(`In the area: ${ember.label}`)).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Resolve action' }))
    expect(onResolve).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: fireball.id,
        sceneContext: null,
        target: {
          kind: 'POINT',
          sceneId: tabletopLiveScene.id,
          expectedSceneVersion: tabletopLiveScene.version,
          point: ember.position
        }
      })
    )
    expect(onAreaAimChange).toHaveBeenLastCalledWith(null)
  })

  it('shows an out-of-range rejection and resends the same point acknowledged', async () => {
    const user = userEvent.setup()
    const onResolve = vi
      .fn<(command: ResolveEncounterActionInputDto) => Promise<unknown>>()
      .mockImplementationOnce(async (command) => {
        throw new LiveSessionCommandRejectedError({
          code: 'DOMAIN_REJECTED',
          commandId: command.commandId,
          currentSequence: 3,
          message: 'This action breaks a rule. Do it anyway?',
          reason: 'RULE_WARNINGS',
          warnings: [warnings[1]!]
        })
      })
      .mockResolvedValue(resolved)
    const options = {
      choices: [fireball],
      areaAim: { origin: ember.position, toward: null }
    }
    const view = renderDrawer(onResolve, options)

    await chooseFireball(user)
    await user.click(screen.getByRole('button', { name: 'Resolve action' }))
    const confirmation = await screen.findByRole('alert')
    expect(within(confirmation).getByText('The target is out of range.')).toBeVisible()

    await user.click(within(confirmation).getByRole('button', { name: 'Do it anyway' }))
    expect(onResolve).toHaveBeenCalledTimes(2)
    expect(onResolve.mock.calls[1]![0]).toMatchObject({
      target: onResolve.mock.calls[0]![0].target,
      acknowledgedWarnings: ['TARGET_OUT_OF_RANGE']
    })

    onResolve.mockImplementationOnce(async (command) => {
      throw new LiveSessionCommandRejectedError({
        code: 'DOMAIN_REJECTED',
        commandId: command.commandId,
        currentSequence: 4,
        message: 'This action breaks a rule. Do it anyway?',
        reason: 'RULE_WARNINGS',
        warnings: [warnings[1]!]
      })
    })
    await user.click(screen.getByRole('button', { name: 'Resolve action' }))
    await screen.findByRole('alert')
    view.rerender(
      drawerElement(onResolve, {
        ...options,
        areaAim: { origin: { x: 700, y: 500 }, toward: null }
      })
    )
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })

  it('cannot resolve without a current Scene', async () => {
    const user = userEvent.setup()
    renderDrawer(vi.fn(), { choices: [fireball], scene: null })

    await chooseFireball(user)
    expect(screen.getByText(/no Scene/i)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Resolve action' })).toBeDisabled()
  })
})

describe('CampaignTabletopActionDrawer directed area (SPELLS-13)', () => {
  const [emberToken, wardenToken] = tabletopLiveScene.tokens as [
    (typeof tabletopLiveScene.tokens)[number],
    (typeof tabletopLiveScene.tokens)[number]
  ]
  const [emberActor, wardenActor] = tabletopGmEncounter.actors
  const actorIdByTokenId = new Map([
    [emberToken.id, emberActor.id],
    [wardenToken.id, wardenActor.id]
  ])
  /** The Warden stands one square east of Ember, in the way of a cone aimed east. */
  const sceneWithWardenBesideEmber = {
    ...tabletopLiveScene,
    tokens: [emberToken, { ...wardenToken, position: { x: 370, y: 230 } }]
  }
  const breathArea = { kind: 'CONE' as const, length: { amount: 15, unit: 'FEET' as const } }
  const breath = validatedChoice({
    ...actions[0]!,
    id: 'creature-dragon:breath',
    label: 'Breath',
    sourceLabel: 'Creature',
    rangeLabel: 'Self',
    attackBonus: undefined,
    range: { kind: 'SELF' as const },
    target: { kind: 'DIRECTED' as const, area: breathArea }
  })
  /** On Ember's east edge, aimed east. */
  const origin = { x: emberToken.position.x + 35, y: emberToken.position.y }
  const toward = { x: origin.x + 400, y: origin.y }

  async function chooseBreath(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole('combobox', { name: 'Action' }))
    await user.keyboard('{ArrowDown}{Enter}')
  }

  it('asks to be aimed instead of for a target, reporting the cone’s size before it has a direction', async () => {
    const user = userEvent.setup()
    const onPickAreaOrigin = vi.fn()
    const onAreaSizeChange = vi.fn()
    renderDrawer(vi.fn(), {
      choices: [breath],
      actorIdByTokenId,
      onAreaSizeChange,
      onPickAreaOrigin
    })

    await chooseBreath(user)
    expect(screen.queryByRole('combobox', { name: 'Target' })).not.toBeInTheDocument()
    expect(screen.getByText('Area direction')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Resolve action' })).toBeDisabled()
    expect(onAreaSizeChange).toHaveBeenLastCalledWith(
      directedAreaSizeInSceneCoordinates(breathArea, tabletopLiveScene.grid)
    )

    await user.click(screen.getByRole('button', { name: 'Aim on map' }))
    expect(onPickAreaOrigin).toHaveBeenCalledTimes(1)
  })

  it('sends the origin and direction with the Scene they were aimed on, and names who is in the cone', async () => {
    const user = userEvent.setup()
    const onResolve = vi.fn<(command: ResolveEncounterActionInputDto) => Promise<unknown>>()
    const onAreaAimChange = vi.fn()
    const options = {
      choices: [breath],
      scene: sceneWithWardenBesideEmber,
      actorIdByTokenId,
      onAreaAimChange
    }
    const view = renderDrawer(onResolve, options)
    await chooseBreath(user)

    view.rerender(drawerElement(onResolve, { ...options, areaAim: { origin, toward } }))
    expect(await screen.findByText(`In the area: ${wardenToken.label}`)).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Resolve action' }))
    expect(onResolve).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: breath.id,
        sceneContext: null,
        target: {
          kind: 'DIRECTED',
          sceneId: tabletopLiveScene.id,
          expectedSceneVersion: tabletopLiveScene.version,
          origin,
          toward
        }
      })
    )
    expect(onAreaAimChange).toHaveBeenLastCalledWith(null)
  })

  it('never lists the caster, even when the cone overlaps their own square', async () => {
    const user = userEvent.setup()
    // From the east edge near the bottom, aimed steeply down: the cone's near edge sweeps back over Ember.
    const slantedOrigin = { x: emberToken.position.x + 35, y: emberToken.position.y + 20 }
    const slantedToward = { x: slantedOrigin.x + 100, y: slantedOrigin.y + 400 }
    const scene = {
      ...tabletopLiveScene,
      tokens: [
        emberToken,
        {
          ...wardenToken,
          position: { x: emberToken.position.x + 70, y: emberToken.position.y + 150 }
        }
      ]
    }
    renderDrawer(vi.fn(), {
      choices: [breath],
      scene,
      actorIdByTokenId,
      areaAim: { origin: slantedOrigin, toward: slantedToward }
    })
    await chooseBreath(user)

    expect(await screen.findByText(`In the area: ${wardenToken.label}`)).toBeVisible()
  })

  it('asks for no aim when the area is centered on the caster, and sends only the Scene it was resolved on', async () => {
    const user = userEvent.setup()
    const onResolve = vi.fn<(command: ResolveEncounterActionInputDto) => Promise<unknown>>()
    const burst = validatedChoice({
      ...breath,
      id: 'creature-dragon:burst',
      label: 'Burst',
      target: {
        kind: 'CASTER_CENTERED' as const,
        area: { kind: 'RADIUS' as const, radius: { amount: 10, unit: 'FEET' as const } }
      }
    })
    renderDrawer(onResolve, { choices: [burst], actorIdByTokenId })
    await chooseBreath(user)

    expect(screen.queryByRole('combobox', { name: 'Target' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aim on map' })).not.toBeInTheDocument()
    expect(
      screen.getByText('Centered on you: creatures within 10 feet of your space are caught.')
    ).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Resolve action' }))
    expect(onResolve).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: burst.id,
        sceneContext: null,
        target: {
          kind: 'CASTER_CENTERED',
          sceneId: tabletopLiveScene.id,
          expectedSceneVersion: tabletopLiveScene.version
        }
      })
    )
  })

  it('clears the aim', async () => {
    const user = userEvent.setup()
    const onAreaAimChange = vi.fn()
    renderDrawer(vi.fn(), {
      choices: [breath],
      actorIdByTokenId,
      areaAim: { origin, toward },
      onAreaAimChange
    })
    await chooseBreath(user)

    await user.click(screen.getByRole('button', { name: 'Clear aim' }))
    expect(onAreaAimChange).toHaveBeenLastCalledWith(null)
  })

  it('cannot be drawn when the caster has no token on the Scene', async () => {
    const user = userEvent.setup()
    renderDrawer(vi.fn(), { choices: [breath], actorIdByTokenId: new Map() })

    await chooseBreath(user)
    expect(screen.getByText(/cannot be drawn/i)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Resolve action' })).toBeDisabled()
  })
})

describe('CampaignTabletopActionDrawer range and target preview (VTT_UI-3.1)', () => {
  const [emberToken, wardenToken] = tabletopLiveScene.tokens as [
    (typeof tabletopLiveScene.tokens)[number],
    (typeof tabletopLiveScene.tokens)[number]
  ]
  const [emberActor, wardenActor] = tabletopGmEncounter.actors
  const actorIdByTokenId = new Map([
    [emberToken.id, emberActor.id],
    [wardenToken.id, wardenActor.id]
  ])
  const longbow = validatedChoice({
    ...actions[0]!,
    id: 'equipment-longbow:attack',
    label: 'Longbow',
    rangeLabel: '150/600 ft',
    range: {
      kind: 'RANGED' as const,
      normal: { amount: 150, unit: 'FEET' as const },
      long: { amount: 600, unit: 'FEET' as const }
    }
  })
  const dodge = validatedChoice({
    ...actions[0]!,
    id: 'basic-dodge:use',
    label: 'Dodge',
    rangeLabel: 'Self',
    range: { kind: 'SELF' as const },
    target: { kind: 'SELF' as const }
  })

  async function chooseAction(user: ReturnType<typeof userEvent.setup>, name: string) {
    await user.click(await screen.findByRole('combobox', { name: 'Action' }))
    await user.click(screen.getByRole('option', { name: new RegExp(name) }))
  }

  it('previews the chosen action, then its target, around the acting token', async () => {
    const user = userEvent.setup()
    const onActionPreviewChange = vi.fn()
    renderDrawer(vi.fn(), { choices: [longbow], actorIdByTokenId, onActionPreviewChange })
    expect(onActionPreviewChange).toHaveBeenLastCalledWith(null)

    await chooseAction(user, 'Longbow')
    expect(onActionPreviewChange).toHaveBeenLastCalledWith({
      range: longbow.range,
      sourceTokenId: emberToken.id,
      targetTokenId: null
    })

    await user.click(screen.getByRole('combobox', { name: 'Target' }))
    await user.click(screen.getByRole('option', { name: wardenActor.label }))
    expect(onActionPreviewChange).toHaveBeenLastCalledWith({
      range: longbow.range,
      sourceTokenId: emberToken.id,
      targetTokenId: wardenToken.id
    })
  })

  it('previews an area action by its range alone, since its origin is drawn as the area', async () => {
    const user = userEvent.setup()
    const onActionPreviewChange = vi.fn()
    const spell = validatedChoice({
      ...longbow,
      id: 'spell-fireball:cast',
      label: 'Fireball',
      rangeLabel: '150 ft',
      range: { kind: 'WITHIN' as const, distance: { amount: 150, unit: 'FEET' as const } },
      target: {
        kind: 'POINT' as const,
        area: { kind: 'RADIUS' as const, radius: { amount: 20, unit: 'FEET' as const } }
      }
    })
    renderDrawer(vi.fn(), { choices: [spell], actorIdByTokenId, onActionPreviewChange })

    await chooseAction(user, 'Fireball')
    expect(onActionPreviewChange).toHaveBeenLastCalledWith({
      range: spell.range,
      sourceTokenId: emberToken.id,
      targetTokenId: null
    })
  })

  it('names no target token for an action that targets nobody', async () => {
    const user = userEvent.setup()
    const onActionPreviewChange = vi.fn()
    renderDrawer(vi.fn(), { choices: [dodge], actorIdByTokenId, onActionPreviewChange })

    await chooseAction(user, 'Dodge')
    await user.click(screen.getByRole('combobox', { name: 'Target' }))
    await user.click(screen.getByRole('option', { name: wardenActor.label }))
    expect(onActionPreviewChange).toHaveBeenLastCalledWith({
      range: dodge.range,
      sourceTokenId: emberToken.id,
      targetTokenId: null
    })
  })

  it('removes the preview when the choice is cleared or the drawer goes away', async () => {
    const user = userEvent.setup()
    const onActionPreviewChange = vi.fn()
    const view = renderDrawer(vi.fn(), {
      choices: [longbow],
      actorIdByTokenId,
      onActionPreviewChange
    })

    await chooseAction(user, 'Longbow')
    expect(onActionPreviewChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ range: longbow.range })
    )
    await chooseAction(user, 'Longbow')
    expect(onActionPreviewChange).toHaveBeenLastCalledWith(null)

    await chooseAction(user, 'Longbow')
    view.unmount()
    expect(onActionPreviewChange).toHaveBeenLastCalledWith(null)
  })
})
