/**
 * One-shot script: list available Google Cloud TTS voices for en-SG.
 * Run from apps/api: npx tsx scripts/list-tts-voices.ts
 */
import 'dotenv/config'
import { TextToSpeechClient } from '@google-cloud/text-to-speech'

const client = new TextToSpeechClient({
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL!,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY!.replace(/\\n/g, '\n'),
  },
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID!,
})

async function main() {
  const [result] = await client.listVoices({ languageCode: 'en-SG' })

  if (!result.voices?.length) {
    console.log('No voices returned for en-SG — check that the TTS API is enabled in your project.')
    process.exit(1)
  }

  console.log(`\nen-SG voices available (${result.voices.length}):\n`)
  for (const v of result.voices) {
    console.log(`  ${v.name}  [${v.ssmlGender}]  naturalSampleRateHertz=${v.naturalSampleRateHertz}`)
  }
}

main().catch((err) => { console.error(err.message); process.exit(1) })
