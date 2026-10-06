import {
  MAX_LIVE_SESSION_RULES_REVISIONS,
  type LiveSessionRulesRevisions
} from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'

/** Keep one consistent view of the inputs read across paged and nested captures. */
export function mergeNativeRulesRevisions(
  current: LiveSessionRulesRevisions,
  incoming: LiveSessionRulesRevisions
): LiveSessionRulesRevisions {
  const revisions = new Map<string, LiveSessionRulesRevisions[number]>(
    current.map((observation) => [`${observation.scope}:${observation.id}`, observation])
  )
  for (const observation of incoming) {
    const key = `${observation.scope}:${observation.id}`
    const previous = revisions.get(key)
    if (previous && previous.revision !== observation.revision)
      throw new Error(
        `Live rules revision changed during preparation. ${key} was ${previous.revision}, now ${observation.revision}.`
      )
    revisions.set(key, observation)
  }
  if (revisions.size > MAX_LIVE_SESSION_RULES_REVISIONS)
    throw new Error('Live rules revisions exceed the supported bound.')
  return [...revisions.values()]
}
