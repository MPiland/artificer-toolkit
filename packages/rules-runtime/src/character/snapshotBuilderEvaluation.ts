import type {
  CharacterBuilderIntentCacheDto,
  CharacterBuilderPayloadDto
} from '@artificer-toolkit/schema/api/characterBuilder'
import type { CharacterBuilderPreviewOutput } from '@artificer-toolkit/schema/api/characterBuilderQueries'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import type { CampaignContentMaturity } from '@artificer-toolkit/shared/campaign/textPolicy'
import { createEmptyCharacterAuthored } from '@artificer-toolkit/shared/character'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'

import {
  resolveCharacterBuilderPayload,
  toCharacterBuilderPreviewOutput
} from './builderPayload.js'
import { prepareCharacterBuilderFromContext } from './builderPreparation.js'
import {
  assembleCharacterBuilderContext,
  prepareCharacterRuleContext,
  type CharacterBuilderCatalogueReaders,
  type CharacterRuleContextReaders
} from './contextPreparation.js'

/**
 * One Builder evaluation over content snapshot readers (ADR 0036 S6): the browser's replacement for
 * `builder.resolve` and `builder.preview`. `character` is the draft candidate; its Sheet state is
 * replaced by the active Character's, as the server does. The System is an input until it is
 * snapshotted (D67).
 */
export type SnapshotCharacterBuilderInput = {
  character: CharacterAuthored
  previousCharacter: CharacterAuthored | null
  mode: 'create' | 'edit'
  system: SystemAuthoredDto
  builderIntent?: CharacterBuilderIntentCacheDto
  publicId: string
  baseActiveUpdatedAt: string | null
  contentMaturity: CampaignContentMaturity | null
}

type SnapshotBuilderReaders = CharacterRuleContextReaders & CharacterBuilderCatalogueReaders

async function assembleSnapshotContext(
  input: SnapshotCharacterBuilderInput,
  readers: SnapshotBuilderReaders,
  scope: 'selectors' | 'resolution'
) {
  const character = {
    ...input.character,
    state: input.previousCharacter?.state ?? createEmptyCharacterAuthored(input.character).state
  }
  const context = await assembleCharacterBuilderContext(
    character,
    await prepareCharacterRuleContext(character, input.system, undefined, readers),
    readers,
    scope
  )
  return { character, context }
}

/** The payload `builder.resolve` returns for the same candidate and sources. */
export async function resolveSnapshotCharacterBuilderPayload(
  input: SnapshotCharacterBuilderInput,
  readers: SnapshotBuilderReaders
): Promise<CharacterBuilderPayloadDto> {
  const { character, context } = await assembleSnapshotContext(input, readers, 'selectors')
  return resolveCharacterBuilderPayload(character, context, input)
}

/** The output `builder.preview` returns for the same candidate and sources. */
export async function previewSnapshotCharacterBuilder(
  input: SnapshotCharacterBuilderInput,
  readers: SnapshotBuilderReaders
): Promise<CharacterBuilderPreviewOutput> {
  const { context } = await assembleSnapshotContext(input, readers, 'resolution')
  const prepared = await prepareCharacterBuilderFromContext({
    character: input.character,
    current: input.previousCharacter,
    mode: input.mode,
    context
  })
  return toCharacterBuilderPreviewOutput(prepared, input.previousCharacter, input.contentMaturity)
}
