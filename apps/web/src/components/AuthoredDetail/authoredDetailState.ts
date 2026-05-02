import type { z } from 'zod'
import type {
  AuthoredContentPermissionsDto,
  AuthoredContentProvenanceDto,
  AuthoredDraftDto
} from '@artificer-toolkit/schema'
import { parseAuthoredDraftPayload } from '#app/data/authoredDrafts'

export type AuthoredDetailViewMode = 'active' | 'draft' | 'invalid-draft-only' | 'missing'

export interface AuthoredDetailResponse<TItem> {
  item: TItem
  permissions: AuthoredContentPermissionsDto
  provenance: AuthoredContentProvenanceDto
}

export interface ResolvedAuthoredDetailState<TItem> {
  activeItem: TItem | null
  draft: AuthoredDraftDto | null
  draftItem: TItem | null
  hasInvalidDraft: boolean
  item: TItem | null
  mode: AuthoredDetailViewMode
  permissions: AuthoredContentPermissionsDto
  provenance: AuthoredContentProvenanceDto
}

const defaultDraftPermissions: AuthoredContentPermissionsDto = {
  canCopy: false,
  canDelete: true,
  canEdit: true,
  canView: true
}

const ownedDraftProvenance: AuthoredContentProvenanceDto = {
  kind: 'OWNED',
  ownerUserId: null
}

export function resolveAuthoredDetailState<TItem>({
  draft,
  response,
  schema,
  viewActive
}: {
  draft: AuthoredDraftDto | null | undefined
  response: AuthoredDetailResponse<TItem> | null | undefined
  schema: z.ZodType<TItem>
  viewActive?: boolean
}): ResolvedAuthoredDetailState<TItem> {
  const activeItem = response?.item ?? null
  const parsedDraft = parseAuthoredDraftPayload(draft ?? null, schema)
  const draftItem = parsedDraft.item ?? null

  if (parsedDraft.isInvalid && !activeItem) {
    return {
      activeItem,
      draft: parsedDraft.draft,
      draftItem,
      hasInvalidDraft: true,
      item: null,
      mode: 'invalid-draft-only',
      permissions: defaultDraftPermissions,
      provenance: ownedDraftProvenance
    }
  }

  if (draftItem && !viewActive) {
    return {
      activeItem,
      draft: parsedDraft.draft,
      draftItem,
      hasInvalidDraft: false,
      item: draftItem,
      mode: 'draft',
      permissions: response?.permissions ?? defaultDraftPermissions,
      provenance: response?.provenance ?? ownedDraftProvenance
    }
  }

  if (activeItem) {
    return {
      activeItem,
      draft: parsedDraft.draft,
      draftItem,
      hasInvalidDraft: parsedDraft.isInvalid,
      item: activeItem,
      mode: 'active',
      permissions: response?.permissions ?? defaultDraftPermissions,
      provenance: response?.provenance ?? ownedDraftProvenance
    }
  }

  return {
    activeItem,
    draft: parsedDraft.draft,
    draftItem,
    hasInvalidDraft: parsedDraft.isInvalid,
    item: null,
    mode: 'missing',
    permissions: defaultDraftPermissions,
    provenance: ownedDraftProvenance
  }
}
