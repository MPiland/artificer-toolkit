import { describe, expect, it } from 'vitest'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { authoredDraftCommandInputSchema } from '@artificer-toolkit/schema/api/authoredDrafts'
import { fighter } from '@artificer-toolkit/source-data/srd/classes/fighter.js'
import { human } from '@artificer-toolkit/source-data/srd/races/human.js'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { SRD_LANGUAGES } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { characterBuilderResolveInputSchema } from '@artificer-toolkit/schema/api/characterBuilderQueries'
import { evaluateBuilderCandidate } from '../../tests/fixtures/builderEvaluation'
import { importedSubject, importSeededSubjects } from '../../tests/fixtures/publication'
import { fixture, input } from '../../tests/fixtures/characters'
import { readyCharacterFixture } from '../../tests/fixtures/readyCharacter'
import { api } from '../_generated/api'

type Test = Awaited<ReturnType<typeof fixture>>['t']
type Actor = Awaited<ReturnType<typeof fixture>>['owner']

// The Builder evaluates in the browser from content snapshots (ADR 0036 S6); these run that path
// over candidates parsed as commit parses its input.
async function resolveCandidate(t: Test, actor: Actor, candidate: unknown) {
  const request = characterBuilderResolveInputSchema.parse(candidate)
  return (await evaluateBuilderCandidate(t, actor.caller, actor.userId, request)).resolve()
}

async function previewCandidate(t: Test, actor: Actor, candidate: unknown) {
  const request = characterBuilderResolveInputSchema.parse(candidate)
  return (await evaluateBuilderCandidate(t, actor.caller, actor.userId, request)).preview()
}

