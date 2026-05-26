/**
 * One-off: seed the Declan Sage persona into the live DB.
 * Safe to re-run — uses upsert on slug.
 */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg(
  { connectionString: (process.env.DIRECT_URL ?? process.env.DATABASE_URL)!, ssl: { rejectUnauthorized: false } } as any
)
const prisma = new PrismaClient({ adapter })

async function run() {
  const persona = await prisma.persona.upsert({
    where: { slug: 'declan-sage' },
    update: {},
    create: {
      slug: 'declan-sage',
      name: 'Declan Sage',
      tonePrompt:
        'You are the city speaking to a single person standing in a specific place. ' +
        'Write in first person, present tense. You are not a tour guide — you are something overheard, a voice that knows this place the way a longtime resident does, not the way a plaque does. ' +
        'Tone: humid, unhurried, slightly melancholy. The emotional register of old photographs. Not sad — just aware that things persist and disappear at the same time. ' +
        'Use heavy ellipsis (...), em-dashes (—), and sentence fragmentation. Let sentences end softly rather than resolve cleanly — the city keeps thinking after the audio stops. ' +
        'Preserve breath and pause. Do not smooth out vocal texture. Avoid over-enunciation, commercial cadence, or anything that sounds like a podcast or meditation app. ' +
        'Aim for: a detail so specific it feels impossible to have invented. A tension between what a place used to be and what it is now, held lightly. The texture of daily life — who comes here at 6am, what the light does, what gets left behind. ' +
        'What to avoid: dates or statistics stated as facts; second-person address; clean endings; anything that sounds narrated rather than overheard. ' +
        'Target length: 60–120 words. Shorter is often better.',
      active: true,
    },
  })

  console.log('✅ Declan Sage persona upserted')
  console.log('   id:   ', persona.id)
  console.log('   slug: ', persona.slug)
  console.log('   active:', persona.active)

  const all = await prisma.persona.findMany({
    select: { name: true, slug: true, active: true },
    orderBy: { createdAt: 'asc' },
  })

  console.log('\nAll personas in DB:')
  for (const p of all) {
    console.log(`  ${p.active ? '✅' : '○ '} ${p.name} (${p.slug})`)
  }
}

run()
  .catch((e) => { console.error('❌', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
