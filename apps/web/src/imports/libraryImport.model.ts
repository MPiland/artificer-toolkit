import {
  IMPORT_MAX_BATCH_BYTES,
  IMPORT_MAX_ENTRIES,
  IMPORT_MAX_ENTRY_BYTES,
  type ImportBatchInputDto,
  type ImportSourceDto
} from '@artificer-toolkit/schema/api/imports'

type JsonSource = Extract<ImportSourceDto, 'FOUNDRY_DND5E' | 'ARTIFICER_JSON'>

export function parseLinks(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((link) => link.trim())
    .filter(Boolean)
}

export async function buildBatch(
  source: ImportSourceDto,
  links: string,
  files: File[]
): Promise<ImportBatchInputDto> {
  if (source === 'DND_BEYOND') {
    const parsedLinks = parseLinks(links)
    if (!parsedLinks.length) throw new Error('Add at least one D&D Beyond character-sheet link.')
    if (parsedLinks.length > IMPORT_MAX_ENTRIES)
      throw new Error(`You can import up to ${IMPORT_MAX_ENTRIES} links at once.`)
    return {
      source,
      entries: parsedLinks.map((url, index) => ({ entryId: `link-${index + 1}`, url }))
    }
  }

  if (!files.length) throw new Error('Choose at least one JSON file.')
  if (files.length > IMPORT_MAX_ENTRIES)
    throw new Error(`You can import up to ${IMPORT_MAX_ENTRIES} files at once.`)
  const totalBytes = files.reduce((total, file) => total + file.size, 0)
  if (files.some((file) => file.size > IMPORT_MAX_ENTRY_BYTES))
    throw new Error('Import files must be 10 MiB or smaller.')
  if (totalBytes > IMPORT_MAX_BATCH_BYTES)
    throw new Error('The import batch must be 25 MiB or smaller.')
  return {
    source: source as JsonSource,
    entries: await Promise.all(
      files.map(async (file, index) => ({
        entryId: `file-${index + 1}`,
        name: file.name,
        text: await file.text()
      }))
    )
  }
}

export function hasImportInput(source: ImportSourceDto, links: string, files: File[]): boolean {
  return source === 'DND_BEYOND' ? parseLinks(links).length > 0 : files.length > 0
}
