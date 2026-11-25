import {
  Alert,
  Badge,
  Button,
  Group,
  Modal,
  SimpleGrid,
  Text,
  Title,
  UnstyledButton
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useMutation, useQueries } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { convexQuery } from '@convex-dev/react-query'
import { useMutation as useConvexMutation } from 'convex/react'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import type { z } from 'zod'
import type {
  CampaignDetailDto,
  assignCampaignCharacterInputSchema,
  setActiveCampaignCharacterInputSchema,
  unassignCampaignCharacterInputSchema,
  leaveCampaignInputSchema,
  removeCampaignMemberInputSchema
} from '@artificer-toolkit/schema/api/campaignCore'
import { useGetCharacterList, getCharacterSheetSlice } from '#app/data/characters/queries'
import { useGetCampaignList } from '#app/data/campaigns/queries'
import { CharacterSheetView } from '#domains/characters/sheet/core/CharacterSheetView'
import { attachedCharacters } from '../campaignCharacters'
import { resolveHitPoints } from '../vtt/liveCampaignSummary'
import { useCampaignLiveSummary } from '../vtt/useCampaignLiveSummary'
import * as sharedStyles from '../campaigns.css'
import * as partyStyles from './party.css'
import { CampaignRosterPortrait } from './CampaignRosterPortrait'
import { CharacterControllersField } from './CharacterControllersField'

