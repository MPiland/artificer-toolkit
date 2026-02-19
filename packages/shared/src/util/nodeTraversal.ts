import type { SubjectMap } from '../../dist/maps/maps.js'
import type { EmptyObject } from 'type-fest'
import type { NodeMap } from './nodeDefinition.js'

// Extract the enabled PATH map type from a node that has enables
export type EnabledPathMap<T> = T extends {
  enables: { kind: 'PATH', map: infer M }
}
  ? M
  : never

// Extract the payload object type from a NodeMap<...>
export type NodeMapPayload<M> = M extends NodeMap<infer P> ? P : never

// Convenience: the first map under a subject (or never if subject doesn't PATH-enable)
export type SubjectEnabledMap<
  SubjectMap,
  S extends keyof SubjectMap
> = EnabledPathMap<SubjectMap[S]>

// ----- core helpers -----

export type StrKey<T> = Extract<keyof T, string>

// Pull the payload registry type back out of NodeMap<NPayload>
export type PayloadOfMap<M> = M extends NodeMap<infer P> ? P : never

export type NodeOfMap<M, K extends StrKey<M>> = M[K]

// Does this node enable another PATH?
export type EnabledPathMapOfNode<N> = N extends {
  kind: 'BRANCH'
  enables: { kind: 'PATH', map: infer NM }
}
  ? NM
  : never

// Is this node a terminal (cannot continue deeper)?
export type IsTerminalNode<N> = N extends { kind: 'LEAF' | 'KNOT' }
  ? true
  : N extends { kind: 'BRANCH', enables: { kind: 'PATH', map: unknown } }
    ? false
    : true

// If a node has `payload: keyof NPayload`, add that one key to the flat payload.
export type PayloadFragmentForNode<M, K extends StrKey<M>>
  = NodeOfMap<M, K> extends { payload: infer PKey }
    ? PKey extends keyof PayloadOfMap<M>
      ? PayloadOfMap<M>[PKey] extends Record<string, unknown>
        ? PayloadOfMap<M>[PKey]
        : EmptyObject
      : EmptyObject
    : EmptyObject

export type AllPaths<M> = {
  [K in StrKey<M>]:
  IsTerminalNode<NodeOfMap<M, K>> extends true
    ? readonly [K]
    : EnabledPathMapOfNode<NodeOfMap<M, K>> extends infer Next
      ? Next extends Record<string, unknown>
        ? readonly [K] | readonly [K, ...AllPaths<Next>]
        : readonly [K]
      : readonly [K]
}[StrKey<M>]

export type PayloadForPath<M, P extends readonly string[]>
  = P extends readonly [infer H, ...infer T]
    ? H extends StrKey<M>
      ? T extends readonly string[] ? PayloadFragmentForNode<M, H>
      & (
            IsTerminalNode<NodeOfMap<M, H>> extends true
              ? EmptyObject
              : EnabledPathMapOfNode<NodeOfMap<M, H>> extends infer Next
                ? Next extends Record<string, unknown>
                  ? PayloadForPath<Next, T>
                  : EmptyObject
                : EmptyObject
          )
        : EmptyObject
      : EmptyObject
    : EmptyObject

export type SubjectStartMap<S extends keyof SubjectMap>
  = SubjectMap[S] extends { enables: { kind: 'PATH', map: infer M } }
    ? M
    : never

// Extract meta.code if present
export type MetaCodeOfNode<N>
  = N extends { meta: { code: infer C } }
    ? C
    : never

// For a whole node map, produce a "nodeKey -> meta.code" mapping
export type MetaCodeByNodeKey<M> = {
  [K in Extract<keyof M, string>]: MetaCodeOfNode<M[K]>
}
