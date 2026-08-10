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
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import type { CampaignDetailDto } from '#app/lib/api'
import { api } from '#app/lib/api'
import { getCharacterList, getCharacterSheet } from '#app/data/characters/queries'
import { getCampaignList } from '#app/data/campaigns/queries'
import { queryKeys } from '#app/lib/queryKeys'
import { CharacterSheetView } from '#domains/characters/sheet/core/CharacterSheetView'
import * as sharedStyles from '../campaigns.css'
import * as partyStyles from './party.css'

export function CampaignParty({
  campaign,
  currentUserId,
  openCharacterPicker = false
}: {
  campaign: CampaignDetailDto
  currentUserId: string
  openCharacterPicker?: boolean
}) {
  const queryClient = useQueryClient()
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
  const sheets = useQueries({
    queries: assignedCharacters.map(({ character }) => getCharacterSheet(character.id))
  })
  const selectedIndex = assignedCharacters.findIndex(
    ({ character }) => character.id === inspectCharacterId
  )
  const selected = selectedIndex >= 0 ? assignedCharacters[selectedIndex] : null
  const selectedSheet = selectedIndex >= 0 ? sheets[selectedIndex]?.data : undefined
  const characters = useQuery({
    ...getCharacterList(),
    enabled: campaign.capabilities.assignOwnCharacter
  })
  const campaigns = useQuery({
    ...getCampaignList(),
    enabled: campaign.capabilities.assignOwnCharacter
  })
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

  async function refreshCampaign() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.detail(campaign.id) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.list() })
    ])
  }

  const membershipAction = useMutation({
    mutationFn: async (
      action:
        | { kind: 'REMOVE'; userId: string }
        | { kind: 'UNASSIGN'; characterId?: string }
        | { kind: 'LEAVE' }
    ) => {
      if (action.kind === 'REMOVE') return api.campaigns.removeMember(campaign.id, action.userId)
      if (action.kind === 'LEAVE') return api.campaigns.leave(campaign.id)
      return api.campaigns.unassignCharacter(campaign.id, action.characterId)
    },
    onSuccess: async (_result, action) => {
      setMembershipConfirm(null)
      await refreshCampaign()
      if (action.kind === 'LEAVE') window.location.assign('/campaigns')
    }
  })
  const assign = useMutation({
    mutationFn: (characterId: string) => api.campaigns.assignCharacter(campaign.id, characterId),
    onSuccess: async () => {
      characterPicker.close()
      await refreshCampaign()
    }
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

        {rosterMembers.length ? (
          <SimpleGrid className={partyStyles.partyGrid} cols={{ base: 1, sm: 2, lg: 3 }}>
            {rosterMembers.map((member) => {
              const character = member.assignedCharacter
              const assignedIndex = character
                ? assignedCharacters.findIndex((entry) => entry.character.id === character.id)
                : -1
              const sheet = assignedIndex >= 0 ? sheets[assignedIndex]?.data : undefined
              return (
                <article className={partyStyles.partyCard} key={member.userId}>
                  <Group align='flex-start' justify='space-between' wrap='nowrap'>
                    <div>
                      <Text fw={700}>{character?.label ?? `@${member.username}`}</Text>
                      {character ? (
                        <Text c='dimmed' size='sm'>
                          @{member.username}
                        </Text>
                      ) : null}
                    </div>
                    <Badge variant='light'>{character ? 'Ready' : 'Needs Character'}</Badge>
                  </Group>
                  {!character ? (
                    <Text c='dimmed' size='sm'>
                      This player has joined but has not assigned a Character yet.
                    </Text>
                  ) : sheet ? (
                    <>
                      <Text c='dimmed' size='sm'>
                        {[sheet.identity.raceLabel, sheet.identity.classSummary]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                      <Group className={partyStyles.partySummary} gap='xs'>
                        <Text size='sm'>
                          HP {sheet.overview.currentHitPoints}/{sheet.overview.maxHitPoints}
                        </Text>
                        <Text c='dimmed' size='sm'>
                          AC {sheet.overview.armorClass}
                        </Text>
                        <Text c='dimmed' size='sm'>
                          Lvl {sheet.identity.totalLevel}
                        </Text>
                      </Group>
                    </>
                  ) : (
                    <Text c='dimmed' size='sm'>
                      Loading Character state…
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
                  ) : null}
                  {campaign.capabilities.manageMembers ? (
                    <Group gap='xs'>
                      {character ? (
                        <Button
                          size='xs'
                          variant='subtle'
                          onClick={() =>
                            membershipAction.mutate({
                              kind: 'UNASSIGN',
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
                        onClick={() =>
                          setMembershipConfirm({
                            kind: 'REMOVE',
                            userId: member.userId,
                            username: member.username
                          })
                        }
                      >
                        Remove player
                      </Button>
                    </Group>
                  ) : null}
                  {campaign.capabilities.assignOwnCharacter &&
                  member.userId === currentUserId &&
                  character ? (
                    <Button
                      loading={membershipAction.isPending}
                      size='sm'
                      variant='default'
                      onClick={() => membershipAction.mutate({ kind: 'UNASSIGN' })}
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
            onClick={() => setMembershipConfirm({ kind: 'LEAVE' })}
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
        <Group justify='flex-end' mt='lg'>
          <Button variant='default' onClick={() => setMembershipConfirm(null)}>
            Cancel
          </Button>
          <Button
            color='red'
            loading={membershipAction.isPending}
            onClick={() => {
              if (membershipConfirm?.kind === 'REMOVE') {
                membershipAction.mutate({
                  kind: 'REMOVE',
                  userId: membershipConfirm.userId
                })
              } else if (membershipConfirm?.kind === 'LEAVE') {
                membershipAction.mutate({ kind: 'LEAVE' })
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
        {eligibleCharacters.length ? (
          <SimpleGrid className={partyStyles.characterPickerGrid} cols={{ base: 1, sm: 2 }}>
            {eligibleCharacters.map((character) => {
              const selectedCharacter = currentMembership?.assignedCharacter?.id === character.id
              return (
                <UnstyledButton
                  className={partyStyles.characterPickerCard}
                  data-selected={selectedCharacter || undefined}
                  disabled={selectedCharacter || assign.isPending}
                  key={character.id}
                  onClick={() => assign.mutate(character.id)}
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
