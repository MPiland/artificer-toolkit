import { describe, expect, it } from 'vitest'
import { srdBaselineContent } from '../srd/index.js'
import { cloneAuthoredItem } from '@artificer-toolkit/shared/utils'

type ScalarLeaf = { path: string; key: string | undefined; value: unknown }

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function flattenScalars(value: unknown, path = '', key?: string): ScalarLeaf[] {
  if (Array.isArray(value)) {
    if (value.length === 0) return [{ path, key, value }]
    return value.flatMap((item, index) => flattenScalars(item, `${path}[${index}]`, key))
  }

  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value)
    if (entries.length === 0) return [{ path, key, value }]
    return entries.flatMap(([entryKey, entryValue]) =>
      flattenScalars(entryValue, path ? `${path}.${entryKey}` : entryKey, entryKey)
    )
  }

  return [{ path, key, value }]
}

function isReferenceKey(key: string | undefined): boolean {
  return key === 'id' || key?.endsWith('Id') === true || key?.endsWith('Ids') === true
}

describe('cloneAuthoredItem canonical authored corpus conformance', () => {
  it('clones every canonical authored domain without changing source or non-identity data', () => {
    const clonedIds = new Set<string>()
    const ownedReferenceKinds = new Set<string>()
    const externalReferenceKinds = new Set<string>()
    let itemCount = 0
    let ownedIdCount = 0
    let referenceCount = 0

    for (const [domain, items] of Object.entries(srdBaselineContent.subjects)) {
      expect(items.length, `${domain} should contain authored records`).toBeGreaterThan(0)

      for (const item of items) {
        itemCount += 1
        const source = structuredClone(item)
        const cloned = cloneAuthoredItem(item)
        const inputLeaves = flattenScalars(item)
        const outputLeaves = new Map(flattenScalars(cloned).map((leaf) => [leaf.path, leaf]))
        const ownedIdMap = new Map<string, string>()
        const itemOwnedIds = inputLeaves.filter(
          (leaf) => leaf.key === 'id' && typeof leaf.value === 'string'
        )
        expect([...outputLeaves.keys()].sort()).toEqual(inputLeaves.map((leaf) => leaf.path).sort())

        for (const leaf of itemOwnedIds) {
          ownedIdCount += 1
          if (typeof leaf.value !== 'string') continue
          const oldId = leaf.value
          const newLeaf = outputLeaves.get(leaf.path)
          expect(newLeaf?.value, leaf.path).toEqual(expect.any(String))
          const newId = newLeaf?.value
          expect(newId, leaf.path).not.toBe(oldId)
          expect(newId, leaf.path).toMatch(UUID_PATTERN)
          if (typeof newId !== 'string') continue

          const existing = ownedIdMap.get(oldId)
          if (existing) expect(newId).toBe(existing)
          else {
            expect(clonedIds.has(newId), `UUID collision for ${oldId}`).toBe(false)
            ownedIdMap.set(oldId, newId)
            clonedIds.add(newId)
          }
        }

        for (const inputLeaf of inputLeaves) {
          const outputLeaf = outputLeaves.get(inputLeaf.path)
          expect(outputLeaf, inputLeaf.path).toBeDefined()
          if (!outputLeaf) continue

          if (inputLeaf.path === 'label') {
            expect(outputLeaf.value).toBe(`${inputLeaf.value} Copy`)
            continue
          }
          if (inputLeaf.path === 'status') {
            expect(outputLeaf.value).toBe('DRAFT')
            continue
          }

          const oldValue = inputLeaf.value
          const isReference = isReferenceKey(inputLeaf.key)
          if (isReference) {
            referenceCount += 1
            const referenceKind = inputLeaf.key ?? '<unknown>'
            if (typeof oldValue === 'string' && ownedIdMap.has(oldValue)) {
              ownedReferenceKinds.add(referenceKind)
              expect(outputLeaf.value).toBe(ownedIdMap.get(oldValue))
            } else externalReferenceKinds.add(referenceKind)
          }

          if (!(isReference && typeof oldValue === 'string' && ownedIdMap.has(oldValue))) {
            expect(outputLeaf.value).toEqual(oldValue)
          }
        }

        expect(item).toEqual(source)
      }
    }

    expect(Object.keys(srdBaselineContent.subjects)).toHaveLength(8)
    expect(itemCount).toBe(1057)
    expect(itemCount).toBeGreaterThan(0)
    expect(ownedIdCount).toBeGreaterThan(0)
    expect(referenceCount).toBeGreaterThan(0)
    expect(ownedReferenceKinds.size).toBeGreaterThan(0)
    for (const kind of [
      'abilityDefinitionId',
      'equipmentId',
      'parentClassId',
      'spellIds',
      'systemId',
      'userId'
    ]) {
      expect(externalReferenceKinds.has(kind), kind).toBe(true)
    }
    expect(clonedIds.size).toBeGreaterThan(0)
    expect([...ownedReferenceKinds].some((kind) => kind !== 'id')).toBe(true)
  })
})
