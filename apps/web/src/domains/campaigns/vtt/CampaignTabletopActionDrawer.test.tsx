import { screen, waitFor, within } from '@testing-library/react'
import { useCallback, useRef, useState, type ComponentProps } from 'react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type {
  EncounterCommandResultDto,
  EncounterGmProjectionDto,
  EndHeldGrantInputDto,
  MoveHeldEffectInputDto,
  EscapeRelationshipInputDto,
  ReleaseRelationshipInputDto,
  ResolveEncounterActionInputDto
} from '@artificer-toolkit/schema/api/encounters'
import {
  encounterActionChoiceDtoSchema,
  encounterActionChoicesDtoSchema,
  encounterOptionalActionChoicesDtoSchema,
  type EncounterActionChoiceDto,
  type EncounterActionChoicesDto,
  type EncounterEscapeChoiceDto
} from '@artificer-toolkit/schema/api/encounterActionChoices'
import {
  authoredLengthInSceneCoordinates,
  directedAreaSizeInSceneCoordinates,
  pointAreaInSceneCoordinates,
  wallAreaBoundsInSceneCoordinates
} from '@artificer-toolkit/shared/vtt'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { offeredRollModes } from '../../../test/offeredRollModes'
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

const POLYMORPH_BEAST = { id: '00000000-0000-4000-8000-0000000000b1', label: 'Giant Centipede' }

