import { describe, expect, it } from 'vitest'
import type {
  CharacterRestPreviewResponseDto,
  CharacterSheetResponseDto
} from '@artificer-toolkit/schema/api/characters'
import type { CharacterSheetPanelDto } from '@artificer-toolkit/schema/api/characterSheetPanel'
import { presentCampaignCharacterText } from './campaignCharacterPresentation.js'

describe('Campaign Character text presentation', () => {
  it('masks known Standard display fields without rewriting structural values', () => {
    const sheet = {
      meta: { characterId: 'shit-id' },
      identity: { label: 'shit scout', description: '<p>shit happens</p>' },
      actions: {
        items: [
          {
            id: 'shit-action-id',
            label: 'shit strike',
            mechanic: { outcomes: [{ kind: 'DAMAGE', expression: 'shit + 1' }] }
          }
        ]
      },
      notes: { backstory: '<p>shit history</p>' }
    } as unknown as CharacterSheetResponseDto

    const presented = presentCampaignCharacterText(sheet, 'STANDARD')

    expect(presented.identity).toMatchObject({
      label: '**** scout',
      description: '<p>**** happens</p>'
    })
    expect(presented.actions.items[0]).toMatchObject({
      id: 'shit-action-id',
      label: '**** strike',
      mechanic: { outcomes: [{ expression: 'shit + 1' }] }
    })
    expect(presented.meta.characterId).toBe('shit-id')
    expect(presented.notes.backstory).toBe('<p>**** history</p>')
  })

  it('masks panel editor text and rest labels while leaving Mature text unchanged', () => {
    const panel = {
      kind: 'ITEM',
      title: 'shit blade',
      textEditors: [{ kind: 'TEXT', field: 'CUSTOM_NAME', label: 'Name', value: 'shit blade' }]
    } as unknown as CharacterSheetPanelDto
    const rest = {
      hitDice: [{ classLabels: ['shit knight'] }],
      eligibleCompanions: [{ label: 'shit wolf' }]
    } as unknown as CharacterRestPreviewResponseDto

    expect(presentCampaignCharacterText(panel, 'STANDARD')).toMatchObject({
      title: '**** blade',
      textEditors: [{ value: '**** blade' }]
    })
    expect(presentCampaignCharacterText(rest, 'STANDARD')).toMatchObject({
      hitDice: [{ classLabels: ['**** knight'] }],
      eligibleCompanions: [{ label: '**** wolf' }]
    })
    expect(presentCampaignCharacterText(panel, 'MATURE')).toBe(panel)
  })
})
