import { handleRequest, getSubfeatureModifierQuery, getSubfeatureProficiencyQuery, getSubfeatureExpertiseQuery, getSubfeatureFeatQuery, getSubfeatureOptionQuery, getSubfeatureSenseQuery, getSubfeatureSpellQuery } from '@artificer-toolkit/functions'
import type { SubfeatureModifier, SubfeatureProficiency, SubfeatureExpertise, SubfeatureFeat, SubfeatureOption, SubfeatureSense, SubfeatureSpell } from '@artificer-toolkit/shared'

// modifier
export const getSubfeatureModifier = handleRequest<[string], SubfeatureModifier | null>(getSubfeatureModifierQuery, (req) => {
  const url = new URL(req.url)
  const segments = url.pathname.split('/').filter(Boolean)
  const id = segments[segments.length - 1]
  return [
    id
  ]
})

// proficiencies
export const getSubfeatureProficiency = handleRequest<[string], SubfeatureProficiency | null>(getSubfeatureProficiencyQuery, (req) => {
  const url = new URL(req.url)
  const segments = url.pathname.split('/').filter(Boolean)
  const id = segments[segments.length - 1]
  return [
    id
  ]
})

// modifier
export const getSubfeatureFeat = handleRequest<[string], SubfeatureFeat | null>(getSubfeatureFeatQuery, (req) => {
  const url = new URL(req.url)
  const segments = url.pathname.split('/').filter(Boolean)
  const id = segments[segments.length - 1]
  return [
    id
  ]
})

// modifier
export const getSubfeatureExpertise = handleRequest<[string], SubfeatureExpertise | null>(getSubfeatureExpertiseQuery, (req) => {
  const url = new URL(req.url)
  const segments = url.pathname.split('/').filter(Boolean)
  const id = segments[segments.length - 1]
  return [
    id
  ]
})

// modifier
export const getSubfeatureSpell = handleRequest<[string], SubfeatureSpell | null>(getSubfeatureSpellQuery, (req) => {
  const url = new URL(req.url)
  const segments = url.pathname.split('/').filter(Boolean)
  const id = segments[segments.length - 1]
  return [
    id
  ]
})

// modifier
export const getSubfeatureSense = handleRequest<[string], SubfeatureSense | null>(getSubfeatureSenseQuery, (req) => {
  const url = new URL(req.url)
  const segments = url.pathname.split('/').filter(Boolean)
  const id = segments[segments.length - 1]
  return [
    id
  ]
})

// modifier
export const getSubfeatureOption = handleRequest<[string], SubfeatureOption | null>(getSubfeatureOptionQuery, (req) => {
  const url = new URL(req.url)
  const segments = url.pathname.split('/').filter(Boolean)
  const id = segments[segments.length - 1]
  return [
    id
  ]
})
