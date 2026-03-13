export const COMPILE_DIAGNOSTIC_SEVERITY = {
  ERROR: 'error',
  WARNING: 'warning'
} as const

export type CompileDiagnosticSeverity =
  typeof COMPILE_DIAGNOSTIC_SEVERITY[keyof typeof COMPILE_DIAGNOSTIC_SEVERITY]

export interface CompileDiagnostic {
  code: string
  message: string
  severity: CompileDiagnosticSeverity
  path?: string[]
}

export type CompileResult<T>
  = | {
    ok: true
    value: T
    diagnostics: CompileDiagnostic[]
  }
    | {
      ok: false
      diagnostics: CompileDiagnostic[]
    }

export function compileSuccess<T>(
  value: T,
  diagnostics: CompileDiagnostic[] = []
): CompileResult<T> {
  return {
    ok: true,
    value,
    diagnostics
  }
}

export function compileFailure<T = never>(
  diagnostics: CompileDiagnostic | CompileDiagnostic[]
): CompileResult<T> {
  return {
    ok: false,
    diagnostics: Array.isArray(diagnostics) ? diagnostics : [diagnostics]
  }
}

export function isCompileSuccess<T>(
  result: CompileResult<T>
): result is Extract<CompileResult<T>, { ok: true }> {
  return result.ok
}

export function unwrapCompileResult<T>(result: CompileResult<T>): T {
  if (result.ok) {
    return result.value
  }

  const message = result.diagnostics
    .map((diagnostic) => {
      const path = diagnostic.path?.length ? ` (${diagnostic.path.join('.')})` : ''
      return `[${diagnostic.severity}] ${diagnostic.code}${path}: ${diagnostic.message}`
    })
    .join('\n')

  throw new Error(`Compilation failed\n${message}`)
}
