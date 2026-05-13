export function isLegacyAuthoredDetailPath(pathname: string, sectionPath: string) {
  const segments = pathname.split('/').filter(Boolean)

  return segments.length === 2 && segments[0] === sectionPath
}
