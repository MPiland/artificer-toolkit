/** The text with every run of a repeated letter cut to one: `diickmuncherrr` reads `dickmuncher`. */
export function collapseLetterRuns(text: string): string {
  return text.replace(/(.)\1+/g, '$1')
}
