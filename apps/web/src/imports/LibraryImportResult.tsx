import { Alert, Badge, Button, Card, Group, Stack, Text } from '@mantine/core'
import type { ImportResultReportDto } from '@artificer-toolkit/schema/api/imports'
import {
  buildBackgroundRouteParams,
  buildCharacterRouteParams,
  buildClassRouteParams,
  buildCreatureRouteParams,
  buildEquipmentRouteParams,
  buildFeatRouteParams,
  buildRaceRouteParams,
  buildSpellRouteParams,
  buildVehicleRouteParams
} from '#app/routing/authoredRouteParams'
import { LibraryImportIssues } from './LibraryImportIssues'

export function LibraryImportResult({
  result,
  onImportMore
}: {
  result: ImportResultReportDto
  onImportMore: () => void
}) {
  return (
    <Stack gap='lg'>
      <Alert color={result.summary.failed ? 'yellow' : 'green'}>
        {result.summary.created} created, {result.summary.updated} updated, {result.summary.skipped}{' '}
        skipped, and {result.summary.failed} failed.
      </Alert>
      {(['CREATED', 'UPDATED', 'SKIPPED', 'FAILED'] as const).map((outcome) => {
        const items = result.items.filter((item) => item.outcome === outcome)
        if (!items.length) return null
        return (
          <Stack key={outcome} gap='sm'>
            <Text fw={600}>{outcome[0] + outcome.slice(1).toLowerCase()}</Text>
            {items.map((item) => (
              <Card key={item.entryId} padding='md' withBorder>
                <Group justify='space-between'>
                  <div>
                    <Text fw={600}>{item.label ?? item.name}</Text>
                    {item.label && item.label !== item.name ? (
                      <Text c='dimmed' size='sm'>
                        Source: {item.name}
                      </Text>
                    ) : null}
                    {item.issues.length ? <LibraryImportIssues issues={item.issues} /> : null}
                  </div>
                  <Group gap='sm'>
                    <Badge color={outcomeColor(item.outcome)}>{item.outcome.toLowerCase()}</Badge>
                    {item.publicId && item.destination ? (
                      <Button
                        component='a'
                        href={destinationHref(
                          item.destination,
                          item.publicId,
                          item.label ?? item.name
                        )}
                        size='xs'
                      >
                        Open
                      </Button>
                    ) : null}
                  </Group>
                </Group>
              </Card>
            ))}
          </Stack>
        )
      })}
      <Button style={{ alignSelf: 'flex-start' }} variant='default' onClick={onImportMore}>
        Import more
      </Button>
    </Stack>
  )
}

function outcomeColor(outcome: ImportResultReportDto['items'][number]['outcome']): string {
  return outcome === 'FAILED' ? 'red' : outcome === 'SKIPPED' ? 'yellow' : 'green'
}

function destinationHref(
  destination: ImportResultReportDto['items'][number]['destination'],
  publicId: string,
  label: string
): string {
  if (!destination || destination.kind === 'CHARACTER_BUILDER_DRAFT') {
    const params = buildCharacterRouteParams(publicId, label)
    return `/characters/${params.characterPublicId}/${params.characterSlug}/edit`
  }

  const suffix = destination.kind === 'AUTHORED_DRAFT' ? '/edit' : ''

  switch (destination.subjectKind) {
    case 'BACKGROUND': {
      const params = buildBackgroundRouteParams(publicId, label)
      return `/backgrounds/${params.backgroundPublicId}/${params.backgroundSlug}${suffix}`
    }
    case 'CLASS': {
      const params = buildClassRouteParams(publicId, label)
      return `/classes/${params.classPublicId}/${params.classSlug}${suffix}`
    }
    case 'CREATURE': {
      const params = buildCreatureRouteParams(publicId, label)
      return `/creatures/${params.creaturePublicId}/${params.creatureSlug}${suffix}`
    }
    case 'EQUIPMENT': {
      const params = buildEquipmentRouteParams(publicId, label)
      return `/equipment/${params.equipmentPublicId}/${params.equipmentSlug}${suffix}`
    }
    case 'FEAT': {
      const params = buildFeatRouteParams(publicId, label)
      return `/feats/${params.featPublicId}/${params.featSlug}${suffix}`
    }
    case 'RACE': {
      const params = buildRaceRouteParams(publicId, label)
      return `/races/${params.racePublicId}/${params.raceSlug}${suffix}`
    }
    case 'SPELL': {
      const params = buildSpellRouteParams(publicId, label)
      return `/spells/${params.spellPublicId}/${params.spellSlug}${suffix}`
    }
    case 'VEHICLE': {
      const params = buildVehicleRouteParams(publicId, label)
      return `/vehicles/${params.vehiclePublicId}/${params.vehicleSlug}${suffix}`
    }
  }
}