describe('native Character Builder choices', () => {
  it('resolves canonical chosen grants against the current System vocabulary', async () => {
    const { t, owner } = await fixture()
    const background = { ...acolyte, features: [], startingEquipment: undefined }
    await importSeededSubjects(t, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: [
        importedSubject({ subjectKind: 'BACKGROUND', ...background, document: background })
      ]
    })
    const draft = await owner.caller.mutation(api.characters.drafts.create, input())
    const character = {
      ...draft.payload.character,
      intent: {
        ...draft.payload.character.intent,
        background: { backgroundId: background.id }
      }
    }
    const candidate = { expectedDraftId: draft.id, mode: 'create' as const, character }
    const initial = await resolveCandidate(t, owner, candidate)
    const choice = initial.view.background.grantChoices[0]
    if (!choice) throw new Error('Missing canonical language choice.')
    expect(choice.requiredCount).toBe(2)
    expect(choice.proficiencyKind).toBe('LANGUAGE')
    const targetIds = choice.options.slice(0, 2).map((option) => option.id)
    expect(targetIds).toHaveLength(2)
    character.intent.chosenGrantSelections = [
      {
        id: crypto.randomUUID(),
        grantId: choice.grantId,
        source: choice.source,
        timing: choice.timing,
        targetIds
      }
    ]
    const selected = await resolveCandidate(t, owner, candidate)
    expect(selected.view.background.grantChoices[0]?.selectedTargetIds).toEqual(targetIds)
    expect(selected.resolution.outstandingChoices).toEqual([])
    expect(selected.resolution.validations).toEqual([])
    character.intent.chosenGrantSelections[0]!.targetIds = [targetIds[0]!, crypto.randomUUID()]
    const invalid = await resolveCandidate(t, owner, candidate)
    expect(
      invalid.resolution.validations.some(
        (issue) => issue.code === 'CHOSEN_GRANT_SELECTION_INVALID'
      )
    ).toBe(true)
    expect(await owner.caller.query(api.characters.drafts.get, { id: draft.characterId })).toEqual(
      draft
    )
  }, 15_000)

  it.each(['RACE', 'FEATURE', 'FEAT'] as const)(
    'resolves %s feature readiness and current policy eligibility without persisting candidate selections',
    async (sourceKind) => {
      const { t, owner } = await fixture()
      const featureId = crypto.randomUUID()
      const noviceId = crypto.randomUUID()
      const veteranId = crypto.randomUUID()
      const race = {
        ...human,
        features: [
          {
            id: featureId,
            label: 'Training',
            description: '',
            order: 0,
            availableAtLevel: 1,
            optionChoices: [{ level: 1, count: 1 }],
            options: [
              { id: noviceId, label: 'Novice', description: '', order: 0 },
              {
                id: veteranId,
                label: 'Veteran',
                description: '',
                order: 1,
                restrictions: {
                  id: crypto.randomUUID(),
                  groups: [
                    {
                      id: crypto.randomUUID(),
                      order: 0,
                      contexts: [
                        {
                          id: crypto.randomUUID(),
                          order: 0,
                          subject: 'CHARACTER',
                          conditions: [
                            {
                              id: crypto.randomUUID(),
                              order: 0,
                              kind: 'PREDICATE',
                              constraint: 'INCLUDE',
                              predicateCode: 'CLASS_LEVEL',
                              classIds: [fighter.id],
                              min: 2
                            }
                          ]
                        }
                      ]
                    }
                  ]
                }
              }
            ]
          }
        ]
      }
      const baseClass = {
        ...fighter,
        features: [],
        proficiencies: [],
        startingEquipment: { id: crypto.randomUUID(), sets: [] }
      }
      const background = {
        ...acolyte,
        features: [],
        proficiencies: [],
        startingEquipment: undefined
      }
      const selectedRace = sourceKind === 'RACE' ? race : { ...race, features: [] }
      const featureOwner = {
        ...background,
        id: crypto.randomUUID(),
        label: 'Standalone feature owner',
        features:
          sourceKind === 'FEAT'
            ? [{ ...race.features[0]!, id: crypto.randomUUID(), label: 'Unrelated feature' }]
            : race.features
      }
      const feat = {
        id: crypto.randomUUID(),
        label: 'Training feat',
        description: '',
        userId: human.userId,
        systemId: human.systemId,
        grants: { proficiencies: acolyte.proficiencies },
        features: race.features
      }
      await importSeededSubjects(t, {
        contentSourceId: SRD_CONTENT_SOURCE.id,
        subjects: [
          importedSubject({ subjectKind: 'RACE', ...selectedRace, document: selectedRace }),
          importedSubject({ subjectKind: 'CLASS', ...baseClass, document: baseClass }),
          importedSubject({ subjectKind: 'BACKGROUND', ...background, document: background }),
          ...(sourceKind !== 'RACE'
            ? [
                importedSubject({
                  subjectKind: 'BACKGROUND',
                  ...featureOwner,
                  document: featureOwner
                })
              ]
            : []),
          ...(sourceKind === 'FEAT'
            ? [importedSubject({ subjectKind: 'FEAT', ...feat, document: feat })]
            : [])
        ]
      })
      const draft = await owner.caller.mutation(api.characters.drafts.create, input())
      const character = characterAuthoredDtoSchema.parse({
        ...draft.payload.character,
        label: 'Aria',
        intent: {
          ...draft.payload.character.intent,
          race: { raceId: race.id },
          background: { backgroundId: background.id },
          classes: [{ classId: baseClass.id, classLevel: 1 }],
          hitpoints: {
            method: 'FIXED',
            levels: [{ level: 1, classId: baseClass.id, classLevel: 1, value: 10 }]
          },
          abilities: {
            method: 'STANDARD_ARRAY',
            assignments: [
              { ability: 'STRENGTH', option: '15' },
              { ability: 'DEXTERITY', option: '14' },
              { ability: 'CONSTITUTION', option: '13' },
              { ability: 'INTELLIGENCE', option: '12' },
              { ability: 'WISDOM', option: '10' },
              { ability: 'CHARISMA', option: '8' }
            ]
          },
          featureAcquisitions: [
            {
              id: crypto.randomUUID(),
              featureId,
              source:
                sourceKind === 'RACE'
                  ? { kind: 'RACE', raceId: race.id }
                  : sourceKind === 'FEAT'
                    ? { kind: 'FEAT', featId: feat.id }
                    : { kind: 'FEATURE', featureId },
              timing: { kind: 'CHARACTER_LEVEL', level: 1 },
              selections: [{ selectionKey: 'options', values: [{ kind: 'IDS', ids: [noviceId] }] }]
            }
          ]
        }
      })
      if (sourceKind === 'FEAT') {
        character.intent.featureAcquisitions.push({
          id: crypto.randomUUID(),
          featureId: feat.id,
          source: { kind: 'FEAT', featId: feat.id },
          timing: { kind: 'IMMEDIATE' }
        })
      }
      const candidate = { expectedDraftId: draft.id, mode: 'create' as const, character }
      if (sourceKind === 'FEAT') {
        const rootOnly = {
          ...candidate,
          character: {
            ...character,
            intent: {
              ...character.intent,
              featureAcquisitions: character.intent.featureAcquisitions.slice(1)
            }
          }
        }
        const unselected = await resolveCandidate(t, owner, rootOnly)
        expect(unselected.resolution.readiness.ready).toBe(false)
        expect(unselected.resolution.readiness.outstandingRequiredChoices).not.toEqual([])
        await expect(owner.caller.mutation(api.characters.commit.commit, rootOnly)).rejects.toThrow(
          'not ready to activate'
        )
        const grant = feat.grants.proficiencies?.find((row) => row.selectionKind === 'CHOSEN')
        if (!grant) throw new Error('Missing Feat root language choice.')
        character.intent.chosenGrantSelections = [
          {
            id: crypto.randomUUID(),
            grantId: grant.id,
            source: { kind: 'FEAT', featId: feat.id },
            timing: { kind: 'IMMEDIATE' },
            targetIds: SRD_LANGUAGES.slice(0, 2).map((language) => language.id)
          }
        ]
      }
      const ready = await resolveCandidate(t, owner, candidate)
      expect(ready.resolution.readiness).toEqual({
        ready: true,
        blockingIssues: [],
        outstandingRequiredChoices: []
      })
      expect(ready.view.review.ready).toBe(true)
      if (sourceKind !== 'FEATURE') {
        const future = structuredClone(character)
        future.intent.featureAcquisitions[0]!.timing = { kind: 'CHARACTER_LEVEL', level: 2 }
        const futureCandidate = { ...candidate, character: future }
        const unresolved = await resolveCandidate(t, owner, futureCandidate)
        expect(unresolved.resolution.readiness.ready).toBe(false)
        expect(
          unresolved.resolution.outstandingChoices.some(
            (choice) => choice.code === 'FEATURE_SELECTION_REQUIRED'
          )
        ).toBe(true)
        await expect(
          owner.caller.mutation(api.characters.commit.commit, futureCandidate)
        ).rejects.toThrow('not ready to activate')
      }
      if (sourceKind === 'FEAT') {
        const unrelated = structuredClone(character)
        const unrelatedId = crypto.randomUUID()
        unrelated.intent.featureAcquisitions.push({
          id: unrelatedId,
          featureId: featureOwner.features[0]!.id,
          source: { kind: 'FEAT', featId: feat.id },
          timing: { kind: 'IMMEDIATE' }
        })
        const unrelatedCandidate = { ...candidate, character: unrelated }
        const rejected = await resolveCandidate(t, owner, unrelatedCandidate)
        expect(
          rejected.resolution.validations.some(
            (issue) => issue.code === 'STALE_FEATURE_ACQUISITION'
          )
        ).toBe(true)
        const repaired = await previewCandidate(t, owner, unrelatedCandidate)
        expect(
          repaired.character.intent.featureAcquisitions.some((record) => record.id === unrelatedId)
        ).toBe(false)
        const duplicate = structuredClone(character)
        duplicate.intent.featureAcquisitions.push({
          ...duplicate.intent.featureAcquisitions[1]!,
          id: crypto.randomUUID()
        })
        for (const acquisitions of [
          duplicate.intent.featureAcquisitions,
          [...duplicate.intent.featureAcquisitions].reverse()
        ]) {
          const duplicateCandidate = {
            ...candidate,
            character: {
              ...duplicate,
              intent: { ...duplicate.intent, featureAcquisitions: acquisitions }
            }
          }
          const invalid = await resolveCandidate(t, owner, duplicateCandidate)
          expect(
            invalid.resolution.validations.some(
              (issue) => issue.code === 'DUPLICATE_FEAT_ACQUISITION'
            )
          ).toBe(true)
          await expect(
            owner.caller.mutation(api.characters.commit.commit, duplicateCandidate)
          ).rejects.toThrow('not ready to activate')
        }
      }
      if (sourceKind === 'RACE') {
        expect(ready.view.race.featureChoices[0]?.options.map((option) => option.id)).toEqual([
          noviceId
        ])
        expect(ready.view.race.featureChoices[0]?.selectedOptionIds).toEqual([noviceId])
      }
      expect(ready.resolution.summary.classes[0]?.classLabel).toBe(baseClass.label)
      if (sourceKind === 'RACE') {
        const unknownFeature = structuredClone(character)
        unknownFeature.intent.featureAcquisitions.push({
          id: crypto.randomUUID(),
          featureId: crypto.randomUUID(),
          source: { kind: 'MANUAL' },
          timing: { kind: 'IMMEDIATE' }
        })
        const unresolvedFeature = await resolveCandidate(t, owner, {
          ...candidate,
          character: unknownFeature
        })
        expect(
          unresolvedFeature.resolution.validations.some(
            (issue) => issue.code === 'STALE_FEATURE_ACQUISITION'
          )
        ).toBe(true)
        const unknownSpell = structuredClone(character)
        unknownSpell.intent.spellSelections = [
          {
            id: crypto.randomUUID(),
            source: { kind: 'FEATURE', featureId },
            timing: { kind: 'IMMEDIATE' },
            spells: [crypto.randomUUID()]
          }
        ]
        await expect(
          resolveCandidate(t, owner, {
            ...candidate,
            character: unknownSpell
          })
        ).rejects.toThrow('could not hydrate spell')
      }
      character.state.hitpoints.current = 999
      character.state.hitpoints.temp = 999
      const firstPreview = await previewCandidate(t, owner, candidate)
      expect(firstPreview.character.status).toBe('ACTIVE')
      expect(firstPreview.character.state.hitpoints.current).toBe(11)
      expect(firstPreview.character.state.hitpoints.temp).toBe(0)
      expect(firstPreview.character.intent.featureAcquisitions).toEqual(
        character.intent.featureAcquisitions
      )
      expect(firstPreview).not.toHaveProperty('authoredContentUpgrade')
      character.intent.featureAcquisitions[0]!.selections = [
        { selectionKey: 'options', values: [{ kind: 'IDS', ids: [veteranId] }] }
      ]
      const ineligible = await resolveCandidate(t, owner, candidate)
      expect(ineligible.resolution.readiness.ready).toBe(false)
      expect(
        ineligible.resolution.validations.some(
          (choice) => choice.code === 'FEATURE_SELECTION_INVALID'
        )
      ).toBe(true)
      const nestedId = crypto.randomUUID()
      const nestedOptionId = crypto.randomUUID()
      const nestedSource = {
        kind: 'OPTION' as const,
        acquiredParentId: nestedId,
        optionId: nestedOptionId
      }
      const staleCandidate = {
        ...candidate,
        character: {
          ...character,
          intent: {
            ...character.intent,
            featureAcquisitions: [
              ...character.intent.featureAcquisitions,
              {
                id: nestedId,
                featureId,
                source: {
                  kind: 'OPTION' as const,
                  acquiredParentId: character.intent.featureAcquisitions[0]!.id,
                  optionId: veteranId
                },
                timing: { kind: 'IMMEDIATE' as const },
                selections: [
                  { selectionKey: 'options', values: [{ kind: 'ID' as const, id: nestedOptionId }] }
                ]
              },
              {
                id: crypto.randomUUID(),
                featureId,
                source: nestedSource,
                timing: { kind: 'IMMEDIATE' as const }
              }
            ],
            spellSelections: [
              {
                id: crypto.randomUUID(),
                source: nestedSource,
                timing: { kind: 'IMMEDIATE' as const },
                spells: []
              }
            ],
            resourceGrants: [
              {
                id: crypto.randomUUID(),
                resourceId: crypto.randomUUID(),
                source: nestedSource,
                timing: { kind: 'IMMEDIATE' as const }
              }
            ]
          }
        }
      }
      const repaired = await previewCandidate(t, owner, staleCandidate)
      expect(repaired.character.intent.featureAcquisitions).toHaveLength(
        sourceKind === 'FEAT' ? 2 : 1
      )
      expect(repaired.character.intent.spellSelections).toBeUndefined()
      expect(repaired.character.intent.resourceGrants).toBeUndefined()
      expect(repaired.character.intent.featureAcquisitions[0]?.selections).toBeUndefined()
      expect(repaired.character.status).toBe('DRAFT')
      expect(repaired.resolution.readiness.ready).toBe(false)
      character.intent.classes[0]!.classLevel = 2
      character.intent.hitpoints.levels.push({
        level: 2,
        classId: baseClass.id,
        classLevel: 2,
        value: 6
      })
      const eligible = await resolveCandidate(t, owner, candidate)
      if (sourceKind === 'RACE') {
        expect(eligible.view.race.featureChoices[0]?.options.map((option) => option.id)).toEqual([
          noviceId,
          veteranId
        ])
      }
      expect(eligible.resolution.readiness.ready).toBe(true)
      expect(
        await owner.caller.query(api.characters.drafts.get, { id: draft.characterId })
      ).toEqual(draft)
      expect(await t.run((ctx) => ctx.db.query('characters').collect())).toEqual([])
      if (sourceKind === 'FEAT') {
        const committed = await owner.caller.mutation(api.characters.commit.commit, candidate)
        expect(committed.character.intent.featureAcquisitions).toEqual(
          character.intent.featureAcquisitions
        )
        expect(committed.character.intent.chosenGrantSelections).toEqual(
          character.intent.chosenGrantSelections
        )
        expect(committed.character.state.hitpoints.temp).toBe(0)
        expect(committed.streamVersion).toBe(1)
        expect(
          await owner.caller.query(api.characters.drafts.get, { id: draft.characterId })
        ).toBeNull()
      }
    },
    15_000
  )

  it('reconciles a stale same-source edit only after publication and preserves Sheet state', async () => {
    const { t, owner, other, createCharacter } = await readyCharacterFixture()
    const document = {
      ...acolyte,
      id: crypto.randomUUID(),
      userId: owner.userId,
      label: 'Owned background',
      features: [],
      proficiencies: acolyte.proficiencies,
      startingEquipment: undefined
    }
    const save = (caller: typeof owner.caller, authored: typeof document) =>
      caller.mutation(
        api.content.drafts.save,
        authoredDraftCommandInputSchema.parse({
          subjectKind: 'BACKGROUND',
          subjectId: authored.id,
          systemId: authored.systemId,
          label: authored.label,
          payload: JSON.parse(JSON.stringify(authored))
        })
      )
    const publish = async (
      caller: typeof owner.caller,
      saved: Awaited<ReturnType<typeof save>>
    ) => {
      if (!saved.updatedAt) throw new Error('Missing publication timestamp.')
      await caller.mutation(api.content.publication.publishDraft, {
        subjectKind: 'BACKGROUND',
        subjectId: saved.subjectId,
        expectedDraftUpdatedAt: saved.updatedAt
      })
    }
    await publish(owner.caller, await save(owner.caller, document))
    const foreign = {
      ...document,
      id: crypto.randomUUID(),
      userId: other.userId,
      label: 'Private background'
    }
    await publish(other.caller, await save(other.caller, foreign))
    const first = await createCharacter()
    const initial = {
      ...first.character,
      intent: {
        ...first.character.intent,
        background: { backgroundId: document.id },
        startingEquipment: { ...first.character.intent.startingEquipment, background: undefined }
      }
    }
    const initialCandidate = {
      expectedDraftId: first.draft.id,
      mode: 'create' as const,
      character: initial
    }
    const choices = await resolveCandidate(t, owner, initialCandidate)
    const languageChoice = choices.view.background.grantChoices[0]
    if (!languageChoice) throw new Error('Missing owned background language choice.')
    const selectedTargetIds = languageChoice.options.slice(0, 2).map((option) => option.id)
    const character = {
      ...initial,
      intent: {
        ...initial.intent,
        chosenGrantSelections: [
          {
            id: crypto.randomUUID(),
            grantId: languageChoice.grantId,
            source: languageChoice.source,
            timing: languageChoice.timing,
            targetIds: selectedTargetIds
          }
        ]
      }
    }
    const candidate = { ...initialCandidate, character }
    expect((await resolveCandidate(t, owner, candidate)).resolution.readiness.ready).toBe(true)
    const committed = await owner.caller.mutation(api.characters.commit.commit, candidate)
    expect(committed.streamVersion).toBe(1)
    const damaged = await owner.caller.mutation(api.characters.sheetCommands.execute, {
      id: first.character.id,
      command: {
        type: 'ADJUST_HIT_POINTS',
        commandId: crypto.randomUUID(),
        expectedVersion: committed.streamVersion,
        mode: 'DAMAGE',
        amount: 3
      }
    })
    expect(damaged.streamVersion).toBe(2)
    const edit = await owner.caller.mutation(api.characters.drafts.create, {
      id: first.character.id,
      systemId: first.character.systemId
    })
    const staleCandidate = {
      expectedDraftId: edit.id,
      mode: 'edit' as const,
      character: { ...character, status: 'DRAFT' as const }
    }
    const savedCharacter = await owner.caller.mutation(api.characters.drafts.save, {
      expectedDraftId: edit.id,
      characterId: first.character.id,
      mode: 'edit',
      character: staleCandidate.character
    })
    // Save a revision that removes the chosen grant while publication is still pending.
    const working = await save(owner.caller, {
      ...document,
      label: 'Published revision',
      proficiencies: []
    })
    const beforePublication = await resolveCandidate(t, owner, staleCandidate)
    expect(beforePublication.references.backgrounds.map((row) => row.id)).toContain(document.id)
    expect(beforePublication.references.backgrounds.map((row) => row.id)).not.toContain(foreign.id)
    expect(beforePublication.resolution.summary.selectedBackground?.label).toBe(document.label)
    expect(beforePublication.character.state.hitpoints.current).toBe(8)
    expect(await owner.caller.query(api.characters.drafts.get, { id: first.character.id })).toEqual(
      savedCharacter
    )
    expect(
      await other.caller.query(api.characters.builder.activeCharacter, { id: committed.publicId })
    ).toBeNull()
    await publish(owner.caller, working)
    const preview = await previewCandidate(t, owner, staleCandidate)
    expect(preview.character.intent.chosenGrantSelections).toBeUndefined()
    expect(preview.character.state.hitpoints.current).toBe(8)
    expect(preview.character.state.equipment.inventory).toEqual(
      beforePublication.character.state.equipment.inventory
    )
    expect(await owner.caller.query(api.characters.drafts.get, { id: first.character.id })).toEqual(
      savedCharacter
    )
    const result = await owner.caller.mutation(api.characters.commit.commit, staleCandidate)
    expect(result.publicId).toBe(committed.publicId)
    // A Builder commit that leaves play state alone does not advance the play stream.
    expect(result.streamVersion).toBe(damaged.streamVersion)
    expect(result.character.id).toBe(first.character.id)
    expect(result.character.intent.chosenGrantSelections).toBeUndefined()
    expect(result.character.state.hitpoints.current).toBe(8)
    expect(result.character.state.equipment.inventory).toEqual(
      beforePublication.character.state.equipment.inventory
    )
    expect(
      await owner.caller.query(api.characters.drafts.get, { id: first.character.id })
    ).toBeNull()
  })
})
