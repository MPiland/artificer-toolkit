import { describe, expect, it } from 'vitest'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { championMartialArchetype } from '@artificer-toolkit/source-data/srd/classes/champion.js'
import { cleric } from '@artificer-toolkit/source-data/srd/classes/cleric.js'
import { druid } from '@artificer-toolkit/source-data/srd/classes/druid.js'
import { fighter } from '@artificer-toolkit/source-data/srd/classes/fighter.js'
import { paladin } from '@artificer-toolkit/source-data/srd/classes/paladin.js'
import { ranger } from '@artificer-toolkit/source-data/srd/classes/ranger.js'
import { sorcerer } from '@artificer-toolkit/source-data/srd/classes/sorcerer.js'
import { wizard } from '@artificer-toolkit/source-data/srd/classes/wizard.js'
import { daylight } from '@artificer-toolkit/source-data/srd/spells/daylight.js'
import { fireball } from '@artificer-toolkit/source-data/srd/spells/fireball.js'
import { prismaticWall } from '@artificer-toolkit/source-data/srd/spells/prismatic-wall.js'
import {
  sortContentCatalogueItems,
  summarizeContentCatalogue
} from '@artificer-toolkit/rules-runtime/contentCatalogue'
import { api } from '../_generated/api'
import { importedSubject, publicationFixture } from '../../tests/fixtures/publication'
import { readVisibleCatalogue } from '../../tests/fixtures/contentSnapshotReaders'

// ADR 0036: the authored-content lists derive their rows, order, filters and summary from the
// snapshot `list` parts; this reads them as a browser does.

// The Classes the imported Spells name, so their labels resolve.
const classes = [
  cleric,
  druid,
  fighter,
  paladin,
  ranger,
  sorcerer,
  wizard,
  championMartialArchetype
]

async function fixture() {
  const result = await publicationFixture(
    import.meta.glob('/apps/apis/convex/**/*.*s'),
    import.meta.glob('../betterAuth/**/*.*s'),
    [
      [
        importedSubject({ subjectKind: 'BACKGROUND', ...acolyte, document: acolyte }),
        ...classes.map((subject) =>
          importedSubject({ subjectKind: 'CLASS', ...subject, document: subject })
        )
      ],
      [
        importedSubject({ subjectKind: 'SPELL', ...fireball, document: fireball }),
        importedSubject({ subjectKind: 'SPELL', ...prismaticWall, document: prismaticWall }),
        importedSubject({ subjectKind: 'SPELL', ...daylight, document: daylight })
      ]
    ]
  )
  // Homebrew that sorts among the master rows.
  for (const [subjectKind, subjectId] of [
    ['BACKGROUND', acolyte.id],
    ['SPELL', fireball.id]
  ] as const) {
    const draft = await result.first.caller.mutation(api.content.drafts.duplicate, {
      subjectKind,
      subjectId
    })
    if (!draft.updatedAt) throw new Error('Missing draft revision')
    await result.first.caller.mutation(api.content.publication.publishDraft, {
      subjectKind,
      subjectId: draft.subjectId,
      expectedDraftUpdatedAt: draft.updatedAt
    })
  }
  return result
}

describe('list parts as the authored-content lists read them', () => {
  it('lists the master rows and only the caller own homebrew, with the summary counts', async () => {
    const { t, first, second } = await fixture()

    const own = await readVisibleCatalogue(t, first.caller, 'BACKGROUND')
    expect(own.map((item) => item.provenance.kind).sort()).toEqual(['MASTER', 'OWNED'])
    expect(own.find((item) => item.provenance.kind === 'OWNED')).toMatchObject({
      permissions: { canEdit: true, canDelete: true }
    })
    expect(summarizeContentCatalogue('BACKGROUND', own)).toMatchObject({
      activeCount: 2,
      masterCount: 1,
      ownedCount: 1
    })

    const other = await readVisibleCatalogue(t, second.caller, 'BACKGROUND')
    expect(other.map((item) => item.provenance.kind)).toEqual(['MASTER'])
    expect(other[0]).toMatchObject({ permissions: { canEdit: false, canDelete: false } })
  }, 120_000)

  it('places a Subclass under its parent Class in family order', async () => {
    const { t, first } = await fixture()
    const items = await readVisibleCatalogue(t, first.caller, 'CLASS')
    const labels = sortContentCatalogueItems(items, 'family').map((item) => item.label)

    expect(items.find((item) => item.label === championMartialArchetype.label)).toMatchObject({
      parentClassId: fighter.id,
      parentClassLabel: fighter.label
    })
    expect(labels.indexOf(championMartialArchetype.label)).toBe(labels.indexOf(fighter.label) + 1)
  }, 120_000)

  it('labels Spells, sorts them by level and school, and lists the facets of every visible Spell', async () => {
    const { t, first } = await fixture()
    const items = await readVisibleCatalogue(t, first.caller, 'SPELL')

    expect(items.find((item) => item.label === fireball.label)).toMatchObject({
      level: 3,
      magicSchoolLabel: 'Evocation',
      classLabels: [sorcerer.label, wizard.label].sort((left, right) => left.localeCompare(right))
    })
    const byLevel = sortContentCatalogueItems(items, 'level').map((item) => item.level ?? 0)
    expect(byLevel).toEqual([...byLevel].sort((left, right) => left - right))
    const bySchool = sortContentCatalogueItems(items, 'school').map(
      (item) => item.magicSchoolLabel?.toLowerCase() ?? ''
    )
    expect(bySchool).toEqual([...bySchool].sort())
    const { spellFacets } = summarizeContentCatalogue('SPELL', items)
    expect(spellFacets?.levels.map(({ id }) => id)).toEqual([3, 9])
    expect(spellFacets?.classes.map(({ label }) => label)).toContain(wizard.label)
  }, 120_000)
})
