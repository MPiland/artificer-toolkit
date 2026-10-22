import type {
  CharacterBuilderIntentCacheDto,
  CharacterBuilderPayloadDto
} from '@artificer-toolkit/schema/api/characterBuilder'
import type {
  CharacterBuilderFeatureSourceHint,
  CharacterBuilderPreviewOutput
} from '@artificer-toolkit/schema/api/characterBuilderQueries'
import type {
  ContentSnapshotKind,
  ContentSnapshotManifestDto
} from '@artificer-toolkit/schema/api/contentSnapshots'
import type { CharacterAuthoredDto } from '@artificer-toolkit/schema/subjects/character'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'

/**
 * One Builder evaluation in the browser worker (resolution or finalization preview), from the
 * open draft, the form values, the live manifest and the System (D67).
 */
export type BuilderEvaluationRequest = {
  operation: 'resolve' | 'preview'
  manifest: ContentSnapshotManifestDto
  system: SystemAuthoredDto
  draft: {
    expectedDraftId: string
    mode: 'create' | 'edit'
    userId: string
    publicId: string
    baseActiveUpdatedAt: string | null
    builderIntent?: CharacterBuilderIntentCacheDto
  }
  character: CharacterAuthoredDto
  previousCharacter: CharacterAuthoredDto | null
}

type BuilderEvaluationOutput =
  | { operation: 'resolve'; payload: CharacterBuilderPayloadDto }
  | {
      operation: 'preview'
      preview: CharacterBuilderPreviewOutput
      /** The roots holding the previewed Character's standalone features, sent with commit. */
      featureSourceHints: CharacterBuilderFeatureSourceHint[]
    }

/** A failed evaluation names the content kind that could not load, when one did not. */
export type BuilderEvaluationResult =
  | { ok: true; output: BuilderEvaluationOutput }
  | { ok: false; failedKind: ContentSnapshotKind | null }

export type BuilderEvaluationWorkerRequest =
  | { type: 'evaluate'; id: number; request: BuilderEvaluationRequest }
  | { type: 'token'; id: number; token: string | null }

export type BuilderEvaluationWorkerMessage =
  | { type: 'result'; id: number; result: BuilderEvaluationResult }
  | { type: 'loading'; kinds: ContentSnapshotKind[] }
  | { type: 'token'; id: number; refresh: boolean }
