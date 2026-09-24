import type * as core from 'zod/v4/core'
import type {
  AuthoredContentPermissionsDto,
  AuthoredContentProvenanceDto
} from '@artificer-toolkit/schema/api/common'
import type { AuthoredDraftDto } from '@artificer-toolkit/schema/api/content'
import { parseAuthoredDraftPayload } from '#app/data/authoredDrafts'

export type AuthoredDetailViewMode = 'active' | 'draft' | 'invalid-draft-only' | 'missing'

export interface AuthoredDetailResponse<TItem> {
  item: TItem | null
  hasDraft: boolean
  permissions: AuthoredContentPermissionsDto
  provenance: AuthoredContentProvenanceDto
}

export interface ResolvedAuthoredDetailState<TItem> {
  activeItem: TItem | null
  canViewActive: boolean
  draft: AuthoredDraftDto | null
  draftItem: TItem | null
  hasInvalidDraft: boolean
  hasActiveContent: boolean
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
  schema: core.$ZodType<TItem>
  viewActive?: boolean
}): ResolvedAuthoredDetailState<TItem> {
  const activeItem = response?.item ?? null
  const parsedDraft = parseAuthoredDraftPayload(draft ?? null, schema)
  const draftItem = parsedDraft.item ?? null
  const draftHasActiveContent = parsedDraft.draft?.draftState === 'ACTIVE_WITH_DRAFT'
  const canViewActive = Boolean(
    (parsedDraft.draft && draftHasActiveContent) || (viewActive && response?.hasDraft)
  )
  const hasActiveContent =
    Boolean(activeItem) &&
    (viewActive === true || !parsedDraft.draft || !draftItem || draftHasActiveContent)

  if (parsedDraft.isInvalid && !activeItem) {
    return {
      activeItem,
      canViewActive: false,
      draft: parsedDraft.draft,
      draftItem,
      hasInvalidDraft: true,
      hasActiveContent: false,
      item: null,
      mode: 'invalid-draft-only',
      permissions: response?.permissions ?? defaultDraftPermissions,
      provenance: response?.provenance ?? ownedDraftProvenance
    }
  }

  if (draftItem && !viewActive) {
    return {
      activeItem,
      canViewActive,
      draft: parsedDraft.draft,
      draftItem,
      hasInvalidDraft: false,
      hasActiveContent,
      item: draftItem,
      mode: 'draft',
      permissions: response?.permissions ?? defaultDraftPermissions,
      provenance: response?.provenance ?? ownedDraftProvenance
    }
  }

  if (activeItem) {
    return {
      activeItem,
      canViewActive,
      draft: parsedDraft.draft,
      draftItem,
      hasInvalidDraft: parsedDraft.isInvalid,
      hasActiveContent: true,
      item: activeItem,
      mode: 'active',
      permissions: response?.permissions ?? defaultDraftPermissions,
      provenance: response?.provenance ?? ownedDraftProvenance
    }
  }

  return {
    activeItem,
    canViewActive: false,
    draft: parsedDraft.draft,
    draftItem,
    hasInvalidDraft: parsedDraft.isInvalid,
    hasActiveContent: false,
    item: null,
    mode: 'missing',
    permissions: defaultDraftPermissions,
    provenance: ownedDraftProvenance
  }
}
