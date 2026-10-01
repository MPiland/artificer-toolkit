import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  CharacterPreparationOptionDto,
  CharacterPreparationOptionsResponseDto
} from '@artificer-toolkit/schema/api/characterPreparationOptions'
import { presentCampaignPlainText } from '@artificer-toolkit/shared/campaign/textPolicy'
import { contentOrigin } from './contentOrigin'
import { createContentSnapshotStore } from './contentSnapshotStore'
import {
  isContentSnapshotManifestUpdating,
  listContentSnapshotManifestObjects
} from './manifestObjects'
import { useContentSnapshotToken } from './queries'
import { holdPrivateContentSnapshots } from './privateContent'

/** Preparation reads compact Spell metadata once per immutable source revision. */
export function useCharacterPreparationCatalogue(options?: CharacterPreparationOptionsResponseDto) {
  const queryClient = useQueryClient()
  const clearedOptions = useRef(new WeakSet<CharacterPreparationOptionsResponseDto>())
  const [, setClearVersion] = useState(0)
  const cleared = options !== undefined && clearedOptions.current.has(options)
  const getToken = useContentSnapshotToken()
  const store = useMemo(
    () => (contentOrigin ? createContentSnapshotStore({ contentOrigin, getToken }) : null),
    [getToken]
  )
  useEffect(
    () =>
      holdPrivateContentSnapshots(() => {
        if (options) clearedOptions.current.add(options)
        setClearVersion((version) => version + 1)
        queryClient.removeQueries({ queryKey: ['character-preparation-catalogue'] })
        store?.retain(new Set(), ['list']).catch(() => undefined)
      }),
    [options, queryClient, store]
  )
  const manifest =
    !cleared && options?.classes.length && options.catalogue.kind === 'SNAPSHOTS'
      ? options.catalogue.manifest
      : undefined
  const locations = useMemo(
    () =>
      manifest
        ? listContentSnapshotManifestObjects(manifest, ['list']).filter(
            (location) => location.header.kind === 'SPELL'
          )
        : [],
    [manifest]
  )
  const revision =
    options?.catalogue.kind === 'INLINE'
      ? JSON.stringify(options.catalogue.spells)
      : locations
          .map((location) => location.ref.sha256)
          .sort()
          .join(':')
  const objects = useQuery({
    queryKey: ['character-preparation-catalogue', options?.characterId, revision],
    queryFn:
      manifest && store
        ? () => Promise.all(locations.map((location) => store.read(location)))
        : skipToken,
    staleTime: Infinity
  })
  const spells = useMemo(() => {
    if (cleared) return undefined
    if (options?.catalogue.kind === 'INLINE') return options.catalogue.spells
    if (!objects.data || !manifest) return undefined
    const byId = new Map<string, CharacterPreparationOptionDto>()
    for (const object of objects.data) {
      if (object.kind !== 'SPELL' || object.part !== 'list') continue
      for (const spell of object.roots) {
        byId.set(spell.id, {
          spellId: spell.id,
          label: manifest.campaign
            ? presentCampaignPlainText(spell.label, manifest.campaign.contentMaturity)
            : spell.label,
          level: spell.level
        })
      }
    }
    return [...byId.values()]
  }, [cleared, manifest, objects.data, options])
  const isError = cleared || Boolean(manifest && (!store || objects.isError))
  return {
    spells,
    revision,
    updating: manifest ? isContentSnapshotManifestUpdating(manifest) : false,
    isPending: Boolean(manifest && !isError && objects.isPending),
    isError
  }
}
