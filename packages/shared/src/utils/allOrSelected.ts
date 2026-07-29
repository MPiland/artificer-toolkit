import type { AUTHORING_MODE_KIND } from '#core'

export type AllOrSelected<TSelected> =
  | { authoringModeKind: typeof AUTHORING_MODE_KIND.ALL }
  | ({ authoringModeKind: typeof AUTHORING_MODE_KIND.SELECTED } & TSelected)

export type Selectable<TSelected, TExtra extends Record<string, unknown> = Record<never, never>> =
  | ({ authoringModeKind: typeof AUTHORING_MODE_KIND.ALL } & TExtra)
  | ({ authoringModeKind: typeof AUTHORING_MODE_KIND.SELECTED } & TSelected & TExtra)
