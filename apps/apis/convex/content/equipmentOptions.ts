import {
  authoredEquipmentOptionFactsSchema,
  authoredEquipmentOptionsInputSchema,
  authoredEquipmentOptionsSchema
} from '@artificer-toolkit/schema/api/authoredOptions'
import type { NodeRuntimeQueryRow } from '@artificer-toolkit/authoring/nodeRuntime'
import type { QueryCtx } from '../_generated/server'
import { readAuthoringSources } from './sources'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import { query } from '../lib/queries'
import { requireIdentity } from '../lib/identity'
import { contentStream } from './streams'
import { isImportRowVisible } from '../imports/visibility'

export const list = query({
  args: zodToConvexFields(authoredEquipmentOptionsInputSchema.shape),
  returns: zodToConvex(authoredEquipmentOptionsSchema),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const { systemId, excludeVariants } = authoredEquipmentOptionsInputSchema.parse(args)
    const { equipment } = await readEquipmentOptions(ctx, systemId, identity.userId)
    return authoredEquipmentOptionsSchema.parse(
      equipment
        .filter((item) => !excludeVariants || item.category !== 'VARIANT')
        .map(({ id, label }) => ({ value: id, label }))
    )
  }
})

export async function readEquipmentOptions(ctx: QueryCtx, systemId: string, userId: string) {
  // ponytail: these existing inline selectors require a complete set. Beyond 500 visible
  // items/100 sources, add paginated option search; never truncate normalization inputs.
  const sources = await readAuthoringSources(ctx, systemId, userId)
  const equipment: NodeRuntimeQueryRow[] = []
  const properties: NodeRuntimeQueryRow[] = []
  for (const source of sources) {
    const ownerUserId = source.kind === 'USER' ? source.ownerUserId : undefined
    const roots = await contentStream(ctx.db)
      .query('authoredRoots')
      .withIndex('by_contentSourceId_subjectKind_ownerUserId', (q) =>
        q
          .eq('contentSourceId', source.id)
          .eq('subjectKind', 'EQUIPMENT')
          .eq('ownerUserId', ownerUserId)
      )
      .filterWith((root) => isImportRowVisible(ctx, root.importJobId))
      .take(501 - equipment.length)
    if (equipment.length + roots.length > 500) {
      throw new Error('Equipment authoring options require paginated search.')
    }
    for (const root of roots) {
      if (root.systemId !== systemId) throw new Error('Stored equipment System mismatch.')
      if (!root.equipmentOptions)
        throw new Error('Equipment authoring options are not materialized.')
      const facts = authoredEquipmentOptionFactsSchema.parse(root.equipmentOptions)
      if (facts.checksum !== root.checksum)
        throw new Error('Stored equipment option checksum mismatch.')
      equipment.push({
        id: root.id,
        label: root.label,
        category: facts.category
      })
      properties.push(
        ...facts.properties.map((code) => ({
          equipment_id: root.id,
          property_code: code
        }))
      )
    }
  }
  equipment.sort(
    (a, b) =>
      String(a.label).localeCompare(String(b.label)) || String(a.id).localeCompare(String(b.id))
  )
  return { equipment, equipment_properties: properties }
}
