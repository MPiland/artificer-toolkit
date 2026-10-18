import { describe, expect, it } from 'vitest'

import { buildSkillSubjectAliasMap, resolveSkillAlias } from '../domains/character/ruleFacts.js'

describe('skill subject aliases', () => {
  it('names only the skills the System defines', () => {
    expect(buildSkillSubjectAliasMap(null).size).toBe(0)
    expect(resolveSkillAlias('ATHLETICS', buildSkillSubjectAliasMap(null))).toBe('ATHLETICS')
  })
})