vi.mock('#app/data/contentSnapshots/useContentCatalogue', () => ({
  useContentCatalogue: () => ({ items: [POLYMORPH_BEAST] })
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

/** The stage owns the picked target, so the drawer is rendered under a holder of it. */
function TargetedDrawer({
  onTargetPickSpy,
  ...props
}: Omit<
  ComponentProps<typeof CampaignTabletopActionDrawer>,
  'onPickTargetOnMap' | 'onTargetPick' | 'pickedTargetActorId'
> & { onTargetPickSpy?: (actorId: string | null | undefined) => void }) {
  const [pickedTargetActorId, setPickedTargetActorId] = useState<string | null | undefined>(
    undefined
  )
  // Stable, as the stage's own setter is: the drawer re-runs its reset effect on a new identity.
  const spy = useRef(onTargetPickSpy)
  spy.current = onTargetPickSpy
  const pickTarget = useCallback((actorId: string | null | undefined) => {
    spy.current?.(actorId)
    setPickedTargetActorId(actorId)
  }, [])
  return (
    <CampaignTabletopActionDrawer
      {...props}
      pickedTargetActorId={pickedTargetActorId}
      onPickTargetOnMap={vi.fn()}
      onTargetPick={pickTarget}
    />
  )
}

function drawerElement(
  onResolve: (command: ResolveEncounterActionInputDto) => Promise<unknown>,
  {
    choices = actions,
    unavailableActions = [],
    authoredBasicActions = [],
    escapes = [],
    heldGrantEnds = [],
    effectOffers = [],
    releases = [],
    openAttackAction = null,
    defaultActionId = null,
    encounter = tabletopGmEncounter,
    onEscape = vi.fn(),
    onEndHeldGrant = vi.fn(),
    onMoveHeldEffect = vi.fn(),
    onRelease = vi.fn(),
    escapeResult = resolved,
    isGm = false,
    waitingOn = null,
    scene = tabletopLiveScene,
    areaAim = null,
    onAreaAimChange = vi.fn(),
    onAreaSizeChange = vi.fn(),
    onActionPreviewChange = vi.fn(),
    actorIdByTokenId = new Map(),
    onPickAreaOrigin = vi.fn(),
    opened = true,
    optionalRules = [],
    onLoadOptionalChoices = vi.fn(),
    onTargetPickSpy
  }: {
    choices?: EncounterActionChoiceDto[]
    unavailableActions?: EncounterActionChoicesDto['unavailableActions']
    authoredBasicActions?: EncounterActionChoiceDto[]
    escapes?: EncounterEscapeChoiceDto[]
    heldGrantEnds?: EncounterActionChoicesDto['heldGrantEnds']
    effectOffers?: EncounterActionChoicesDto['effectOffers']
    releases?: EncounterActionChoicesDto['releases']
    openAttackAction?: EncounterActionChoicesDto['openAttackAction']
    defaultActionId?: EncounterActionChoicesDto['defaultActionId']
    encounter?: EncounterGmProjectionDto
    onEscape?: (command: EscapeRelationshipInputDto) => Promise<unknown>
    onEndHeldGrant?: (command: EndHeldGrantInputDto) => Promise<unknown>
    onMoveHeldEffect?: (command: MoveHeldEffectInputDto) => Promise<unknown>
    onRelease?: (command: ReleaseRelationshipInputDto) => Promise<unknown>
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
    opened?: boolean
    optionalRules?: EncounterActionChoicesDto['optionalRules']
    onLoadOptionalChoices?: ComponentProps<
      typeof CampaignTabletopActionDrawer
    >['onLoadOptionalChoices']
    onTargetPickSpy?: (actorId: string | null | undefined) => void
  } = {}
) {
  return (
    <TargetedDrawer
      actionChoicesError={null}
      actions={choices}
      basicActionChoices={authoredBasicActions}
      escapes={escapes}
      heldGrantEnds={heldGrantEnds}
      effectOffers={effectOffers}
      releases={releases}
      openAttackAction={openAttackAction}
      defaultActionId={defaultActionId}
      actionsLoading={false}
      actorIdByTokenId={actorIdByTokenId}
      connected
      encounter={encounter}
      isGm={isGm}
      opened={opened}
      optionalRules={optionalRules}
      onTargetPickSpy={onTargetPickSpy}
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
      onLoadOptionalChoices={onLoadOptionalChoices}
      onLoadItemChoices={vi.fn()}
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
      onMoveHeldEffect={async (command) => {
        await onMoveHeldEffect(command)
        return resolved
      }}
      onRelease={async (command) => {
        await onRelease(command)
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

  it('sends the option chosen for a basic action that offers several, the first preselected, measured on the Scene', async () => {
    const user = userEvent.setup()
    const onResolve = vi.fn().mockResolvedValue(resolved)
    const shove = validatedChoice({
      ...actions[0]!,
      id: 'shove-action',
      label: 'Shove',
      rulesText: 'You shove a creature.',
      target: {
        kind: 'ACTOR',
        self: 'REFUSED',
        choiceOptions: [
          { id: '99999999-9999-4999-8999-999999999911', label: 'Knock prone' },
          { id: '99999999-9999-4999-8999-999999999912', label: 'Shove 5 feet aside' }
        ]
      }
    })
    const [sourceToken, targetToken] = tabletopLiveScene.tokens
    renderDrawer(onResolve, {
      choices: [],
      authoredBasicActions: [shove],
      actorIdByTokenId: new Map([
        [sourceToken!.id, tabletopGmEncounter.currentActorId!],
        [targetToken!.id, '99999999-9999-4999-8999-999999999902']
      ])
    })

    const option = await screen.findByRole('combobox', { name: 'Option of shove' })
    expect(option).toHaveValue('Knock prone')
    await user.click(screen.getByRole('combobox', { name: 'Target of shove' }))
    await user.click(await screen.findByRole('option', { name: 'Vault Warden' }))
    await user.click(option)
    await user.click(await screen.findByRole('option', { name: 'Shove 5 feet aside' }))
    await user.click(screen.getByRole('button', { name: 'Use Shove' }))
    expect(onResolve).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: 'shove-action',
        target: {
          kind: 'ACTOR',
          actorId: '99999999-9999-4999-8999-999999999902',
          choiceOptionId: '99999999-9999-4999-8999-999999999912'
        },
        sceneContext: {
          sceneId: tabletopLiveScene.id,
          expectedSceneVersion: tabletopLiveScene.version,
          sourceTokenId: sourceToken!.id,
          targetTokenId: targetToken!.id
        }
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
    heldActorId: null,
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

const effectOfferChoices = validated(encounterActionChoicesDtoSchema.shape.effectOffers)([
  {
    effectId: '00000000-0000-4000-8000-000000000f21',
    offerIndex: 0,
    kind: 'MOVE_HELD_EFFECT',
    holderActorId: '99999999-9999-4999-8999-999999999902',
    activation: 'BONUS_ACTION',
    range: { amount: 90, unit: 'FEET' },
    warnings: []
  }
])

const repeatOfferChoices = validated(encounterActionChoicesDtoSchema.shape.effectOffers)([
  {
    effectId: '00000000-0000-4000-8000-000000000f22',
    offerIndex: 0,
    kind: 'REPEAT_SOURCE_PATH',
    holderActorId: '99999999-9999-4999-8999-999999999902',
    activation: 'BONUS_ACTION',
    actionId:
      '99999999-9999-4999-8999-999999999901:REPEAT_PATH:00000000-0000-4000-8000-000000000f22:0',
    label: 'Heat Metal',
    castLevel: 3,
    dc: 15,
    warnings: []
  }
])

describe('CampaignTabletopActionDrawer effect offers', () => {
  it('lists an offer with its cost and reach, then sends the pick of a new holder', async () => {
    const user = userEvent.setup()
    const onMoveHeldEffect = vi.fn().mockResolvedValue(resolved)
    renderDrawer(vi.fn(), { effectOffers: effectOfferChoices, onMoveHeldEffect })

    const section = await screen.findByRole('region', { name: 'Effect choices' })
    expect(within(section).getByText(/Move effect on Vault Warden/)).toBeVisible()
    expect(within(section).getByText(/Bonus action/i)).toBeVisible()
    expect(
      within(section).getByRole('button', { name: /Move effect on Vault Warden/ })
    ).toBeEnabled()

    await user.click(within(section).getByText('Choose target'))
    expect(within(section).getByRole('button', { name: 'Move' })).toBeDisabled()
    await user.click(within(section).getByRole('combobox', { name: 'New holder' }))
    await user.click(await screen.findByRole('option', { name: "Ember's Wake" }))
    await user.click(within(section).getByRole('button', { name: 'Move' }))

    expect(onMoveHeldEffect).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: 'MOVE_HELD_EFFECT',
        encounterId: tabletopGmEncounter.id,
        expectedVersion: tabletopGmEncounter.version,
        actorId: tabletopGmEncounter.currentActorId,
        effectId: effectOfferChoices[0].effectId,
        offerIndex: 0,
        target: { kind: 'ACTOR', actorId: '99999999-9999-4999-8999-999999999901' },
        acknowledgedWarnings: []
      })
    )
    expect(await screen.findByText('Effect moved.')).toBeVisible()
  })

  it('lists a repeat offer with its cast level and frozen DC, then resolves its action against the holder', async () => {
    const user = userEvent.setup()
    const onResolve = vi.fn<(command: ResolveEncounterActionInputDto) => Promise<unknown>>()
    renderDrawer(onResolve, { effectOffers: repeatOfferChoices })

    const section = await screen.findByRole('region', { name: 'Effect choices' })
    expect(within(section).getByText(/Repeat Heat Metal on Vault Warden/)).toBeVisible()
    expect(within(section).getByText(/Bonus Action · cast at level 3 · DC 15/i)).toBeVisible()

    await user.click(within(section).getByRole('button', { name: /Repeat Heat Metal on/ }))

    expect(onResolve).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: 'RESOLVE_ACTION',
        encounterId: tabletopGmEncounter.id,
        expectedVersion: tabletopGmEncounter.version,
        actorId: tabletopGmEncounter.currentActorId,
        actionId: repeatOfferChoices[0].actionId,
        target: { kind: 'ACTOR', actorId: repeatOfferChoices[0].holderActorId },
        acknowledgedWarnings: []
      })
    )
    expect(await screen.findByText('Repeated.')).toBeVisible()
  })

  it('measures a repeat on the Scene from the acting creature to the holder', async () => {
    const user = userEvent.setup()
    const onResolve = vi.fn<(command: ResolveEncounterActionInputDto) => Promise<unknown>>()
    const [sourceToken, targetToken] = tabletopLiveScene.tokens
    renderDrawer(onResolve, {
      effectOffers: repeatOfferChoices,
      actorIdByTokenId: new Map([
        [sourceToken!.id, tabletopGmEncounter.currentActorId!],
        [targetToken!.id, repeatOfferChoices[0].holderActorId]
      ])
    })

    const section = await screen.findByRole('region', { name: 'Effect choices' })
    await user.click(within(section).getByRole('button', { name: /Repeat Heat Metal on/ }))

    expect(onResolve).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sceneContext: {
          sceneId: tabletopLiveScene.id,
          expectedSceneVersion: tabletopLiveScene.version,
          sourceTokenId: sourceToken!.id,
          targetTokenId: targetToken!.id
        }
      })
    )
  })

  it('sends a delegated attack as the creature’s, commanded by the acting actor, measured from the creature', async () => {
    const user = userEvent.setup()
    const onResolve = vi.fn<(command: ResolveEncounterActionInputDto) => Promise<unknown>>()
    const [, delegate] = tabletopGmEncounter.actors
    const [casterToken, delegateToken] = tabletopLiveScene.tokens
    renderDrawer(onResolve, {
      choices: validatedChoices([
        {
          id: 'delegate-claws',
          delegateActorId: delegate!.id,
          label: 'Claws',
          sourceLabel: delegate!.label,
          rangeLabel: '5 ft',
          attackBonus: 4,
          grip: null,
          wieldConflict: null,
          warnings: [],
          target: { kind: 'ACTOR', self: 'REFUSED' },
          attackSlot: { number: 1, total: 1 }
        }
      ]),
      optionalRules: [{ definitionId: '99999999-9999-4999-8999-999999999921', label: 'Disarm' }],
      actorIdByTokenId: new Map([
        [casterToken!.id, tabletopGmEncounter.currentActorId!],
        [delegateToken!.id, delegate!.id]
      ])
    })

    await user.click(await screen.findByRole('combobox', { name: 'Action' }))
    expect(await screen.findByRole('option', { name: /Claws.*Vault Warden/ })).toBeVisible()
    await user.keyboard('{ArrowDown}{Enter}')
    await user.click(screen.getByRole('combobox', { name: 'Target' }))
    // The creature refuses itself, and the actor commanding it stays a target like any other.
    expect(await screen.findByRole('option', { name: /Ember/ })).toBeVisible()
    expect(screen.queryByRole('option', { name: /Vault Warden/ })).not.toBeInTheDocument()
    await user.keyboard('{ArrowDown}{Enter}')
    expect(screen.queryByRole('combobox', { name: 'Optional rule' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Resolve action' }))

    expect(onResolve).toHaveBeenLastCalledWith(
      expect.objectContaining({
        actorId: delegate!.id,
        delegatingActorId: tabletopGmEncounter.currentActorId,
        actionId: 'delegate-claws',
        target: { kind: 'ACTOR', actorId: tabletopGmEncounter.currentActorId },
        optionalCombatIntent: null,
        sceneContext: expect.objectContaining({ sourceTokenId: delegateToken!.id })
      })
    )
  })

  it('never offers the current holder as the new one', async () => {
    const user = userEvent.setup()
    renderDrawer(vi.fn(), { effectOffers: effectOfferChoices })

    const section = await screen.findByRole('region', { name: 'Effect choices' })
    await user.click(within(section).getByText('Choose target'))
    await user.click(within(section).getByRole('combobox', { name: 'New holder' }))
    expect(await screen.findByRole('option', { name: "Ember's Wake" })).toBeVisible()
    expect(screen.queryByRole('option', { name: 'Vault Warden' })).not.toBeInTheDocument()
  })

  it('shows no section when no effect offers the actor a choice', async () => {
    renderDrawer(vi.fn())

    await screen.findByRole('button', { name: 'Resolve action' })
    expect(screen.queryByRole('region', { name: 'Effect choices' })).not.toBeInTheDocument()
  })
})

const releaseChoices = validated(encounterActionChoicesDtoSchema.shape.releases)([
  {
    heldActorId: '00000000-0000-4000-8000-000000000f11',
    activeEffectId: '00000000-0000-4000-8000-000000000f12',
    label: 'Release Wolf'
  }
])

describe('CampaignTabletopActionDrawer releases (D152)', () => {
  it('offers each creature the actor holds for no action, and sends the release command', async () => {
    const user = userEvent.setup()
    const onRelease = vi.fn().mockResolvedValue(resolved)
    renderDrawer(vi.fn(), { releases: releaseChoices, onRelease })

    const section = await screen.findByRole('region', { name: 'Holding' })
    expect(within(section).getByText(/No action/)).toBeVisible()

    await user.click(within(section).getByRole('button', { name: 'Release Wolf' }))
    expect(onRelease).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: 'RELEASE_RELATIONSHIP',
        encounterId: tabletopGmEncounter.id,
        expectedVersion: tabletopGmEncounter.version,
        actorId: tabletopGmEncounter.currentActorId,
        heldActorId: releaseChoices[0].heldActorId,
        activeEffectId: releaseChoices[0].activeEffectId
      })
    )
    expect(await screen.findByText('Released.')).toBeVisible()
  })

  describe('freeing a hand for the attack (ATTACK-19.2)', () => {
    const secondHold = {
      heldActorId: '00000000-0000-4000-8000-000000000f21',
      activeEffectId: '00000000-0000-4000-8000-000000000f22',
      label: 'Release Boar'
    }
    const handRelease = (...holds: { heldActorId: string; activeEffectId: string }[]) =>
      validatedChoices([{ ...actions[0]!, handRelease: { holds } }])
    const wolf = {
      heldActorId: releaseChoices[0].heldActorId,
      activeEffectId: releaseChoices[0].activeEffectId
    }

    it('preselects the only hold, releases it for free, then sends the attack', async () => {
      const user = userEvent.setup()
      const onRelease = vi.fn().mockResolvedValue(resolved)
      const onResolve = vi
        .fn<(command: ResolveEncounterActionInputDto) => Promise<unknown>>()
        .mockResolvedValue(resolved)
      renderDrawer(onResolve, {
        choices: handRelease(wolf),
        releases: releaseChoices,
        onRelease
      })

      await chooseActionAndTarget(user)
      expect(onResolve).not.toHaveBeenCalled()
      expect(screen.getByRole('radio', { name: 'Release Wolf' })).toBeChecked()
      await user.click(screen.getByRole('button', { name: 'Release and attack' }))

      await waitFor(() => expect(onResolve).toHaveBeenCalledTimes(1))
      expect(onRelease).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'RELEASE_RELATIONSHIP',
          heldActorId: wolf.heldActorId,
          activeEffectId: wolf.activeEffectId
        })
      )
      expect(onRelease.mock.invocationCallOrder[0]).toBeLessThan(
        onResolve.mock.invocationCallOrder[0]!
      )
      expect(onResolve).toHaveBeenCalledWith(
        expect.objectContaining({
          actionId: actions[0]!.id,
          expectedVersion: resolved.projection.version
        })
      )
    })

    it('asks which of several holds to release and sends nothing until one is chosen', async () => {
      const user = userEvent.setup()
      const onRelease = vi.fn().mockResolvedValue(resolved)
      const onResolve = vi
        .fn<(command: ResolveEncounterActionInputDto) => Promise<unknown>>()
        .mockResolvedValue(resolved)
      renderDrawer(onResolve, {
        choices: handRelease(wolf, {
          heldActorId: secondHold.heldActorId,
          activeEffectId: secondHold.activeEffectId
        }),
        releases: validated(encounterActionChoicesDtoSchema.shape.releases)([
          releaseChoices[0],
          secondHold
        ]),
        onRelease
      })

      await chooseActionAndTarget(user)
      expect(screen.getByRole('button', { name: 'Release and attack' })).toBeDisabled()
      await user.click(screen.getByRole('radio', { name: 'Release Boar' }))
      await user.click(screen.getByRole('button', { name: 'Release and attack' }))

      await waitFor(() => expect(onResolve).toHaveBeenCalledTimes(1))
      expect(onRelease).toHaveBeenCalledWith(
        expect.objectContaining({ activeEffectId: secondHold.activeEffectId })
      )
    })

    it('releases and attacks nothing on cancel', async () => {
      const user = userEvent.setup()
      const onRelease = vi.fn().mockResolvedValue(resolved)
      const onResolve = vi.fn().mockResolvedValue(resolved)
      renderDrawer(onResolve, { choices: handRelease(wolf), releases: releaseChoices, onRelease })

      await chooseActionAndTarget(user)
      await user.click(screen.getByRole('button', { name: 'Cancel' }))
      expect(onRelease).not.toHaveBeenCalled()
      expect(onResolve).not.toHaveBeenCalled()
    })
  })

  it('shows no section when the actor holds no creature', async () => {
    renderDrawer(vi.fn())
    await screen.findByRole('button', { name: 'Resolve action' })
    expect(screen.queryByRole('region', { name: 'Holding' })).not.toBeInTheDocument()
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

  it('names a contested escape, which its holder resists with no DC (D152)', async () => {
    renderDrawer(vi.fn(), { escapes: [{ ...escapeChoices[0], dc: null }] })

    const section = await screen.findByRole('region', { name: 'Escape' })
    expect(within(section).getByText(/Contested/)).toBeVisible()
    expect(within(section).queryByText(/DC/)).not.toBeInTheDocument()
  })

  it('sends the first allowed check unless another is chosen', async () => {
    const user = userEvent.setup()
    const onEscape = vi.fn().mockResolvedValue(resolved)
    renderDrawer(vi.fn(), { escapes: escapeChoices, onEscape })

    await user.click(await screen.findByRole('button', { name: 'Escape from Giant Toad' }))
    expect(onEscape).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: 'ESCAPE',
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

  it('names the held creature when freeing it, and sends it with the escape (ATTACK-7.9)', async () => {
    const user = userEvent.setup()
    const onEscape = vi.fn().mockResolvedValue(resolved)
    const heldActorId = '00000000-0000-4000-8000-000000000e31'
    renderDrawer(vi.fn(), {
      escapes: [{ ...escapeChoices[0], heldActorId, label: 'Free Ally' }],
      onEscape
    })

    await user.click(await screen.findByRole('button', { name: 'Free Ally' }))
    expect(onEscape).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: 'ESCAPE',
        actorId: tabletopGmEncounter.currentActorId,
        heldActorId,
        activeEffectId: escapeChoices[0].activeEffectId
      })
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
            keep: 'FIRST',
            rollModes: offeredRollModes,
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
  complete: made >= 2,
  lastActionId: actions[0]!.id,
  lastTargetIds: [target.id]
})

describe('CampaignTabletopActionDrawer activation', () => {
  it('names the activation a spell cast uses in its label', async () => {
    const user = userEvent.setup()
    renderDrawer(vi.fn(), {
      choices: [
        {
          ...actions[0]!,
          id: 'spell-cast:healing-word',
          label: 'Healing Word (1st level)',
          sourceLabel: 'Cleric',
          actionCost: 'BONUS_ACTION'
        }
      ]
    })

    await user.click(await screen.findByRole('combobox', { name: 'Action' }))
    await user.click(await screen.findByRole('option', { name: /Bonus Action/ }))
    expect(screen.getByRole('combobox', { name: 'Action' })).toHaveValue(
      'Healing Word (1st level) · Cleric · Bonus Action'
    )
  })
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
    renderDrawer(onResolve, {
      choices: [slotted(2)],
      openAttackAction: openAction(1),
      defaultActionId: actions[0]!.id
    })

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

  it('shows what is left of the open Attack action, and what is optional once it is complete', async () => {
    const open = renderDrawer(vi.fn(), {
      choices: [slotted(2)],
      openAttackAction: openAction(1),
      defaultActionId: actions[0]!.id
    })
    expect(await screen.findByText('Attack action: 1 of 2 made')).toBeVisible()
    expect(screen.getByText('Left: Quarterstaff')).toBeVisible()
    open.unmount()

    renderDrawer(vi.fn(), {
      choices: [slotted(3, 3)],
      openAttackAction: openAction(2),
      defaultActionId: actions[0]!.id
    })
    expect(await screen.findByText('Attack action: 2 of 2 made')).toBeVisible()
    expect(screen.getByText('Optional: Quarterstaff')).toBeVisible()
  })

  it('ends the panel and the preselection on "Done attacking" without submitting, and an attack reopens it', async () => {
    const user = userEvent.setup()
    const onResolve = vi.fn<(command: ResolveEncounterActionInputDto) => Promise<unknown>>()
    const view = renderDrawer(onResolve, {
      choices: [slotted(2)],
      openAttackAction: openAction(1),
      defaultActionId: actions[0]!.id
    })
    await user.click(await screen.findByRole('button', { name: 'Done attacking' }))

    expect(screen.queryByText('Attack action: 1 of 2 made')).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Action' })).toHaveValue('')
    expect(screen.getByRole('combobox', { name: 'Target' })).toHaveValue('')
    expect(onResolve).not.toHaveBeenCalled()

    view.rerender(
      drawerElement(onResolve, {
        choices: [slotted(2)],
        openAttackAction: { ...openAction(1)!, made: 2, complete: true },
        defaultActionId: actions[0]!.id
      })
    )
    expect(await screen.findByText('Attack action: 2 of 2 made')).toBeVisible()
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
        defaultActionId: actions[0]!.id,
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
      openAttackAction: { ...stale, lastActionId: 'gone:attack', lastTargetIds: ['gone-target'] },
      defaultActionId: 'gone:attack'
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

  it('starts on the held weapon the server picks before any Attack action is open (D107)', async () => {
    const onResolve = vi.fn<(command: ResolveEncounterActionInputDto) => Promise<unknown>>()
    renderDrawer(onResolve, { choices: actions, defaultActionId: actions[0]!.id })

    expect(await screen.findByRole('combobox', { name: 'Action' })).toHaveValue(
      'Quarterstaff · Equipment'
    )
    expect(screen.getByRole('combobox', { name: 'Target' })).toHaveValue('')
    expect(onResolve).not.toHaveBeenCalled()
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

describe('CampaignTabletopActionDrawer spell components (D171)', () => {
  const rite = validatedChoice({
    ...actions[0]!,
    id: 'spell-rite:cast',
    label: 'Rite',
    sourceLabel: 'Spell',
    attackBonus: undefined,
    componentsLabel: 'V, S, M (a pearl worth at least 100 gp)'
  })
  const bare = validatedChoice({
    ...rite,
    id: 'spell-bare:cast',
    label: 'Bare',
    componentsLabel: undefined
  })

  it('shows the components of the chosen cast and nothing for a cast that names none', async () => {
    const user = userEvent.setup()
    renderDrawer(vi.fn(), { choices: [rite, bare] })

    await user.click(await screen.findByRole('combobox', { name: 'Action' }))
    await user.keyboard('{ArrowDown}{Enter}')
    expect(
      await screen.findByText('Components: V, S, M (a pearl worth at least 100 gp)')
    ).toBeVisible()

    await user.click(screen.getByRole('combobox', { name: 'Action' }))
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}')
    expect(screen.queryByText(/Components:/)).not.toBeInTheDocument()
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

describe('CampaignTabletopActionDrawer wall or ring (SPELLS-4.T1b, D154)', () => {
  const STRAIGHT_ID = '00000000-0000-4000-8000-0000000d1541'
  const RING_ID = '00000000-0000-4000-8000-0000000d1542'
  const feet = (amount: number) => ({ amount, unit: 'FEET' as const })
  const wallOfFire = validatedChoice({
    ...actions[0]!,
    id: 'spell-wall-of-fire:cast',
    label: 'Wall of Fire',
    sourceLabel: 'Spell',
    rangeLabel: '120 ft',
    attackBonus: undefined,
    target: {
      kind: 'ZONE_OPTIONS' as const,
      options: [
        {
          id: STRAIGHT_ID,
          label: 'Straight Wall',
          target: { kind: 'WALL' as const, area: { maxLength: feet(60), thickness: feet(1) } }
        },
        {
          id: RING_ID,
          label: 'Ringed Wall',
          target: { kind: 'RING' as const, area: { maxOuterRadius: feet(10), thickness: feet(1) } }
        }
      ]
    }
  })
  const from = { x: 100, y: 100 }
  const to = { x: 500, y: 100 }

  async function chooseWall(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole('combobox', { name: 'Action' }))
    await user.keyboard('{ArrowDown}{Enter}')
  }

  it('draws the picked straight wall between its two ends and sends them with the option', async () => {
    const user = userEvent.setup()
    const onResolve = vi.fn<(command: ResolveEncounterActionInputDto) => Promise<unknown>>()
    const onAreaSizeChange = vi.fn()
    const options = { choices: [wallOfFire], onAreaSizeChange }
    const view = renderDrawer(onResolve, options)

    await chooseWall(user)
    expect(screen.getByText('Wall')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Draw on map' })).toBeVisible()
    expect(screen.queryByRole('combobox', { name: 'Target' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resolve action' })).toBeDisabled()
    expect(onAreaSizeChange).toHaveBeenLastCalledWith({
      kind: 'WALL',
      ...wallAreaBoundsInSceneCoordinates(
        { kind: 'WALL', maxLength: feet(60), thickness: feet(1) },
        tabletopLiveScene.grid
      )
    })

    view.rerender(drawerElement(onResolve, { ...options, areaAim: { origin: from, toward: to } }))
    await user.click(screen.getByRole('button', { name: 'Resolve action' }))
    expect(onResolve).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: wallOfFire.id,
        target: {
          kind: 'WALL',
          sceneId: tabletopLiveScene.id,
          expectedSceneVersion: tabletopLiveScene.version,
          from,
          to,
          choiceOptionId: STRAIGHT_ID
        }
      })
    )
  })

  it('draws a ring around its center out to the aim once the ring is picked', async () => {
    const user = userEvent.setup()
    const onResolve = vi.fn<(command: ResolveEncounterActionInputDto) => Promise<unknown>>()
    const onAreaSizeChange = vi.fn()
    const options = { choices: [wallOfFire], onAreaSizeChange }
    const view = renderDrawer(onResolve, options)

    await chooseWall(user)
    await user.click(screen.getByRole('combobox', { name: 'Option' }))
    await user.click(screen.getByRole('option', { name: 'Ringed Wall' }))
    expect(screen.getByText('Ring')).toBeVisible()
    expect(onAreaSizeChange).toHaveBeenLastCalledWith({
      kind: 'RING',
      ...wallAreaBoundsInSceneCoordinates(
        { kind: 'RING', maxOuterRadius: feet(10), thickness: feet(1) },
        tabletopLiveScene.grid
      )
    })

    view.rerender(
      drawerElement(onResolve, {
        ...options,
        areaAim: { origin: from, toward: { x: 100, y: 250 } }
      })
    )
    await user.click(screen.getByRole('button', { name: 'Resolve action' }))
    expect(onResolve).toHaveBeenCalledWith(
      expect.objectContaining({
        target: {
          kind: 'RING',
          sceneId: tabletopLiveScene.id,
          expectedSceneVersion: tabletopLiveScene.version,
          center: from,
          outerRadius: 150,
          choiceOptionId: RING_ID
        }
      })
    )
  })

  it('asks for the side its band reaches after aiming, previews it and sends the side (D154 amendment)', async () => {
    const user = userEvent.setup()
    const onResolve = vi.fn<(command: ResolveEncounterActionInputDto) => Promise<unknown>>()
    const onAreaSizeChange = vi.fn()
    const banded = validatedChoice({
      ...wallOfFire,
      target: {
        kind: 'WALL' as const,
        area: { maxLength: feet(60), thickness: feet(1) },
        sideBand: { distance: feet(10) }
      }
    })
    const options = { choices: [banded], onAreaSizeChange }
    const view = renderDrawer(onResolve, options)

    await chooseWall(user)
    expect(screen.queryByRole('radio', { name: 'Left as drawn' })).not.toBeInTheDocument()
    view.rerender(drawerElement(onResolve, { ...options, areaAim: { origin: from, toward: to } }))
    expect(screen.getByText(/also reaches 10 feet on one side/)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Resolve action' })).toBeDisabled()

    await user.click(screen.getByRole('radio', { name: 'Right as drawn' }))
    expect(onAreaSizeChange).toHaveBeenLastCalledWith({
      kind: 'WALL',
      ...wallAreaBoundsInSceneCoordinates(
        { kind: 'WALL', maxLength: feet(60), thickness: feet(1) },
        tabletopLiveScene.grid
      ),
      band: {
        distance: authoredLengthInSceneCoordinates(feet(10), tabletopLiveScene.grid),
        side: 'RIGHT'
      }
    })
    await user.click(screen.getByRole('button', { name: 'Resolve action' }))
    expect(onResolve).toHaveBeenCalledWith(
      expect.objectContaining({
        target: {
          kind: 'WALL',
          sceneId: tabletopLiveScene.id,
          expectedSceneVersion: tabletopLiveScene.version,
          from,
          to,
          side: 'RIGHT'
        }
      })
    )
  })
})

describe('CampaignTabletopActionDrawer chosen creatures (SPELLS-8, D118)', () => {
  const [first, second] = tabletopGmEncounter.actors as [
    (typeof tabletopGmEncounter.actors)[number],
    (typeof tabletopGmEncounter.actors)[number]
  ]
  const healingWord = validatedChoice({
    ...actions[0]!,
    id: 'spell-mass-healing-word:cast',
    label: 'Mass Healing Word',
    sourceLabel: 'Spell',
    rangeLabel: '60 ft',
    attackBonus: undefined,
    target: { kind: 'ACTORS' as const, maxTargets: 2, area: null }
  })
  const cureWounds = validatedChoice({
    ...healingWord,
    id: 'spell-mass-cure-wounds:cast',
    label: 'Mass Cure Wounds',
    target: {
      kind: 'ACTORS' as const,
      maxTargets: 2,
      area: { kind: 'RADIUS' as const, radius: { amount: 30, unit: 'FEET' as const } }
    }
  })

  const passWithoutTrace = validatedChoice({
    ...healingWord,
    id: 'spell-pass-without-trace:cast',
    label: 'Pass without Trace',
    target: { kind: 'ACTORS' as const, area: null }
  })

  const magicMissile = validatedChoice({
    ...healingWord,
    id: 'spell-magic-missile:cast',
    label: 'Magic Missile',
    target: {
      kind: 'ACTORS' as const,
      maxTargets: 3,
      area: null,
      allowRepeatedTargets: true as const
    }
  })

  const giantInsect = validatedChoice({
    ...healingWord,
    id: 'spell-giant-insect:cast',
    label: 'Giant Insect',
    target: {
      kind: 'ACTORS' as const,
      maxTargets: 2,
      area: null,
      forms: [
        { id: '00000000-0000-4000-8000-0000000000f1', label: 'Centipedes', maxTargets: 2 },
        { id: '00000000-0000-4000-8000-0000000000f2', label: 'Scorpion', maxTargets: 1 }
      ]
    }
  })

  const polymorph = validatedChoice({
    ...healingWord,
    id: 'spell-polymorph:cast',
    label: 'Polymorph',
    target: {
      kind: 'ACTORS' as const,
      maxTargets: 1,
      area: null,
      choosesCreatureForm: true as const
    }
  })

  async function chooseTargets(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole('combobox', { name: 'Action' }))
    await user.keyboard('{ArrowDown}{Enter}')
    await user.click(screen.getByRole('combobox', { name: 'Targets (up to 2)' }))
    await user.click(screen.getByRole('option', { name: first.label }))
    await user.click(screen.getByRole('option', { name: second.label }))
  }

  it('asks for up to the authored number of creatures and sends them as one list', async () => {
    const user = userEvent.setup()
    const onResolve = vi.fn<(command: ResolveEncounterActionInputDto) => Promise<unknown>>()
    renderDrawer(onResolve, { choices: [healingWord] })

    await user.click(await screen.findByRole('combobox', { name: 'Action' }))
    await user.keyboard('{ArrowDown}{Enter}')
    expect(screen.queryByRole('combobox', { name: 'Target' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resolve action' })).toBeDisabled()

    await user.click(screen.getByRole('combobox', { name: 'Targets (up to 2)' }))
    await user.click(screen.getByRole('option', { name: first.label }))
    await user.click(screen.getByRole('option', { name: second.label }))
    await user.click(screen.getByRole('button', { name: 'Resolve action' }))
    expect(onResolve).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: healingWord.id,
        sceneContext: null,
        target: {
          kind: 'ACTORS',
          actorIds: [first.id, second.id],
          scene: {
            sceneId: tabletopLiveScene.id,
            expectedSceneVersion: tabletopLiveScene.version,
            point: null
          }
        }
      })
    )
  })

  it('forgets the creatures chosen for one action when another action is selected', async () => {
    const user = userEvent.setup()
    renderDrawer(vi.fn(), { choices: [healingWord, passWithoutTrace] })

    await chooseTargets(user)
    expect(screen.getByRole('button', { name: 'Resolve action' })).toBeEnabled()

    await user.click(screen.getByRole('combobox', { name: 'Action' }))
    await user.click(screen.getByRole('option', { name: /Pass without Trace/ }))
    expect(screen.getByRole('combobox', { name: 'Targets' })).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Resolve action' })).toBeDisabled()
  })

  it('shows no cap for a list that names each chosen creature once (SPELLS-4.T2a3)', async () => {
    const user = userEvent.setup()
    const onResolve = vi.fn<(command: ResolveEncounterActionInputDto) => Promise<unknown>>()
    renderDrawer(onResolve, { choices: [passWithoutTrace] })

    await user.click(await screen.findByRole('combobox', { name: 'Action' }))
    await user.keyboard('{ArrowDown}{Enter}')
    await user.click(screen.getByRole('combobox', { name: 'Targets' }))
    await user.click(screen.getByRole('option', { name: first.label }))
    await user.click(screen.getByRole('option', { name: second.label }))
    await user.click(screen.getByRole('button', { name: 'Resolve action' }))
    expect(onResolve).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: passWithoutTrace.id,
        target: expect.objectContaining({ kind: 'ACTORS', actorIds: [first.id, second.id] })
      })
    )
  })

  it('sends the chosen creature form, which caps the creatures it reaches (D130)', async () => {
    const user = userEvent.setup()
    const onResolve = vi.fn<(command: ResolveEncounterActionInputDto) => Promise<unknown>>()
    renderDrawer(onResolve, { choices: [giantInsect] })

    await chooseTargets(user)
    await user.click(screen.getByText('Scorpion'))
    expect(screen.getByRole('combobox', { name: 'Targets (up to 1)' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Resolve action' }))
    expect(onResolve).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: giantInsect.id,
        target: expect.objectContaining({
          kind: 'ACTORS',
          actorIds: [first.id],
          formId: '00000000-0000-4000-8000-0000000000f2'
        })
      })
    )
  })

  it('sends the Creature a filtered form turns the target into, and waits for one', async () => {
    const user = userEvent.setup()
    const onResolve = vi.fn<(command: ResolveEncounterActionInputDto) => Promise<unknown>>()
    renderDrawer(onResolve, { choices: [polymorph] })

    await user.click(await screen.findByRole('combobox', { name: 'Action' }))
    await user.keyboard('{ArrowDown}{Enter}')
    await user.click(screen.getByRole('combobox', { name: 'Targets (up to 1)' }))
    await user.click(screen.getByRole('option', { name: first.label }))
    expect(screen.getByRole('button', { name: 'Resolve action' })).toBeDisabled()

    await user.click(screen.getByRole('combobox', { name: 'Creature form' }))
    await user.click(screen.getByRole('option', { name: POLYMORPH_BEAST.label }))
    await user.click(screen.getByRole('button', { name: 'Resolve action' }))
    expect(onResolve).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: polymorph.id,
        target: expect.objectContaining({
          kind: 'ACTORS',
          actorIds: [first.id],
          creatureId: POLYMORPH_BEAST.id
        })
      })
    )
  })

  it('splits projectiles between creatures, one list entry per projectile, never past the cap', async () => {
    const user = userEvent.setup()
    const onResolve = vi.fn<(command: ResolveEncounterActionInputDto) => Promise<unknown>>()
    renderDrawer(onResolve, { choices: [magicMissile] })

    await user.click(await screen.findByRole('combobox', { name: 'Action' }))
    await user.keyboard('{ArrowDown}{Enter}')
    expect(screen.getByText('Projectiles (0 of 3)')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Resolve action' })).toBeDisabled()

    await user.type(screen.getByRole('textbox', { name: first.label }), '2')
    await user.type(screen.getByRole('textbox', { name: second.label }), '1')
    expect(screen.getByText('Projectiles (3 of 3)')).toBeVisible()
    await user.type(screen.getByRole('textbox', { name: first.label }), '9')
    expect(screen.getByText('Projectiles (3 of 3)')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Resolve action' }))
    expect(onResolve).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: magicMissile.id,
        target: expect.objectContaining({
          kind: 'ACTORS',
          actorIds: [first.id, first.id, second.id]
        })
      })
    )
  })

  it('also needs the area aimed before it resolves, and sends its point with the creatures', async () => {
    const user = userEvent.setup()
    const onResolve = vi.fn<(command: ResolveEncounterActionInputDto) => Promise<unknown>>()
    const onAreaSizeChange = vi.fn()
    const options = { choices: [cureWounds], onAreaSizeChange }
    const view = renderDrawer(onResolve, options)

    await chooseTargets(user)
    expect(screen.getByText('Area origin')).toBeVisible()
    expect(onAreaSizeChange).toHaveBeenLastCalledWith(
      pointAreaInSceneCoordinates(
        { kind: 'RADIUS', radius: { amount: 30, unit: 'FEET' } },
        tabletopLiveScene.grid
      )
    )
    expect(screen.getByRole('button', { name: 'Resolve action' })).toBeDisabled()

    const origin = tabletopLiveScene.tokens[0]!.position
    view.rerender(drawerElement(onResolve, { ...options, areaAim: { origin, toward: null } }))
    await user.click(screen.getByRole('button', { name: 'Resolve action' }))
    expect(onResolve).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: cureWounds.id,
        target: {
          kind: 'ACTORS',
          actorIds: [first.id, second.id],
          scene: {
            sceneId: tabletopLiveScene.id,
            expectedSceneVersion: tabletopLiveScene.version,
            point: origin
          }
        }
      })
    )
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
    id: 'creature-wolf:cone',
    label: 'Cone',
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
      id: 'creature-wolf:burst',
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

  it('asks for no aim when the area is the caster’s own space', async () => {
    const user = userEvent.setup()
    const onResolve = vi.fn<(command: ResolveEncounterActionInputDto) => Promise<unknown>>()
    const whirlwind = validatedChoice({
      ...breath,
      id: 'creature-wolf:whirlwind',
      label: 'Whirlwind',
      target: { kind: 'CASTER_CENTERED' as const, area: { kind: 'OWN_SPACE' as const } }
    })
    renderDrawer(onResolve, { choices: [whirlwind], actorIdByTokenId })
    await chooseBreath(user)

    expect(screen.queryByRole('combobox', { name: 'Target' })).not.toBeInTheDocument()
    expect(screen.getByText('Creatures sharing your space are caught.')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Resolve action' }))
    expect(onResolve).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: whirlwind.id,
        target: {
          kind: 'CASTER_CENTERED',
          sceneId: tabletopLiveScene.id,
          expectedSceneVersion: tabletopLiveScene.version
        }
      })
    )
  })

  it('lets the caster designate unaffected creatures for a zone that offers it, and sends them', async () => {
    const user = userEvent.setup()
    const onResolve = vi.fn<(command: ResolveEncounterActionInputDto) => Promise<unknown>>()
    const aura = validatedChoice({
      ...breath,
      id: 'creature-wolf:aura',
      label: 'Aura',
      target: {
        kind: 'CASTER_CENTERED' as const,
        area: { kind: 'RADIUS' as const, radius: { amount: 15, unit: 'FEET' as const } },
        choosesUnaffected: true as const
      }
    })
    const spared = tabletopGmEncounter.actors.find(
      (actor) => actor.id !== tabletopGmEncounter.currentActorId
    )
    if (!spared) throw new Error('The fixture needs a second creature.')
    renderDrawer(onResolve, { choices: [aura], actorIdByTokenId })
    await chooseBreath(user)

    await user.click(screen.getByRole('combobox', { name: 'Unaffected creatures' }))
    await user.click(screen.getByRole('option', { name: spared.label }))
    await user.click(screen.getByRole('button', { name: 'Resolve action' }))

    expect(onResolve).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.objectContaining({
          kind: 'CASTER_CENTERED',
          unaffectedActorIds: [spared.id]
        })
      })
    )
  })

  it('offers no designation for an area that does not place a zone with the choice', async () => {
    const user = userEvent.setup()
    const burst = validatedChoice({
      ...breath,
      id: 'creature-wolf:burst',
      label: 'Burst',
      target: {
        kind: 'CASTER_CENTERED' as const,
        area: { kind: 'RADIUS' as const, radius: { amount: 10, unit: 'FEET' as const } }
      }
    })
    renderDrawer(vi.fn(), { choices: [burst], actorIdByTokenId })
    await chooseBreath(user)

    expect(screen.queryByText('Unaffected creatures')).not.toBeInTheDocument()
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

const optionalRule = { definitionId: '00000000-0000-4000-8000-0000000000c1', label: 'Flanking' }
const optionalChoicesFor = validated(encounterOptionalActionChoicesDtoSchema)
const optionalChoicesNamed = (fieldLabel: string) =>
  optionalChoicesFor({
    definitionId: optionalRule.definitionId,
    optionId: 'a'.repeat(64),
    selectionContract: 'b'.repeat(64),
    label: optionalRule.label,
    fields: [
      {
        fieldId: 'c'.repeat(64),
        kind: 'ENTITY',
        label: fieldLabel,
        options: [{ id: '00000000-0000-4000-8000-0000000000d1', label: 'Ally' }]
      }
    ]
  })

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

type OptionalChoices = ReturnType<typeof optionalChoicesNamed>
type OptionalLoader = ComponentProps<typeof CampaignTabletopActionDrawer>['onLoadOptionalChoices']

describe('CampaignTabletopActionDrawer optional rule choices', () => {
  const resolveButton = () => screen.getByRole('button', { name: 'Resolve action' })
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

  async function pickActionTargetAndRule(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole('combobox', { name: 'Action' }))
    await user.keyboard('{ArrowDown}{Enter}')
    await user.click(screen.getByRole('combobox', { name: 'Target' }))
    await user.keyboard('{ArrowDown}{Enter}')
    await user.click(screen.getByRole('combobox', { name: 'Optional rule' }))
    await user.click(screen.getByRole('option', { name: optionalRule.label }))
  }

  const withLoader = (onLoadOptionalChoices: OptionalLoader, encounterVersion = 12) => ({
    optionalRules: [optionalRule],
    onLoadOptionalChoices,
    encounter: { ...tabletopGmEncounter, version: encounterVersion }
  })

  it('holds resolving while the choices load, then sends the selections once they are chosen', async () => {
    const user = userEvent.setup()
    const loading = deferred<OptionalChoices>()
    const onLoadOptionalChoices = vi.fn(() => loading.promise)
    const onResolve = vi.fn<(command: ResolveEncounterActionInputDto) => Promise<unknown>>()
    renderDrawer(onResolve, withLoader(onLoadOptionalChoices))
    await pickActionTargetAndRule(user)

    await waitFor(() => expect(onLoadOptionalChoices).toHaveBeenCalledTimes(1))
    expect(resolveButton()).toBeDisabled()
    expect(screen.queryByRole('combobox', { name: 'Chosen ally' })).not.toBeInTheDocument()

    loading.resolve(optionalChoicesNamed('Chosen ally'))
    const field = await screen.findByRole('combobox', { name: 'Chosen ally' })
    expect(resolveButton()).toBeDisabled()
    await user.click(field)
    await user.click(screen.getByRole('option', { name: 'Ally' }))
    expect(resolveButton()).toBeEnabled()
    await user.click(resolveButton())

    expect(onResolve.mock.calls[0]![0]).toMatchObject({
      optionalCombatIntent: {
        definitionId: optionalRule.definitionId,
        selections: [
          { value: { kind: 'ENTITY', entityId: '00000000-0000-4000-8000-0000000000d1' } }
        ]
      }
    })
  })

  it('does not stay held once the optional rule is cleared while its choices are loading', async () => {
    const user = userEvent.setup()
    const onLoadOptionalChoices = vi.fn(() => new Promise<OptionalChoices>(() => {}))
    renderDrawer(vi.fn(), withLoader(onLoadOptionalChoices))
    await pickActionTargetAndRule(user)
    expect(resolveButton()).toBeDisabled()

    await user.click(screen.getByRole('combobox', { name: 'Optional rule' }))
    await user.click(screen.getByRole('option', { name: optionalRule.label }))
    await waitFor(() => expect(resolveButton()).toBeEnabled())
  })

  it('shows the failure and keeps resolving blocked when the choices cannot load', async () => {
    const user = userEvent.setup()
    const onLoadOptionalChoices = vi.fn().mockRejectedValue(new Error('Choices are unavailable.'))
    renderDrawer(vi.fn(), withLoader(onLoadOptionalChoices))
    await pickActionTargetAndRule(user)

    expect(await screen.findByText('Choices are unavailable.')).toBeVisible()
    expect(resolveButton()).toBeDisabled()
  })

  it('replaces a failure with the choices when the same request loads again, and the reverse', async () => {
    const user = userEvent.setup()
    const failing = vi.fn().mockRejectedValue(new Error('Choices are unavailable.'))
    const options = withLoader(failing)
    const view = renderDrawer(vi.fn(), options)
    await pickActionTargetAndRule(user)
    expect(await screen.findByText('Choices are unavailable.')).toBeVisible()

    // A new loader function re-runs the effect for the very same request identity.
    const succeeding = vi.fn().mockResolvedValue(optionalChoicesNamed('Chosen ally'))
    view.rerender(drawerElement(vi.fn(), { ...options, onLoadOptionalChoices: succeeding }))
    expect(await screen.findByRole('combobox', { name: 'Chosen ally' })).toBeVisible()
    expect(screen.queryByText('Choices are unavailable.')).not.toBeInTheDocument()

    const failingAgain = vi.fn().mockRejectedValue(new Error('Choices are unavailable again.'))
    view.rerender(drawerElement(vi.fn(), { ...options, onLoadOptionalChoices: failingAgain }))
    expect(await screen.findByText('Choices are unavailable again.')).toBeVisible()
    expect(screen.queryByRole('combobox', { name: 'Chosen ally' })).not.toBeInTheDocument()
  })

  it('ignores a failure that arrives late for a request that was superseded', async () => {
    const user = userEvent.setup()
    const first = deferred<OptionalChoices>()
    const onLoadOptionalChoices = vi
      .fn<NonNullable<OptionalLoader>>()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValue(optionalChoicesNamed('Chosen ally'))
    const view = renderDrawer(vi.fn(), withLoader(onLoadOptionalChoices))
    await pickActionTargetAndRule(user)
    await waitFor(() => expect(onLoadOptionalChoices).toHaveBeenCalledTimes(1))

    view.rerender(drawerElement(vi.fn(), withLoader(onLoadOptionalChoices, 13)))
    expect(await screen.findByRole('combobox', { name: 'Chosen ally' })).toBeVisible()

    first.reject(new Error('Stale failure.'))
    await settle()
    expect(screen.getByRole('combobox', { name: 'Chosen ally' })).toBeVisible()
    expect(screen.queryByText('Stale failure.')).not.toBeInTheDocument()
  })

  it('ignores choices that arrive late for a request that was superseded', async () => {
    const user = userEvent.setup()
    const first = deferred<OptionalChoices>()
    const onLoadOptionalChoices = vi
      .fn<NonNullable<OptionalLoader>>()
      .mockReturnValueOnce(first.promise)
      .mockRejectedValue(new Error('Newest request failed.'))
    const view = renderDrawer(vi.fn(), withLoader(onLoadOptionalChoices))
    await pickActionTargetAndRule(user)
    await waitFor(() => expect(onLoadOptionalChoices).toHaveBeenCalledTimes(1))

    view.rerender(drawerElement(vi.fn(), withLoader(onLoadOptionalChoices, 13)))
    expect(await screen.findByText('Newest request failed.')).toBeVisible()

    first.resolve(optionalChoicesNamed('Stale ally'))
    await settle()
    expect(screen.getByText('Newest request failed.')).toBeVisible()
    expect(screen.queryByRole('combobox', { name: 'Stale ally' })).not.toBeInTheDocument()
  })

  it('clears the chosen values when the request changes, and when the drawer is reopened', async () => {
    const user = userEvent.setup()
    const onLoadOptionalChoices = vi.fn().mockResolvedValue(optionalChoicesNamed('Chosen ally'))
    const view = renderDrawer(vi.fn(), withLoader(onLoadOptionalChoices))
    await pickActionTargetAndRule(user)
    const choose = async () => {
      await user.click(await screen.findByRole('combobox', { name: 'Chosen ally' }))
      await user.click(screen.getByRole('option', { name: 'Ally' }))
      expect(screen.getByRole('combobox', { name: 'Chosen ally' })).toHaveValue('Ally')
    }
    await choose()

    view.rerender(drawerElement(vi.fn(), withLoader(onLoadOptionalChoices, 13)))
    await waitFor(() => expect(onLoadOptionalChoices).toHaveBeenCalledTimes(2))
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Chosen ally' })).toHaveValue('')
    )
    expect(resolveButton()).toBeDisabled()

    await choose()
    view.rerender(
      drawerElement(vi.fn(), { ...withLoader(onLoadOptionalChoices, 13), opened: false })
    )
    view.rerender(drawerElement(vi.fn(), withLoader(onLoadOptionalChoices, 13)))
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Chosen ally' })).toHaveValue('')
    )
  })
})

