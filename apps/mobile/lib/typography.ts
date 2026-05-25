import { TextStyle } from 'react-native'

// ─── Font family names ────────────────────────────────────────────────────────
// Loaded via useFonts in apps/mobile/app/_layout.tsx.
// These strings are the sole source of truth — import from here, never hardcode.

export const FONT = {
  light:         'CormorantGaramond_300Light',
  regular:       'CormorantGaramond_400Regular',
  regularItalic: 'CormorantGaramond_400Regular_Italic',
  semiBold:      'CormorantGaramond_600SemiBold',
} as const

// ─── Text style presets ────────────────────────────────────────────────────────
// Spread into StyleSheet or inline style. Colour is left to the component
// so the same preset can appear at different opacities or in different contexts.

/**
 * POI name — a place label that frames the whisper, not a headline.
 * Light weight, generous letter-spacing: it recedes behind the body text.
 */
export const whisperTitle: TextStyle = {
  fontFamily:    FONT.light,
  fontSize:      26,
  lineHeight:    30,
  letterSpacing: 1.5,
}

/**
 * Whisper body — the city speaking.
 * Italic, generous line-height, left-aligned: reads as overheard, not broadcast.
 * Line height is ~1.73× the font size (38 / 22).
 */
export const whisperBody: TextStyle = {
  fontFamily:    FONT.regularItalic,
  fontSize:      22,
  lineHeight:    38,
  letterSpacing: 0.3,
}

/**
 * Whisper meta — eyebrow labels, category lines, nearby section headers.
 * Uppercase small-type; Light weight keeps it ambient, not labelled.
 */
export const whisperMeta: TextStyle = {
  fontFamily:     FONT.light,
  fontSize:       9.5,
  letterSpacing:  2,
  textTransform:  'uppercase',
}
