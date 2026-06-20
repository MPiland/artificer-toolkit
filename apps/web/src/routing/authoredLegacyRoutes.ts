export function isLegacyAuthoredDetailPath(pathname: string, sectionPath: string) {
  const segments = pathname.split('/').filter(Boolean)

  return segments.length === 2 && segments[0] === sectionPath
}

export function isLegacyAuthoredEditPath(pathname: string, sectionPath: string) {
  const segments = pathname.split('/').filter(Boolean)

  return segments.length === 3 && segments[0] === sectionPath && segments[2] === 'edit'
}