describe('CampaignTabletopActionDrawer resets', () => {
  const secondActor = tabletopGmEncounter.actors[1]!

  it('forgets the picked action, its feedback and the map target when the turn passes to another creature', async () => {
    const user = userEvent.setup()
    const onTargetPickSpy = vi.fn()
    const onResolve = vi.fn()
    const view = renderDrawer(onResolve, { onTargetPickSpy })
    await chooseActionAndTarget(user)
    expect(await screen.findByText('Action resolved.')).toBeVisible()
    onTargetPickSpy.mockClear()

    view.rerender(
      drawerElement(onResolve, {
        onTargetPickSpy,
        encounter: { ...tabletopGmEncounter, currentActorId: secondActor.id }
      })
    )
    await waitFor(() => expect(onTargetPickSpy).toHaveBeenLastCalledWith(undefined))
    expect(screen.queryByText('Action resolved.')).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Action' })).toHaveValue('')
    expect(screen.getByRole('combobox', { name: 'Target' })).toHaveValue('')
  })

  it('keeps the feedback and the map target on a rerender that leaves the same creature acting', async () => {
    const user = userEvent.setup()
    const onTargetPickSpy = vi.fn()
    const onResolve = vi.fn()
    const view = renderDrawer(onResolve, { onTargetPickSpy })
    await chooseActionAndTarget(user)
    await screen.findByText('Action resolved.')
    onTargetPickSpy.mockClear()

    view.rerender(
      drawerElement(onResolve, {
        onTargetPickSpy,
        encounter: { ...tabletopGmEncounter, version: tabletopGmEncounter.version + 1 }
      })
    )
    expect(onTargetPickSpy).not.toHaveBeenCalled()
    expect(screen.getByText('Action resolved.')).toBeVisible()
  })

  it('opens the Attack panel again on the next turn after "Done attacking" at the same count', async () => {
    const user = userEvent.setup()
    const onResolve = vi.fn()
    const attack = { choices: [slotted(2)], defaultActionId: actions[0]!.id }
    const view = renderDrawer(onResolve, { ...attack, openAttackAction: openAction(1) })
    await user.click(await screen.findByRole('button', { name: 'Done attacking' }))
    expect(screen.queryByText('Attack action: 1 of 2 made')).not.toBeInTheDocument()

    view.rerender(drawerElement(onResolve, { ...attack, openAttackAction: null }))
    view.rerender(drawerElement(onResolve, { ...attack, openAttackAction: openAction(1) }))
    expect(await screen.findByText('Attack action: 1 of 2 made')).toBeVisible()
  })
})
