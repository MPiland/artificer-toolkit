import {
  Accordion,
  Alert,
  Badge,
  Button,
  Group,
  Loader,
  Modal,
  NumberInput,
  Stack,
  Switch,
  Text,
  Textarea
} from '@mantine/core'
import { useMutation, useQuery } from '@tanstack/react-query'
import { notifications } from '@mantine/notifications'
import { useMutation as useConvexMutation } from 'convex/react'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import {
  healthDisplayLevelDtoSchema,
  type HealthDisplayLevelDto
} from '@artificer-toolkit/schema/api/healthDisplay'
import { useState } from 'react'
import type { EncounterGmActorDto } from '@artificer-toolkit/schema/api/encounters'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import { ServerDraftConflicts } from '#components/ServerDraft/ServerDraftConflicts'
import { useServerDraft } from '#components/ServerDraft/useServerDraft'
import { GmRollVisibilityToggle } from '#app/components/dice/GmRollVisibilityToggle'
import { getCharacterSheetSlice } from '#app/data/characters/queries'
import { useGmRollVisibilityPreference } from '#app/settings/useGmRollVisibilityPreference'
import { AppSelect } from '#app/ui/primitives/Select'
import { AuthoredDetailProse } from '#components/AuthoredDetail'
import { CharacterSheetView } from '#domains/characters/sheet/core/CharacterSheetView'
import { CharacterSheetResourceStepper } from '#domains/characters/sheet/shared/CharacterSheetResourceStepper'
import * as sharedStyles from '../campaigns.css'
import * as encounterStyles from './encounter.css'
import { EncounterActorControlFields } from './EncounterActorControlFields'
import { EncounterEnemyStatBlock } from './EncounterEnemyStatBlock'
import { healthDisplayLevelLabels, healthDisplayLevelOptions } from '../healthDisplay'
import { CampaignLootEditor } from '../loot/CampaignLootEditor'
import type { EncounterCommandPayload } from './encounterWorkspace.types'

const draftFieldLabels = {
  initiative: 'Initiative',
  currentHitPoints: 'Current HP',
  tempHitPoints: 'Temp HP',
  hidden: 'Hidden',
  notes: 'GM notes'
}

interface EncounterActorCardProps {
  actor: EncounterGmActorDto
  campaign: CampaignDetailDto
  currentUserId: string
  disabled: boolean
  encounterId: string
  /** The Encounter's level for enemies and NPCs without an override. */
  healthDisplayDefault: HealthDisplayLevelDto
  onCommand: (payload: EncounterCommandPayload) => void
}

