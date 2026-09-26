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
  unassignCampaignCharacterInputSchema,
  leaveCampaignInputSchema,
  removeCampaignMemberInputSchema
} from '@artificer-toolkit/schema/api/campaignCore'
import { useGetCharacterList, getCharacterSheet } from '#app/data/characters/queries'
import { useGetCampaignList } from '#app/data/campaigns/queries'
import { CharacterSheetView } from '#domains/characters/sheet/core/CharacterSheetView'
import * as sharedStyles from '../campaigns.css'
import * as partyStyles from './party.css'
import { CampaignRosterPortrait } from './CampaignRosterPortrait'

export function CampaignParty({
  campaign,
  currentUserId,
  openCharacterPicker = false
}: {
  campaign: CampaignDetailDto
  currentUserId: string
  openCharacterPicker?: boolean
}) {
  const assignCharacter = useConvexMutation(convexApi.campaigns.assignments.assign)
  const unassignCharacter = useConvexMutation(convexApi.campaigns.assignments.unassign)
  const leaveCampaign = useConvexMutation(convexApi.campaigns.membershipDeparture.leave)
  const removeMember = useConvexMutation(convexApi.campaigns.membershipDeparture.removeMember)
  const [membershipError, setMembershipError] = useState<string | null>(null)
  const [characterPickerOpened, characterPicker] = useDisclosure(false)
  const [inspectCharacterId, setInspectCharacterId] = useState<string | null>(null)
  const [membershipConfirm, setMembershipConfirm] = useState<
    { kind: 'REMOVE'; userId: string; username: string } | { kind: 'LEAVE' } | null
  >(null)
  const currentMembership = campaign.memberships.find((member) => member.userId === currentUserId)
  const rosterMembers = campaign.memberships.filter((member) => member.role === 'PLAYER')
  const assignedCharacters = rosterMembers.flatMap((member) =>
    member.assignedCharacter ? [{ member, character: member.assignedCharacter }] : []
  )
  // Every member sees roster basics; full Sheets are the GM's, the player's own, or another
  // player's while its "Party can view" is on and it is being inspected (ADR 0034 decision 5).
  const basics = useQueries({
    queries: assignedCharacters.map(({ character }) =>
      convexQuery(convexApi.campaigns.characterSheet.basics, {
        campaignId: campaign.id,
        characterId: character.id
      })
    )
  })
  const sheets = useQueries({
    queries: assignedCharacters.map(({ member, character }) =>
      member.userId === currentUserId
        ? getCharacterSheet(character.id)
        : {
            ...convexQuery(convexApi.campaigns.characterSheet.get, {
              campaignId: campaign.id,
              characterId: character.id
            }),
            enabled: campaign.role === 'OWNER' || inspectCharacterId === character.id
          }
    )
  })
  const selectedIndex = assignedCharacters.findIndex(
    ({ character }) => character.id === inspectCharacterId
  )
  const selected = selectedIndex >= 0 ? assignedCharacters[selectedIndex] : null
  const selectedSheet = selectedIndex >= 0 ? sheets[selectedIndex]?.data : undefined
  const pickerDataEnabled = campaign.capabilities.assignOwnCharacter && characterPickerOpened
  const characters = useGetCharacterList(pickerDataEnabled)
  const campaigns = useGetCampaignList(pickerDataEnabled)
  const assignedElsewhere = new Set(
    (campaigns.data ?? []).flatMap((item) =>
      item.id !== campaign.id && item.assignedCharacter ? [item.assignedCharacter.id] : []
    )
  )
  const eligibleCharacters = (characters.data?.items ?? []).filter(
    (character) => character.status === 'ACTIVE' && !assignedElsewhere.has(character.id)
  )

  useEffect(() => {
    if (openCharacterPicker && campaign.capabilities.assignOwnCharacter) characterPicker.open()
  }, [campaign.capabilities.assignOwnCharacter, characterPicker, openCharacterPicker])

  const membershipAction = useMutation({
    retry: 1,
    mutationFn: (
      action:
        | {
            kind: 'REMOVE'
            input: z.infer<typeof removeCampaignMemberInputSchema>
          }
        | { kind: 'LEAVE'; input: z.infer<typeof leaveCampaignInputSchema> }
    ) => (action.kind === 'REMOVE' ? removeMember(action.input) : leaveCampaign(action.input)),
    onSuccess: (_result, action) => {
      setMembershipConfirm(null)
      if (action.kind === 'LEAVE') window.location.assign('/campaigns')
    }
  })
  const unassign = useMutation({
    retry: false,
    mutationFn: (input: z.infer<typeof unassignCampaignCharacterInputSchema>) =>
      unassignCharacter(input)
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
              {currentMembership?.assignedCharacter ? 'Change Character' : 'Add Character'}
            </Button>
          ) : null}
        </Group>

        {unassign.error ? <Alert color='red'>{unassign.error.message}</Alert> : null}

        {rosterMembers.length ? (
          <SimpleGrid className={partyStyles.partyGrid} cols={{ base: 1, sm: 2, lg: 3 }}>
            {rosterMembers.map((member) => {
              const character = member.assignedCharacter
              const assignedIndex = character
                ? assignedCharacters.findIndex((entry) => entry.character.id === character.id)
                : -1
              const basic = assignedIndex >= 0 ? basics[assignedIndex]?.data : undefined
              const fullSheetShown = member.userId === currentUserId || campaign.role === 'OWNER'
              const sheet =
                fullSheetShown && assignedIndex >= 0 ? sheets[assignedIndex]?.data : undefined
              return (
                <article className={partyStyles.partyCard} key={member.userId}>
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
                    <Badge variant='light'>{character ? 'Ready' : 'Needs Character'}</Badge>
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
                      {sheet ? (
                        <Group className={partyStyles.partySummary} gap='xs'>
                          <Text size='sm'>
                            HP {sheet.overview.currentHitPoints}/{sheet.overview.maxHitPoints}
                          </Text>
                          <Text c='dimmed' size='sm'>
                            AC {sheet.overview.armorClass}
                          </Text>
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
                  {campaign.capabilities.manageMembers ? (
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
                          membershipAction.reset()
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
                    <Button
                      loading={unassign.isPending}
                      size='sm'
                      variant='default'
                      onClick={() => unassign.mutate({ campaignId: campaign.id })}
                    >
                      Remove Character
                    </Button>
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
              membershipAction.reset()
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
        {membershipAction.error || membershipError ? (
          <Alert color='red'>{membershipAction.error?.message ?? membershipError}</Alert>
        ) : null}
        <Group justify='flex-end' mt='lg'>
          <Button variant='default' onClick={() => setMembershipConfirm(null)}>
            Cancel
          </Button>
          <Button
            color='red'
            loading={membershipAction.isPending}
            onClick={() => {
              if (membershipAction.isError && membershipAction.variables) {
                membershipAction.mutate(membershipAction.variables)
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
              membershipAction.mutate(
                membershipConfirm.kind === 'REMOVE'
                  ? { kind: 'REMOVE', input: { ...input, userId } }
                  : { kind: 'LEAVE', input }
              )
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
        title={currentMembership?.assignedCharacter ? 'Change Character' : 'Add Character'}
        onClose={characterPicker.close}
      >
        {assign.error ? <Alert color='red'>{assign.error.message}</Alert> : null}
        {characters.isLoading || campaigns.isLoading ? (
          <Text role='status'>Loading eligible Characters…</Text>
        ) : eligibleCharacters.length ? (
          <SimpleGrid className={partyStyles.characterPickerGrid} cols={{ base: 1, sm: 2 }}>
            {eligibleCharacters.map((character) => {
              const selectedCharacter = currentMembership?.assignedCharacter?.id === character.id
              return (
                <UnstyledButton
                  className={partyStyles.characterPickerCard}
                  data-selected={selectedCharacter || undefined}
                  disabled={selectedCharacter || assign.isPending}
                  key={character.id}
                  onClick={() =>
                    assign.mutate({
                      campaignId: campaign.id,
                      characterId: character.id
                    })
                  }
                >
                  <Group justify='space-between' gap='xs'>
                    <Text fw={700}>{character.label}</Text>
                    {selectedCharacter ? <Badge variant='light'>Assigned</Badge> : null}
                  </Group>
                  <Text c='dimmed' size='sm'>
                    {selectedCharacter ? 'Currently playing in this Campaign' : 'Active Character'}
                  </Text>
                </UnstyledButton>
              )
            })}
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
