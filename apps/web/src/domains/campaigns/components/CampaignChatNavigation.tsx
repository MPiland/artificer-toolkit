import { Badge, Button, Group, Menu, Text } from '@mantine/core'
import { ChevronDown } from 'lucide-react'
import * as chatStyles from './CampaignChat.css'
import type { CampaignChatRoom, CampaignRollView } from './campaignChat.types'

export function CampaignChatNavigation({
  canReadPartyChat,
  directMembers,
  directUnread,
  hasActiveEncounter,
  room,
  roomUnread,
  rollView,
  onSelectDirect,
  onSelectRollView,
  onSelectRoom
}: {
  canReadPartyChat: boolean
  directMembers: { userId: string; username: string; unreadCount: number }[]
  directUnread: number
  hasActiveEncounter: boolean
  room: CampaignChatRoom
  roomUnread: Record<'TABLE' | 'PARTY', number>
  rollView: CampaignRollView
  onSelectDirect: (userId: string) => void
  onSelectRollView: (rollView: CampaignRollView) => void
  onSelectRoom: (room: Exclude<CampaignChatRoom, 'DIRECT'>) => void
}) {
  const showRolls = rollView !== null

  return (
    <nav aria-label='Campaign conversations' className={chatStyles.chatNavigator}>
      <Group className={chatStyles.navigationRow} gap='xs' wrap='nowrap'>
        <Button
          aria-pressed={!showRolls && room === 'TABLE'}
          className={chatStyles.navigationButton}
          size='compact-sm'
          variant={!showRolls && room === 'TABLE' ? 'light' : 'subtle'}
          onClick={() => onSelectRoom('TABLE')}
        >
          Table{' '}
          {roomUnread.TABLE ? (
            <Badge
              aria-label={`${roomUnread.TABLE} unread`}
              className={chatStyles.navigationBadge}
              size='xs'
            >
              {roomUnread.TABLE}
            </Badge>
          ) : null}
        </Button>
        {canReadPartyChat ? (
          <Button
            aria-pressed={!showRolls && room === 'PARTY'}
            className={chatStyles.navigationButton}
            size='compact-sm'
            variant={!showRolls && room === 'PARTY' ? 'light' : 'subtle'}
            onClick={() => onSelectRoom('PARTY')}
          >
            Party{' '}
            {roomUnread.PARTY ? (
              <Badge
                aria-label={`${roomUnread.PARTY} unread`}
                className={chatStyles.navigationBadge}
                size='xs'
              >
                {roomUnread.PARTY}
              </Badge>
            ) : null}
          </Button>
        ) : null}
        <Button
          aria-pressed={rollView === 'MINE'}
          className={chatStyles.navigationButton}
          size='compact-sm'
          variant={rollView === 'MINE' ? 'light' : 'subtle'}
          onClick={() => onSelectRollView('MINE')}
        >
          My rolls
        </Button>
        {hasActiveEncounter ? (
          <Button
            aria-pressed={rollView === 'ENCOUNTER'}
            className={chatStyles.navigationButton}
            size='compact-sm'
            variant={rollView === 'ENCOUNTER' ? 'light' : 'subtle'}
            onClick={() => onSelectRollView('ENCOUNTER')}
          >
            Enemy rolls
          </Button>
        ) : null}
        <Menu position='bottom-start' withinPortal>
          <Menu.Target>
            <Button
              aria-label='Direct messages'
              aria-pressed={!showRolls && room === 'DIRECT'}
              className={chatStyles.navigationButton}
              rightSection={<ChevronDown aria-hidden='true' size={14} />}
              size='compact-sm'
              variant={!showRolls && room === 'DIRECT' ? 'light' : 'subtle'}
            >
              Direct{' '}
              {directUnread ? (
                <Badge
                  aria-label={`${directUnread} unread`}
                  className={chatStyles.navigationBadge}
                  size='xs'
                >
                  {directUnread}
                </Badge>
              ) : null}
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            {directMembers.map((member) => (
              <Menu.Item key={member.userId} onClick={() => onSelectDirect(member.userId)}>
                <Group gap='xs' justify='space-between' wrap='nowrap'>
                  <Text truncate>@{member.username}</Text>
                  {member.unreadCount ? (
                    <Badge aria-label={`${member.unreadCount} unread`} size='xs'>
                      {member.unreadCount}
                    </Badge>
                  ) : null}
                </Group>
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
      </Group>
    </nav>
  )
}
