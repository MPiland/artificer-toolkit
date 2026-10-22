import { getAuthoringDefaultKind } from './authoringNodeDefaultRegistry'

export function hasAuthoringDefaultKind(mapId: string): boolean {
  try {
    getAuthoringDefaultKind(mapId)
    return true
  } catch {
    return false
  }
}