/** Callers key it by `actor.id` so another actor starts from its own values, never the previous draft. */
export function EncounterActorCard({
  actor,
  campaign,
  currentUserId,
  disabled,
  encounterId,
  healthDisplayDefault,
  onCommand
}: EncounterActorCardProps) {
  const draft = useServerDraft({
    initiative: actor.initiative ?? 0,
    currentHitPoints: actor.currentHitPoints,
    tempHitPoints: actor.tempHitPoints,
    hidden: !actor.public,
    notes: actor.gmNotes ?? ''
  })
  const { initiative, currentHitPoints, tempHitPoints, hidden, notes } = draft.values
  const { gmRollVisibility } = useGmRollVisibilityPreference()
  const [sheetOpened, setSheetOpened] = useState(false)
  const shareHealthMutation = useConvexMutation(convexApi.encounters.healthDisplay.share)
  const shareHealth = useMutation({
    mutationFn: () =>
      shareHealthMutation({ encounterId, actorId: actor.id, commandId: crypto.randomUUID() }),
    onSuccess: (entry) =>
      notifications.show({ color: 'orange', title: 'Shared with the table', message: entry.body })
  })
  const sheet = useQuery(
    getCharacterSheetSlice(
      actor.kind === 'CHARACTER' && sheetOpened ? (actor.sourceId ?? undefined) : undefined,
      'COMMON',
      campaign.id
    )
  )

  function commitInitiative() {
    if (disabled || initiative === actor.initiative) return
    onCommand({ type: 'SET_INITIATIVE', actorId: actor.id, initiative })
  }

  function commitEnemyState(
    next: Partial<{
      currentHitPoints: number
      tempHitPoints: number
      isPublic: boolean
      notes: string
    }> = {}
  ) {
    if (disabled || actor.kind === 'CHARACTER') return

    const updated = {
      currentHitPoints: next.currentHitPoints ?? currentHitPoints,
      tempHitPoints: next.tempHitPoints ?? tempHitPoints,
      isPublic: next.isPublic ?? !hidden,
      notes: next.notes ?? notes
    }
    if (
      updated.currentHitPoints === actor.currentHitPoints &&
      updated.tempHitPoints === actor.tempHitPoints &&
      updated.isPublic === actor.public &&
      updated.notes === (actor.gmNotes ?? '')
    ) {
      return
    }

    onCommand({
      type: 'UPDATE_ACTOR',
      actorId: actor.id,
      currentHitPoints: updated.currentHitPoints,
      tempHitPoints: updated.tempHitPoints,
      gmNotes: updated.notes || null,
      public: updated.isPublic
    })
  }

  return (
    <Stack gap='sm'>
      <Group className={encounterStyles.encounterActorControls} align='end' wrap='wrap'>
        {actor.kind !== 'CHARACTER' ? (
          <Button
            disabled={disabled}
            onClick={() => onCommand({ type: 'ROLL_ACTOR_INITIATIVE', actorId: actor.id })}
          >
            Roll initiative
          </Button>
        ) : null}
        <NumberInput
          className={encounterStyles.encounterNumericField}
          classNames={{ input: sharedStyles.input }}
          disabled={disabled}
          label='Initiative'
          value={initiative}
          onChange={(value) => draft.setValue('initiative', Number(value) || 0)}
          onBlur={commitInitiative}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
        />
        {actor.kind !== 'CHARACTER' ? (
          <>
            <NumberInput
              className={encounterStyles.encounterNumericField}
              classNames={{ input: sharedStyles.input }}
              // Reviving is a hit point edit above 0 (D63).
              description={actor.defeated ? 'Defeated. Set above 0 to revive.' : undefined}
              disabled={disabled}
              label='Current HP'
              min={0}
              value={currentHitPoints}
              onChange={(value) => draft.setValue('currentHitPoints', Number(value) || 0)}
              onBlur={() => commitEnemyState()}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur()
              }}
            />
            <NumberInput
              className={encounterStyles.encounterNumericField}
              classNames={{ input: sharedStyles.input }}
              disabled={disabled}
              label='Temp HP'
              min={0}
              value={tempHitPoints}
              onChange={(value) => draft.setValue('tempHitPoints', Number(value) || 0)}
              onBlur={() => commitEnemyState()}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur()
              }}
            />
            <Switch
              className={encounterStyles.encounterVisibility}
              checked={hidden}
              disabled={disabled}
              label='Hidden'
              onChange={(event) => {
                draft.setValue('hidden', event.currentTarget.checked)
                commitEnemyState({ isPublic: !event.currentTarget.checked })
              }}
            />
          </>
        ) : null}
        {actor.kind === 'CHARACTER' ? (
          <Button disabled={!actor.sourceId} variant='default' onClick={() => setSheetOpened(true)}>
            View Sheet
          </Button>
        ) : null}
      </Group>
      <ServerDraftConflicts draft={draft} labels={draftFieldLabels} />
      {campaign.role === 'OWNER' && actor.kind !== 'CHARACTER' ? (
        <Group align='end' gap='xs' wrap='wrap'>
          <AppSelect
            allowDeselect={false}
            aria-label={`Health players see for ${actor.label}`}
            comboboxProps={{ withinPortal: false }}
            data={[
              {
                label: `Encounter default (${healthDisplayLevelLabels[healthDisplayDefault]})`,
                value: 'DEFAULT'
              },
              ...healthDisplayLevelOptions
            ]}
            disabled={disabled}
            label='Health players see'
            searchable={false}
            value={actor.healthDisplay ?? 'DEFAULT'}
            onChange={(value) =>
              value &&
              onCommand({
                type: 'UPDATE_ACTOR',
                actorId: actor.id,
                healthDisplay: value === 'DEFAULT' ? null : healthDisplayLevelDtoSchema.parse(value)
              })
            }
          />
          <Button
            disabled={disabled || !actor.public}
            loading={shareHealth.isPending}
            variant='default'
            onClick={() => shareHealth.mutate()}
          >
            Share health state
          </Button>
        </Group>
      ) : null}
      {shareHealth.error ? (
        <Alert color='red'>The health state couldn’t be shared. Try again.</Alert>
      ) : null}
      {campaign.role === 'OWNER' ? (
        <EncounterActorControlFields
          actor={actor}
          disabled={disabled}
          memberships={campaign.memberships}
          onChange={(update) => onCommand({ ...update, type: 'UPDATE_ACTOR', actorId: actor.id })}
        />
      ) : null}
      {actor.kind !== 'CHARACTER' ? (
        <>
          {actor.statBlock ? <EncounterEnemyStatBlock actor={actor} /> : null}
          {actor.features.length ? (
            <Stack gap='xs'>
              <Group align='center' justify='space-between' wrap='wrap'>
                <Text fw={700} size='sm'>
                  Actions & traits
                </Text>
                <GmRollVisibilityToggle />
              </Group>
              <Accordion multiple variant='contained'>
                {actor.features.map((feature) => (
                  <Accordion.Item key={feature.id} value={feature.id}>
                    <Accordion.Control>
                      <Group gap='xs'>
                        <Text fw={600}>{feature.label}</Text>
                        <Badge color='gray' size='xs' variant='light'>
                          {encounterFeatureSectionLabel(feature)}
                        </Badge>
                      </Group>
                    </Accordion.Control>
                    <Accordion.Panel>
                      <Stack gap='sm'>
                        {feature.resource ? (
                          <div>
                            <CharacterSheetResourceStepper
                              decreaseDisabled={disabled || feature.resource.remaining <= 0}
                              decreaseLabel={`Use one ${feature.label} charge`}
                              increaseDisabled={disabled || feature.resource.used <= 0}
                              increaseLabel={`Restore one ${feature.label} charge`}
                              label={`${feature.label} charges`}
                              maximum={feature.resource.maximum}
                              remaining={feature.resource.remaining}
                              onDecrease={() =>
                                onCommand({
                                  type: 'ADJUST_FEATURE_RESOURCE',
                                  actorId: actor.id,
                                  featureId: feature.id,
                                  direction: 'USE',
                                  amount: 1
                                })
                              }
                              onIncrease={() =>
                                onCommand({
                                  type: 'ADJUST_FEATURE_RESOURCE',
                                  actorId: actor.id,
                                  featureId: feature.id,
                                  direction: 'RESTORE',
                                  amount: 1
                                })
                              }
                            />
                            <Text c='dimmed' mt={4} size='xs'>
                              Resets {feature.resource.resetKind.toLowerCase().replace('_', ' ')}
                            </Text>
                          </div>
                        ) : null}
                        {feature.rollDefinitions?.length ? (
                          <Group gap='xs'>
                            {feature.rollDefinitions.map((definition) => {
                              const lacksCharge =
                                Boolean(definition.chargeCost) &&
                                (!feature.resource ||
                                  feature.resource.remaining < (definition.chargeCost ?? 0))
                              return (
                                <Button
                                  disabled={disabled || lacksCharge}
                                  key={definition.id}
                                  size='compact-sm'
                                  variant='default'
                                  onClick={() =>
                                    onCommand({
                                      type: 'ROLL_ENEMY_ACTION',
                                      actorId: actor.id,
                                      featureId: feature.id,
                                      rollDefinitionId: definition.id,
                                      visibility: gmRollVisibility
                                    })
                                  }
                                >
                                  Roll {definition.label}
                                </Button>
                              )
                            })}
                          </Group>
                        ) : null}
                        <AuthoredDetailProse html={feature.description} fallback='' />
                      </Stack>
                    </Accordion.Panel>
                  </Accordion.Item>
                ))}
              </Accordion>
            </Stack>
          ) : null}
          <Textarea
            classNames={{ input: sharedStyles.input }}
            disabled={disabled}
            label='GM notes'
            value={notes}
            onChange={(event) => draft.setValue('notes', event.currentTarget.value)}
            onBlur={() => commitEnemyState()}
          />
          {campaign.role === 'OWNER' ? (
            <CampaignLootEditor
              gameSystemId={campaign.gameSystemId}
              owner={{
                kind: 'ENCOUNTER_ACTOR',
                campaignId: campaign.id,
                encounterId,
                actorId: actor.id
              }}
              subject='Creature'
            />
          ) : null}
        </>
      ) : null}
      <Modal
        fullScreen
        closeButtonProps={{ 'aria-label': 'Close Character Sheet' }}
        opened={sheetOpened}
        title={actor.label}
        onClose={() => setSheetOpened(false)}
      >
        {sheet.isPending ? <Loader size='sm' /> : null}
        {sheet.error ? (
          <Alert color='red'>The Character Sheet couldn’t be loaded. Close and try again.</Alert>
        ) : null}
        {sheet.data ? (
          <CharacterSheetView
            key={sheet.data.meta.characterId}
            characterPublicId={
              campaign.memberships.find(
                (membership) => membership.assignedCharacter?.id === actor.sourceId
              )?.assignedCharacter?.publicId ??
              sheet.data.publicId ??
              actor.sourceId ??
              ''
            }
            currentUserId={currentUserId}
            hasDraft={Boolean(sheet.data.meta.hasBuilderDraft)}
            rollerName={sheet.data.identity.label}
            sheet={sheet.data}
          />
        ) : null}
      </Modal>
      {actor.kind === 'CHARACTER' ? (
        <Text c='dimmed' size='sm'>
          Character HP and conditions stay owned by the Character Sheet.
        </Text>
      ) : null}
      {campaign.role !== 'OWNER' ? (
        <Text c='dimmed' size='sm'>
          Encounter controls are available to the Campaign GM.
        </Text>
      ) : null}
    </Stack>
  )
}

function encounterFeatureSectionLabel(feature: EncounterGmActorDto['features'][number]) {
  const section = feature.section
  if (section === 'BONUS_ACTION') return 'Bonus action'
  if (section === 'LEGENDARY_ACTION') return 'Legendary action'
  if (section === 'LAIR_ACTION') return 'Lair action'
  if (section === 'REGIONAL_EFFECT') return 'Regional effect'
  if (section === 'REACTION') return 'Reaction'
  if (section === 'ACTION') return 'Action'
  if (feature.rollDefinitions?.length) return 'Action'
  return 'Feature'
}
