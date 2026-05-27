/**
 * Singapore place-name phoneme overrides.
 *
 * British Neural2/Chirp3 models aggressively mispronounce Singaporean place
 * names. This map wraps known problem words in SSML <phoneme> tags using IPA
 * before the SSML builder runs sentence splitting.
 *
 * Add entries here as new content is validated — do not inline <phoneme> tags
 * directly in whisper text or the SSML builder. This is the single source of
 * truth for pronunciation corrections.
 *
 * IPA reference for Singapore English: https://en.wikipedia.org/wiki/Singapore_English
 */

interface PhonemeOverride {
  ipa: string
}

// Entries are matched case-sensitively (title-case matches typical prose usage).
// Add lower-case variants explicitly if they appear at sentence start.
const PHONEME_OVERRIDES: Record<string, PhonemeOverride> = {
  'Kallang':        { ipa: 'ˈkælæŋ' },
  'Tanjong Pagar':  { ipa: 'tænˈdʒɒŋ pəˈɡɑː' },
  'Kampong Glam':   { ipa: 'kæmˈpɒŋ ɡlæm' },
  'Tiong Bahru':    { ipa: 'tiˈɒŋ bɑːˈruː' },
  'Buona Vista':    { ipa: 'ˌbwɒnə ˈvɪstə' },
  'Geylang':        { ipa: 'ˈɡeɪlæŋ' },
  'Telok Ayer':     { ipa: 'ˈtɛlɒk ˈaɪər' },
  'Chinatown':      { ipa: 'ˈtʃaɪnətaʊn' },
  'Bugis':          { ipa: 'ˈbuːɡɪs' },
  'Jurong':         { ipa: 'dʒuːˈrɒŋ' },
  'Bedok':          { ipa: 'ˈbɛdɒk' },
  'Tampines':       { ipa: 'tæmˈpɪnɪs' },
  'Woodlands':      { ipa: 'ˈwʊdləndz' },
  'Clementi':       { ipa: 'klɛˈmɛnti' },
  'Bishan':         { ipa: 'ˈbiːʃən' },
  'Serangoon':      { ipa: 'sɛˈræŋɡuːn' },
  'Ang Mo Kio':     { ipa: 'æŋ moʊ ˈkiːoʊ' },
  'Toa Payoh':      { ipa: 'toʊə ˈpaɪoʊ' },
  'Queenstown':     { ipa: 'ˈkwiːnztaʊn' },
  'Hougang':        { ipa: 'hoʊˈɡæŋ' },
  'Yishun':         { ipa: 'ˈjiːʃuːn' },
  'Punggol':        { ipa: 'ˈpʌŋɡɒl' },
  'Sengkang':       { ipa: 'ˈsɛŋkæŋ' },
  'Pasir Ris':      { ipa: 'ˈpæsɪr rɪs' },
  'Bukit Timah':    { ipa: 'ˌbʊkɪt tɪˈmɑː' },
  'Bukit Merah':    { ipa: 'ˌbʊkɪt ˈmɛrə' },
  'Bukit Batok':    { ipa: 'ˌbʊkɪt ˈbætɒk' },
  'Choa Chu Kang':  { ipa: 'tʃoʊə tʃuː ˈkæŋ' },
}

/**
 * Scan plain whisper text and wrap any matching place names in SSML
 * <phoneme> tags. Must be called before sentence-splitting in buildSsml,
 * since the tags should not interfere with sentence boundary detection.
 *
 * Matches are case-sensitive to preserve title-case rendering in the TTS output.
 */
export function applyPhonemeOverrides(text: string): string {
  let result = text

  for (const [word, { ipa }] of Object.entries(PHONEME_OVERRIDES)) {
    // Escape special regex chars in the place name, match whole-word only
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = new RegExp(`\\b${escaped}\\b`, 'g')
    result = result.replace(
      pattern,
      `<phoneme alphabet="ipa" ph="${ipa}">${word}</phoneme>`
    )
  }

  return result
}

// Export the map for use in tests and future tooling
export { PHONEME_OVERRIDES }
