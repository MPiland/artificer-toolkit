export const sourceResolve: {
  resolve: { conditions: string[] }
  ssr: { resolve: { conditions: string[] } }
}
export const inlineWorkspacePackages: RegExp[]
export const tracerTierAliases: { find: RegExp; replacement: string }[]
export const workspaceSourceAliases: Record<string, string>
