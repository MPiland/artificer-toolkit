import { describe, expect, it } from 'vitest'
import {
  maskStandardPlainText,
  maskStandardRichText,
  presentAuthoredSnapshotText,
  presentCampaignPlainText
} from '../domains/campaign/campaignTextPolicy.js'
import { buildNodeMap, type NodeMap } from '../utils/nodeDefinition.js'

describe('Campaign text policy', () => {
  it('masks English profanity and selected compound terms with asterisks', () => {
    expect(
      maskStandardPlainText(
        'A shit plan in a shitstorm near a shitake mushroom with sexual content.'
      )
    ).toBe('A **** plan in a ****storm near a shitake mushroom with sexual content.')
  })

  it('preserves rich-text markup and attributes while masking visible text', () => {
    expect(
      maskStandardRichText('<p class="shit"><a href="https://example.com/shit">shit plan</a></p>')
    ).toBe('<p class="shit"><a href="https://example.com/shit">**** plan</a></p>')
  })

  it('leaves Mature presentation unchanged and applies the local allow-list', () => {
    expect(presentCampaignPlainText('shit happens', 'MATURE')).toBe('shit happens')
    expect(maskStandardPlainText('What the hell?')).toBe('What the hell?')
  })

  it('uses authored node metadata without rewriting structural text', () => {
    const map = buildNodeMap<{
      id: string
      label: string
      description: string
      formula: string
    }>().define('policy-test', ({ map: builder, nodes }) => {
      builder
        .set('id', nodes.text(['id'], 'ID'))
        .set('label', nodes.text(['label'], 'Label'))
        .set('description', nodes.richText(['description'], 'Description'))
        .set('formula', nodes.text(['formula'], 'Formula'))
    }) as NodeMap<Record<string, unknown>>

    expect(
      presentAuthoredSnapshotText(
        {
          id: 'shit',
          label: 'shit blade',
          description: '<p>shit lore</p>',
          formula: 'shit + 1'
        },
        map,
        'STANDARD'
      )
    ).toEqual({
      id: 'shit',
      label: '**** blade',
      description: '<p>**** lore</p>',
      formula: 'shit + 1'
    })
  })
})
