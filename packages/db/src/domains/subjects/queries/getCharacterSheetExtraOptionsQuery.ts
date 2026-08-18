import type { DBLike } from '#types'

export interface CharacterSheetExtraCatalogCursor {
  id: string
  label: string
}

export interface CharacterSheetExtraCatalogOption {
  id: string
  label: string
  description?: string
}

export interface CharacterSheetExtraCatalogPage {
  items: CharacterSheetExtraCatalogOption[]
  nextCursor: CharacterSheetExtraCatalogCursor | null
}

interface ExtraCatalogQueryInput {
  kind: 'CREATURE' | 'VEHICLE'
  systemId: string
  userId: string
  query?: string
  cursor?: CharacterSheetExtraCatalogCursor
  limit: number
}

interface ExtraCatalogRow {
  id: string
  label: string
  description: string | null
}

function toPage(rows: ExtraCatalogRow[], limit: number): CharacterSheetExtraCatalogPage {
  const pageRows = rows.slice(0, limit)
  const lastPageRow = pageRows.at(-1)
  return {
    items: pageRows.map((row) => ({
      id: row.id,
      label: row.label,
      ...(row.description ? { description: row.description } : {})
    })),
    nextCursor: rows.length > limit && lastPageRow
      ? { id: lastPageRow.id, label: lastPageRow.label }
      : null
  }
}

export async function getCharacterSheetExtraOptionsQuery(
  db: DBLike,
  input: ExtraCatalogQueryInput
): Promise<CharacterSheetExtraCatalogPage> {
  const limit = Math.min(input.limit, 50)
  const withTextFilter = input.query ? `%${input.query}%` : undefined
  if (input.kind === 'CREATURE') {
    let query = db
      .selectFrom('creatures')
      .select(['id', 'label', 'description'])
      .where('system_id', '=', input.systemId)
      .where('status', '=', 'ACTIVE')
      .where((eb) => eb.or([eb('user_id', '=', input.userId), eb('is_master', '=', true)]))
    if (withTextFilter) query = query.where('label', 'ilike', withTextFilter)
    const cursor = input.cursor
    if (cursor) {
      query = query.where((eb) =>
        eb.or([
          eb('label', '>', cursor.label),
          eb.and([eb('label', '=', cursor.label), eb('id', '>', cursor.id)])
        ])
      )
    }
    return toPage((await query.orderBy('label').orderBy('id').limit(limit + 1).execute()) as ExtraCatalogRow[], limit)
  }

  let query = db
    .selectFrom('vehicles')
    .select(['id', 'label', 'description'])
    .where('system_id', '=', input.systemId)
    .where('status', '=', 'ACTIVE')
    .where((eb) => eb.or([eb('user_id', '=', input.userId), eb('is_master', '=', true)]))
  if (withTextFilter) query = query.where('label', 'ilike', withTextFilter)
  const cursor = input.cursor
  if (cursor) {
    query = query.where((eb) =>
      eb.or([
        eb('label', '>', cursor.label),
        eb.and([eb('label', '=', cursor.label), eb('id', '>', cursor.id)])
      ])
    )
  }
  return toPage((await query.orderBy('label').orderBy('id').limit(limit + 1).execute()) as ExtraCatalogRow[], limit)
}
