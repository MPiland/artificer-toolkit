import { Alert, Badge, Button, Card, Divider, Group, SimpleGrid, Stack, Text, Title } from '@mantine/core'
import { Backpack, BookOpen, Coins, HeartPulse, ScrollText, Sparkles, Swords } from 'lucide-react'

import { Route } from '#routes/_authed/characters/$characterId'
import { useGetCharacterSheet } from '../../data/characters'

const heroStyle = {
  background: 'linear-gradient(135deg, rgba(23, 28, 42, 0.98), rgba(58, 37, 26, 0.92))',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  color: 'white'
} as const

const panelStyle = {
  background: 'linear-gradient(180deg, rgba(248, 244, 235, 0.98), rgba(238, 230, 219, 0.98))',
  border: '1px solid rgba(78, 55, 36, 0.14)'
} as const

function renderLines(lines: string[] | undefined) {
  if (!lines || lines.length === 0) {
    return <Text c='dimmed' size='sm'>None yet.</Text>
  }

  return (
    <Stack gap={6}>
      {lines.map((line) => (
        <Text key={line} size='sm'>{line}</Text>
      ))}
    </Stack>
  )
}

const Character = () => {
  const characterId = Route.useParams({ select: (params) => params.characterId })
  const sheetQuery = useGetCharacterSheet(characterId)

  if (!sheetQuery.data) {
    return (
      <Alert color='red' title='Character Not Found'>
        We could not load this character.
      </Alert>
    )
  }

  const { character, resolution, playState } = sheetQuery.data
  const classes = resolution.summary.classes
  const inventory = playState.equipment.inventory
  const preparedSpells = (playState.classes ?? []).flatMap((entry) => entry.spells?.prepared ?? [])
  const learnedSpells = (playState.classes ?? []).flatMap((entry) => entry.spells?.learned ?? [])

  return (
    <Stack gap='xl'>
      <Card radius='xl' p='xl' style={heroStyle}>
        <Stack gap='lg'>
          <Group justify='space-between' align='flex-start'>
            <Stack gap={8}>
              <Group gap='xs'>
                <Sparkles size={18} />
                <Text fw={700} tt='uppercase' size='xs' c='rgba(255,255,255,0.72)'>
                  Character Sheet
                </Text>
              </Group>
              <Title order={1} fz='clamp(2rem, 3vw, 3.1rem)'>
                {character.label || 'Untitled character'}
              </Title>
              <Text size='lg' c='rgba(255,255,255,0.78)' maw={760}>
                {character.description || 'No concept summary yet. Add one in the builder to ground the character.'}
              </Text>
            </Stack>

            <Stack gap='sm' align='flex-end'>
              <Group gap='xs'>
                <Badge color={character.status === 'ACTIVE' ? 'green' : 'orange'} variant='light'>
                  {character.status === 'ACTIVE' ? 'Playable' : 'Draft'}
                </Badge>
                <Badge variant='outline' c='white'>
                  Level {resolution.summary.totalLevel || 1}
                </Badge>
              </Group>

              <Button
                component='a'
                href={character.status === 'ACTIVE' ? `/characters/edit/${character.id}` : `/characters/new/${character.id}`}
                radius='xl'
                variant='white'
                color='dark'
              >
                Edit Character
              </Button>
            </Stack>
          </Group>

          <SimpleGrid cols={{ base: 1, md: 4 }} spacing='md'>
            <Card radius='lg' p='lg' style={{ background: 'rgba(255,255,255,0.08)' }}>
              <Text size='xs' tt='uppercase' c='rgba(255,255,255,0.68)'>Race</Text>
              <Text fw={700} mt={4}>{resolution.summary.selectedRace?.raceLabel ?? 'Unselected'}</Text>
              {resolution.summary.selectedRace?.subraceLabel ? (
                <Text size='sm' c='rgba(255,255,255,0.72)'>{resolution.summary.selectedRace.subraceLabel}</Text>
              ) : null}
            </Card>
            <Card radius='lg' p='lg' style={{ background: 'rgba(255,255,255,0.08)' }}>
              <Text size='xs' tt='uppercase' c='rgba(255,255,255,0.68)'>Background</Text>
              <Text fw={700} mt={4}>{resolution.summary.selectedBackground?.label ?? 'Unselected'}</Text>
            </Card>
            <Card radius='lg' p='lg' style={{ background: 'rgba(255,255,255,0.08)' }}>
              <Text size='xs' tt='uppercase' c='rgba(255,255,255,0.68)'>Hit Points</Text>
              <Text fw={700} mt={4}>{playState.hitpoints.current} current</Text>
              <Text size='sm' c='rgba(255,255,255,0.72)'>
                Temp {playState.hitpoints.temp ?? 0}
              </Text>
            </Card>
            <Card radius='lg' p='lg' style={{ background: 'rgba(255,255,255,0.08)' }}>
              <Text size='xs' tt='uppercase' c='rgba(255,255,255,0.68)'>Loadout</Text>
              <Text fw={700} mt={4}>{inventory.length} inventory items</Text>
              <Text size='sm' c='rgba(255,255,255,0.72)'>
                {playState.equipment.equipped.length} equipped / {playState.equipment.attuned.length} attuned
              </Text>
            </Card>
          </SimpleGrid>
        </Stack>
      </Card>

      {character.status === 'DRAFT' ? (
        <Alert color='orange' title='Draft Character'>
          <Stack gap={6}>
            <Text size='sm'>
              This sheet is available as a play-surface preview, but structural choices should still be
              completed in the builder.
            </Text>
            {resolution.readiness.blockingIssues.length > 0 ? (
              <Text size='sm'>
                Blocking issues: {resolution.readiness.blockingIssues.join(' | ')}
              </Text>
            ) : null}
          </Stack>
        </Alert>
      ) : null}

      <SimpleGrid cols={{ base: 1, xl: 2 }} spacing='lg'>
        <Card radius='xl' p='xl' style={panelStyle}>
          <Stack gap='lg'>
            <Group gap='sm'>
              <Swords size={18} />
              <Title order={3}>Actions and Features</Title>
            </Group>
            {resolution.grants.features.length === 0 ? (
              <Text c='dimmed' size='sm'>No feature references yet.</Text>
            ) : (
              <Stack gap='sm'>
                {resolution.grants.features.map((item) => (
                  <Card key={`${item.id}:${item.sourceLabel}`} radius='lg' p='md' withBorder>
                    <Text fw={700} size='sm'>{item.label}</Text>
                    <Text size='sm' c='dimmed'>{item.sourceLabel}</Text>
                  </Card>
                ))}
              </Stack>
            )}
          </Stack>
        </Card>

        <Card radius='xl' p='xl' style={panelStyle}>
          <Stack gap='lg'>
            <Group gap='sm'>
              <HeartPulse size={18} />
              <Title order={3}>Resources and Spellcasting</Title>
            </Group>

            <Stack gap='sm'>
              <Text fw={700} size='sm'>Tracked resources</Text>
              {playState.resources?.length ? (
                <Stack gap={6}>
                  {playState.resources.map((resource) => (
                    <Text key={resource.resourceGrantId} size='sm'>
                      {resource.resourceGrantId}: {resource.used} used
                    </Text>
                  ))}
                </Stack>
              ) : (
                <Text c='dimmed' size='sm'>No tracked resources yet.</Text>
              )}
            </Stack>

            <Divider />

            <Stack gap='sm'>
              <Text fw={700} size='sm'>Spell access</Text>
              <Text size='sm'>
                Prepared spells: {preparedSpells.length}
              </Text>
              <Text size='sm'>
                Learned spells: {learnedSpells.length}
              </Text>
              {resolution.grants.spellcasting.length ? (
                <Stack gap={6}>
                  {resolution.grants.spellcasting.map((item) => (
                    <Text key={item.id} size='sm'>{item.label}</Text>
                  ))}
                </Stack>
              ) : (
                <Text c='dimmed' size='sm'>No spellcasting grants yet.</Text>
              )}
            </Stack>
          </Stack>
        </Card>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, xl: 2 }} spacing='lg'>
        <Card radius='xl' p='xl' style={panelStyle}>
          <Stack gap='lg'>
            <Group gap='sm'>
              <Backpack size={18} />
              <Title order={3}>Inventory and Equipment</Title>
            </Group>
            {inventory.length === 0 ? (
              <Text c='dimmed' size='sm'>No inventory items yet.</Text>
            ) : (
              <Stack gap='sm'>
                {inventory.map((item) => (
                  <Card key={item.id} radius='lg' p='md' withBorder>
                    <Group justify='space-between' align='flex-start'>
                      <div>
                        <Text fw={700} size='sm'>{item.customName || item.equipmentId}</Text>
                        <Text size='sm' c='dimmed'>
                          Quantity {item.quantity}
                          {playState.equipment.equipped.includes(item.id) ? ' | Equipped' : ''}
                          {playState.equipment.attuned.includes(item.id) ? ' | Attuned' : ''}
                        </Text>
                      </div>
                    </Group>
                  </Card>
                ))}
              </Stack>
            )}
          </Stack>
        </Card>

        <Card radius='xl' p='xl' style={panelStyle}>
          <Stack gap='lg'>
            <Group gap='sm'>
              <Coins size={18} />
              <Title order={3}>Currency and Roster</Title>
            </Group>

            <Stack gap='sm'>
              <Text fw={700} size='sm'>Currency</Text>
              {playState.currency.length === 0 ? (
                <Text c='dimmed' size='sm'>No currency tracked yet.</Text>
              ) : (
                <Stack gap={6}>
                  {playState.currency.map((group, index) => (
                    <Text key={`${group.containerId ?? 'root'}:${index}`} size='sm'>
                      {(group.containerId ?? 'On Character')}: {group.currencies.map((currency) => `${currency.amount} ${currency.currencyId}`).join(', ')}
                    </Text>
                  ))}
                </Stack>
              )}
            </Stack>

            <Divider />

            <Stack gap='sm'>
              <Text fw={700} size='sm'>Companions and mounts</Text>
              {playState.creatures?.length ? (
                <Stack gap={6}>
                  {playState.creatures.map((creature) => (
                    <Text key={creature.id} size='sm'>
                      {creature.customName || creature.creatureId} ({creature.relationshipKind.toLowerCase()})
                    </Text>
                  ))}
                </Stack>
              ) : (
                <Text c='dimmed' size='sm'>No companion or mount records yet.</Text>
              )}
            </Stack>

            <Divider />

            <Stack gap='sm'>
              <Text fw={700} size='sm'>Vehicles</Text>
              {playState.vehicles?.length ? (
                <Stack gap={6}>
                  {playState.vehicles.map((vehicle) => (
                    <Text key={vehicle.id} size='sm'>
                      {vehicle.customName || vehicle.vehicleId}
                    </Text>
                  ))}
                </Stack>
              ) : (
                <Text c='dimmed' size='sm'>No vehicle records yet.</Text>
              )}
            </Stack>
          </Stack>
        </Card>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, xl: 2 }} spacing='lg'>
        <Card radius='xl' p='xl' style={panelStyle}>
          <Stack gap='lg'>
            <Group gap='sm'>
              <ScrollText size={18} />
              <Title order={3}>Class and Build Reference</Title>
            </Group>
            {classes.length === 0 ? (
              <Text c='dimmed' size='sm'>No class selections yet.</Text>
            ) : (
              <Stack gap='sm'>
                {classes.map((entry) => (
                  <Card key={`${entry.classId}:${entry.classLevel}:${entry.subclassId ?? 'base'}`} radius='lg' p='md' withBorder>
                    <Text fw={700} size='sm'>
                      {entry.classLabel}
                      {entry.subclassLabel ? ` / ${entry.subclassLabel}` : ''}
                      {entry.specializationLabel ? ` / ${entry.specializationLabel}` : ''}
                    </Text>
                    <Text size='sm' c='dimmed'>
                      Level {entry.classLevel}
                    </Text>
                    <Divider my='sm' />
                    <Text size='sm' fw={700}>Features</Text>
                    {renderLines(entry.featureLabels)}
                    <Text size='sm' fw={700} mt='sm'>Resources</Text>
                    {renderLines(entry.resourceLabels)}
                    <Text size='sm' fw={700} mt='sm'>Spellcasting</Text>
                    {renderLines(entry.spellcastingLabels)}
                  </Card>
                ))}
              </Stack>
            )}
          </Stack>
        </Card>

        <Card radius='xl' p='xl' style={panelStyle}>
          <Stack gap='lg'>
            <Group gap='sm'>
              <BookOpen size={18} />
              <Title order={3}>Reference and Notes</Title>
            </Group>

            <Stack gap='sm'>
              <Text fw={700} size='sm'>Personality and backstory</Text>
              {renderLines([
                character.profile.personalityTraits,
                character.profile.ideals,
                character.profile.bonds,
                character.profile.flaws,
                character.profile.backstory
              ].filter((value): value is string => Boolean(value)))}
            </Stack>

            <Divider />

            <Stack gap='sm'>
              <Text fw={700} size='sm'>Campaign notes</Text>
              {renderLines([
                character.profile.organizations,
                character.profile.allies,
                character.profile.enemies,
                character.profile.notes
              ].filter((value): value is string => Boolean(value)))}
            </Stack>
          </Stack>
        </Card>
      </SimpleGrid>
    </Stack>
  )
}

export default Character
