import { describe, expect, it } from 'vitest'
import {
  maskStandardPlainText,
  maskStandardRichText,
  presentAuthoredSnapshotText,
  presentCampaignPlainText
} from '../domains/campaign/campaignTextPolicy.js'
import { buildNodeMap, type NodeMap } from '../utils/nodeDefinition.js'

describe('Campaign text policy', () => {
  it('preserves absent and null groups while masking present nested objects without mutation', () => {
    const child = buildNodeMap<{ label: string }>().define('child', ({ map, nodes }) => {
      map.set('label', nodes.text(['label'], 'Label'))
    })
    const map = buildNodeMap<{ optional?: { label: string } | null }>().define(
      'parent',
      ({ map, nodes }) => {
        map.set(
          'optional',
          nodes.groupObject(['optional'], 'Optional', () => child, { presentation: 'inline' })
        )
      }
    ) as NodeMap<Record<string, unknown>>
    expect(presentAuthoredSnapshotText({}, map, 'STANDARD')).toStrictEqual({})
    expect(presentAuthoredSnapshotText({ optional: null }, map, 'STANDARD')).toStrictEqual({
      optional: null
    })
    const original = { optional: { label: 'shit lore' } }
    expect(presentAuthoredSnapshotText(original, map, 'STANDARD')).toStrictEqual({
      optional: { label: '**** lore' }
    })
    expect(original.optional.label).toBe('shit lore')
  })

  it('masks English profanity and selected compound terms with asterisks', () => {
    expect(
      maskStandardPlainText(
        'A shit plan in a shitstorm near a shitake mushroom with sexual content.'
      )
    ).toBe('A **** plan in a ****storm near a shitake mushroom with sexual content.')
  })

  // ACCOUNTS-7.5: the same library and tiers as usernames.
  it('masks look-alike and padded profanity', () => {
    expect(maskStandardPlainText('sh1t and fuuuck')).toBe('**** and ****')
  })

  it('masks the whole word of an inflected profanity', () => {
    expect(maskStandardPlainText('Fucking Coins, he fucked it')).toBe('**** Coins, he **** it')
  })

  it('masks short ambiguous terms only as whole words and leaves ordinary words alone', () => {
    expect(maskStandardPlainText('kick his ass, you dumbass')).toBe('kick his ****, you ****')
    const ordinary = 'Cassandra of Scunthorpe met Dickens and an Assassin near a Compass in Essex.'
    expect(maskStandardPlainText(ordinary)).toBe(ordinary)
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
