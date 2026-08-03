import { EFFECT_KIND } from '#core'

export type CommandManifestAuthored = {
  id: string
  effectKind: typeof EFFECT_KIND.COMMAND_MANIFEST
  manifestId: string
  behaviorId?: string
}
