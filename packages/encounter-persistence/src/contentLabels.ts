import type { EncounterReadPorts } from './ports.js'

/**
 * The label of content an Encounter commit names (an action, area or legendary action). The content
 * was read to execute the command, so a missing label is a dangling reference and fails loudly.
 */
export async function requireEncounterContentLabel(
  ports: Pick<EncounterReadPorts, 'readContentLabel'>,
  id: string
): Promise<string> {
  const label = await ports.readContentLabel(id)
  if (label === null) throw new Error(`Encounter content "${id}" has no readable label.`)
  return label
}
