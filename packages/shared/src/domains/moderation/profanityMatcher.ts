import {
  DataSet,
  RegExpMatcher,
  englishDataset,
  englishRecommendedTransformers,
  parseRawPattern
} from 'obscenity'

// The one profanity library and tier set for usernames and campaign text (Q22, ACCOUNTS-7).
// Short ambiguous terms are refused only as a whole word, so Cassandra, Dickens and Cummings pass;
// usernames also refuse them inside an unbroken compound (usernameServerPolicy).
const wholePartPhrases = [
  { term: 'ass', patterns: ['|ass|'] },
  { term: 'assman', patterns: ['|assman|'] },
  { term: 'dick', patterns: ['|dick|', '|dicks|', '|dck|'] },
  { term: 'cum', patterns: ['|cum|', '|cums|'] },
  // The transformers collapse repeated letters, so `titty` is matched as `tity`.
  { term: 'tit', patterns: ['|tit|', '|tits|', '|tity', '|titie'] }
]
// Dictionary words built on a whole-part term. The username compound check exempts dictionary words.
const profaneCompounds = [
  'asshole',
  'asshat',
  'asswipe',
  'assclown',
  'dumbass',
  'jackass',
  'smartass',
  'fatass',
  'dickhead',
  'dickwad',
  'dickface',
  'dickweed',
  'cumshot',
  'cumslut',
  'cumdump',
  'shithead'
]
// Known false positives of the matcher.
export const allowedProfanityTerms = [
  'penistone',
  'fukushima',
  'fukuoka',
  'fukui',
  'cockpit',
  'dickson',
  'dickinson',
  'hitchcock',
  'middlesex',
  'shuttlecock',
  'annalise',
  'analise',
  'shital',
  'shittu',
  'shiitake',
  'shitake',
  'titus',
  'dickerson',
  'pettit',
  'cockburn',
  'bluetit'
]

// Terms the matcher anchors to a word boundary on at least one side only match at a word edge. The
// username compound check looks for them inside an unbroken part, so the set comes from the same dataset.
const englishAnchoredTerms: string[] = []
const dataset = [
  ...wholePartPhrases,
  ...profaneCompounds.map((term) => ({ term, patterns: [term] }))
].reduce(
  (set, { term, patterns }) =>
    set.addPhrase((phrase) =>
      patterns
        .reduce((builder, raw) => builder.addPattern(parseRawPattern(raw)), phrase)
        .setMetadata({ originalWord: term })
    ),
  new DataSet<{ originalWord: string }>()
    .addAll(englishDataset)
    .removePhrasesIf(({ metadata, patterns }) => {
      const term = metadata?.originalWord ?? ''
      if (wholePartPhrases.some((replaced) => replaced.term === term)) return true
      if (patterns.some((p) => p.requireWordBoundaryAtStart || p.requireWordBoundaryAtEnd)) {
        englishAnchoredTerms.push(term)
      }
      return false
    })
)
export const anchoredProfanityTerms = [
  ...wholePartPhrases.map(({ term }) => term),
  ...englishAnchoredTerms
]
const { blacklistedTerms, whitelistedTerms } = dataset.build()

export const profanityMatcher = new RegExpMatcher({
  blacklistedTerms,
  whitelistedTerms: [...(whitelistedTerms ?? []), ...allowedProfanityTerms],
  ...englishRecommendedTransformers
})