export function CampaignParty({
  campaign,
  currentUserId,
  openCharacterPicker = false,
  onLeave
}: {
  campaign: CampaignDetailDto
  currentUserId: string
  openCharacterPicker?: boolean
  /** Leaving unmounts the Campaign's subscriptions first, so the page runs it (D216). */
  onLeave: (input: z.infer<typeof leaveCampaignInputSchema>) => void
}) {
  const liveSummary = useCampaignLiveSummary(campaign.id)
  const assignCharacter = useConvexMutation(convexApi.campaigns.assignments.assign)
  const unassignCharacter = useConvexMutation(convexApi.campaigns.assignments.unassign)
  const setActiveCharacter = useConvexMutation(convexApi.campaigns.assignments.setActive)
  const removeMember = useConvexMutation(convexApi.campaigns.membershipDeparture.removeMember)
  const [membershipError, setMembershipError] = useState<string | null>(null)
  const [characterPickerOpened, characterPicker] = useDisclosure(false)
  const [inspectCharacterId, setInspectCharacterId] = useState<string | null>(null)
  const [membershipConfirm, setMembershipConfirm] = useState<
    { kind: 'REMOVE'; userId: string; username: string } | { kind: 'LEAVE' } | null
  >(null)
  // The GM joins the roster only while playing a Character of their own.
  const rosterMembers = campaign.memberships.filter(
    (member) =>
      member.role === 'PLAYER' || member.activeCharacter || member.benchedCharacters.length
  )
  // One card per attached Character, the Active Character first; a member with none gets one card.
  const rosterEntries = rosterMembers.flatMap((member) => {
    const attached = attachedCharacters(member)
    return attached.length
      ? attached.map((character) => ({
          member,
          character,
          active: character.id === member.activeCharacter?.id
        }))
      : [{ member, character: null, active: false }]
  })
  const attachedEntries = rosterEntries.flatMap(({ member, character }) =>
    character ? [{ member, character }] : []
  )
  // Every member sees roster basics; full Sheets are the GM's, the player's own, or another
  // player's while its "Party can view" is on and it is being inspected (ADR 0034 decision 5).
  const basics = useQueries({
    queries: attachedEntries.map(({ character }) =>
      convexQuery(convexApi.campaigns.characterBasics.get, {
        campaignId: campaign.id,
        characterId: character.id
      })
    )
  })
  const sheets = useQueries({
    queries: attachedEntries.map(({ member, character }) => ({
      ...getCharacterSheetSlice(character.id, 'COMMON', campaign.id),
      enabled:
        member.userId === currentUserId ||
        campaign.role === 'OWNER' ||
        inspectCharacterId === character.id
    }))
  })
  const selectedIndex = attachedEntries.findIndex(
    ({ character }) => character.id === inspectCharacterId
  )
  const selected = selectedIndex >= 0 ? attachedEntries[selectedIndex] : null
  const selectedSheet = selectedIndex >= 0 ? sheets[selectedIndex]?.data : undefined
  const pickerDataEnabled = campaign.capabilities.assignOwnCharacter && characterPickerOpened
  const characters = useGetCharacterList(pickerDataEnabled)
  const campaigns = useGetCampaignList(pickerDataEnabled)
  // A Character belongs to at most one Campaign, so any attached Character is off the picker (D236).
  const attachedAnywhere = new Set(
    (campaigns.data ?? []).flatMap(attachedCharacters).map((character) => character.id)
  )
  const eligibleCharacters = (characters.data?.items ?? []).filter(
    (character) => character.status === 'ACTIVE' && !attachedAnywhere.has(character.id)
  )

  useEffect(() => {
    if (openCharacterPicker && campaign.capabilities.assignOwnCharacter) characterPicker.open()
  }, [campaign.capabilities.assignOwnCharacter, characterPicker, openCharacterPicker])

  const removeMemberAction = useMutation({
    retry: 1,
    mutationFn: (input: z.infer<typeof removeCampaignMemberInputSchema>) => removeMember(input),
    onSuccess: () => setMembershipConfirm(null)
  })
  const unassign = useMutation({
    retry: false,
    mutationFn: (input: z.infer<typeof unassignCampaignCharacterInputSchema>) =>
      unassignCharacter(input)
  })
  const markActive = useMutation({
    retry: false,
    mutationFn: (input: z.infer<typeof setActiveCampaignCharacterInputSchema>) =>
      setActiveCharacter(input)
  })
  const assign = useMutation({
    retry: false,
    mutationFn: (input: z.infer<typeof assignCampaignCharacterInputSchema>) =>
      assignCharacter(input),
    onSuccess: () => characterPicker.close()
  })

  return (
    <>
      <section className={sharedStyles.panel} aria-labelledby='campaign-members-title'>
        <Group align='flex-start' justify='space-between' wrap='wrap'>
          <div>
            <Title order={2} id='campaign-members-title'>
              Party roster
            </Title>
            <Text c='dimmed' size='sm'>
              At-a-glance Character state for this Campaign.
            </Text>
          </div>
          {campaign.capabilities.assignOwnCharacter ? (
            <Button
              disabled={characters.isLoading || campaigns.isLoading}
              loading={assign.isPending}
              onClick={characterPicker.open}
            >
              Add Character
            </Button>
          ) : null}
        </Group>

        {unassign.error ? <Alert color='red'>{unassign.error.message}</Alert> : null}
        {markActive.error ? <Alert color='red'>{markActive.error.message}</Alert> : null}

        {rosterMembers.length ? (
          <SimpleGrid className={partyStyles.partyGrid} cols={{ base: 1, sm: 2, lg: 3 }}>
            {rosterEntries.map(({ member, character, active }) => {
              const assignedIndex = character
                ? attachedEntries.findIndex((entry) => entry.character.id === character.id)
                : -1
              const basic = assignedIndex >= 0 ? basics[assignedIndex]?.data : undefined
              const fullSheetShown = member.userId === currentUserId || campaign.role === 'OWNER'
              const sheet =
                fullSheetShown && assignedIndex >= 0 ? sheets[assignedIndex]?.data : undefined
              const hitPoints =
                fullSheetShown && character
                  ? resolveHitPoints(liveSummary, character.id, sheet?.overview)
                  : undefined
              return (
                <article className={partyStyles.partyCard} key={character?.id ?? member.userId}>
                  <Group align='flex-start' justify='space-between' wrap='nowrap'>
                    <Group gap='sm' wrap='nowrap'>
                      {character ? (
                        <CampaignRosterPortrait
                          campaignId={campaign.id}
                          characterId={character.id}
                          label={character.label}
                        />
                      ) : null}
                      <div>
                        <Text fw={700}>{character?.label ?? `@${member.username}`}</Text>
                        {character ? (
                          <Text c='dimmed' size='sm'>
                            @{member.username}
                          </Text>
                        ) : null}
                      </div>
                    </Group>
                    <Group gap='xs' wrap='nowrap'>
                      {member.role === 'OWNER' ? <Badge variant='light'>GM</Badge> : null}
                      <Badge variant='light'>
                        {character ? (active ? 'Active' : 'Benched') : 'Needs Character'}
                      </Badge>
                    </Group>
                  </Group>
                  {!character ? (
                    <Text c='dimmed' size='sm'>
                      This player has joined but has not assigned a Character yet.
                    </Text>
                  ) : basic ? (
                    <>
                      <Text c='dimmed' size='sm'>
                        {[basic.classSummary, `Level ${basic.totalLevel}`]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                      {hitPoints ? (
                        <Group className={partyStyles.partySummary} gap='xs'>
                          <Text size='sm'>
                            HP {hitPoints.currentHitPoints}/{hitPoints.maxHitPoints}
                          </Text>
                          {sheet ? (
                            <Text c='dimmed' size='sm'>
                              AC {sheet.overview.armorClass}
                            </Text>
                          ) : null}
                        </Group>
                      ) : null}
                    </>
                  ) : (
                    <Text c='dimmed' size='sm'>
                      Loading Character…
                    </Text>
                  )}
                  {campaign.role === 'OWNER' && character ? (
                    <Button
                      disabled={!sheet}
                      size='sm'
                      variant='default'
                      onClick={() => setInspectCharacterId(character.id)}
                    >
                      Inspect Sheet
                    </Button>
                  ) : character && !fullSheetShown && basic?.sheetVisible ? (
                    <Button
                      size='sm'
                      variant='default'
                      onClick={() => setInspectCharacterId(character.id)}
                    >
                      View Sheet
                    </Button>
                  ) : null}
                  {campaign.role === 'OWNER' && character && active && member.role === 'PLAYER' ? (
                    <CharacterControllersField
                      campaignId={campaign.id}
                      character={character}
                      controllerUserIds={member.characterControllerUserIds}
                      memberships={campaign.memberships}
                      assignedUserId={member.userId}
                    />
                  ) : null}
                  {campaign.capabilities.manageMembers && member.role === 'PLAYER' ? (
                    <Group gap='xs'>
                      {character ? (
                        <Button
                          size='xs'
                          variant='subtle'
                          onClick={() =>
                            unassign.mutate({
                              campaignId: campaign.id,
                              characterId: character.id
                            })
                          }
                        >
                          Unassign
                        </Button>
                      ) : null}
                      <Button
                        color='red'
                        size='xs'
                        variant='subtle'
                        onClick={() => {
                          removeMemberAction.reset()
                          setMembershipError(null)
                          setMembershipConfirm({
                            kind: 'REMOVE',
                            userId: member.userId,
                            username: member.username
                          })
                        }}
                      >
                        Remove player
                      </Button>
                    </Group>
                  ) : null}
                  {campaign.capabilities.assignOwnCharacter &&
                  member.userId === currentUserId &&
                  character ? (
                    <Group gap='xs'>
                      {active ? null : (
                        <Button
                          loading={markActive.isPending}
                          size='sm'
                          onClick={() =>
                            markActive.mutate({
                              campaignId: campaign.id,
                              characterId: character.id
                            })
                          }
                        >
                          Mark active
                        </Button>
                      )}
                      <Button
                        loading={unassign.isPending}
                        size='sm'
                        variant='default'
                        onClick={() =>
                          unassign.mutate({ campaignId: campaign.id, characterId: character.id })
                        }
                      >
                        Remove Character
                      </Button>
                    </Group>
                  ) : null}
                </article>
              )
            })}
          </SimpleGrid>
        ) : (
          <div className={sharedStyles.emptyState}>
            <Text fw={600}>No Characters assigned yet.</Text>
            <Text c='dimmed' size='sm'>
              Players can add an eligible Character when they are ready.
            </Text>
          </div>
        )}

        {campaign.role === 'PLAYER' && campaign.status === 'ACTIVE' ? (
          <Button
            color='red'
            variant='subtle'
            onClick={() => {
              removeMemberAction.reset()
              setMembershipError(null)
              setMembershipConfirm({ kind: 'LEAVE' })
            }}
          >
            Leave Campaign
          </Button>
        ) : null}
      </section>

      <Modal
        centered
        opened={membershipConfirm !== null}
        title={membershipConfirm?.kind === 'REMOVE' ? 'Remove player?' : 'Leave Campaign?'}
        onClose={() => setMembershipConfirm(null)}
      >
        <Text c='dimmed' size='sm'>
          {membershipConfirm?.kind === 'REMOVE'
            ? `@${membershipConfirm.username} will lose Campaign access and their assigned Character will be removed from the roster. They must be invited again to return.`
            : 'You will lose Campaign access and your assigned Character will leave the roster. You must be invited again to return.'}
        </Text>
        {removeMemberAction.error || membershipError ? (
          <Alert color='red'>{removeMemberAction.error?.message ?? membershipError}</Alert>
        ) : null}
        <Group justify='flex-end' mt='lg'>
          <Button variant='default' onClick={() => setMembershipConfirm(null)}>
            Cancel
          </Button>
          <Button
            color='red'
            loading={removeMemberAction.isPending}
            onClick={() => {
              if (removeMemberAction.isError && removeMemberAction.variables) {
                removeMemberAction.mutate(removeMemberAction.variables)
                return
              }
              if (!membershipConfirm) return
              const userId =
                membershipConfirm.kind === 'REMOVE' ? membershipConfirm.userId : currentUserId
              const membership = campaign.memberships.find((member) => member.userId === userId)
              if (!membership) {
                setMembershipError('Campaign membership is no longer available.')
                return
              }
              const input: z.infer<typeof leaveCampaignInputSchema> = {
                campaignId: campaign.id,
                expectedCampaignVersion: campaign.version,
                expectedMembershipAccessStartedAt: membership.accessStartedAt,
                commandId: crypto.randomUUID()
              }
              if (membershipConfirm.kind === 'REMOVE')
                removeMemberAction.mutate({ ...input, userId })
              else {
                setMembershipConfirm(null)
                onLeave(input)
              }
            }}
          >
            {membershipConfirm?.kind === 'REMOVE' ? 'Remove player' : 'Leave Campaign'}
          </Button>
        </Group>
      </Modal>

      <Modal
        closeOnEscape={false}
        fullScreen
        closeButtonProps={{ 'aria-label': 'Close Character Sheet' }}
        opened={Boolean(selectedSheet && selected)}
        title={selected?.character.label ?? 'Character Sheet'}
        onClose={() => setInspectCharacterId(null)}
      >
        {selectedSheet && selected ? (
          <CharacterSheetView
            key={selectedSheet.meta.characterId}
            characterPublicId={selected.character.publicId}
            currentUserId={currentUserId}
            hasDraft={Boolean(selectedSheet.meta.hasBuilderDraft)}
            rollerName={selectedSheet.identity.label}
            sheet={selectedSheet}
          />
        ) : (
          <Alert color='yellow'>Character Sheet is loading.</Alert>
        )}
      </Modal>

      <Modal
        closeButtonProps={{ 'aria-label': 'Close Character picker' }}
        opened={characterPickerOpened}
        size='lg'
        title='Add Character'
        onClose={characterPicker.close}
      >
        {assign.error ? <Alert color='red'>{assign.error.message}</Alert> : null}
        {characters.isLoading || campaigns.isLoading ? (
          <Text role='status'>Loading eligible Characters…</Text>
        ) : eligibleCharacters.length ? (
          <SimpleGrid className={partyStyles.characterPickerGrid} cols={{ base: 1, sm: 2 }}>
            {eligibleCharacters.map((character) => (
              <UnstyledButton
                className={partyStyles.characterPickerCard}
                disabled={assign.isPending}
                key={character.id}
                onClick={() =>
                  assign.mutate({
                    campaignId: campaign.id,
                    characterId: character.id
                  })
                }
              >
                <Text fw={700}>{character.label}</Text>
                <Text c='dimmed' size='sm'>
                  Active Character
                </Text>
              </UnstyledButton>
            ))}
          </SimpleGrid>
        ) : (
          <Text c='dimmed'>
            No eligible Characters. Create an active Character or remove one from another Campaign.
          </Text>
        )}
      </Modal>
    </>
  )
}
