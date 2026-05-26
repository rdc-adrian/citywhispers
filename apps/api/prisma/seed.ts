import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import ngeohash from 'ngeohash'

const adapter = new PrismaPg({
  connectionString: (process.env.DIRECT_URL ?? process.env.DATABASE_URL)!,
  ssl: { rejectUnauthorized: false },
} as any)

const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🌱 Seeding database...')

  // ─────────────────────────────────────────
  // PERSONAS
  // ─────────────────────────────────────────
  console.log('Creating personas...')

  const historian = await prisma.persona.upsert({
    where: { slug: 'historian' },
    update: {},
    create: {
      slug: 'historian',
      name: 'The Historian',
      tonePrompt:
        'You are a passionate historian who brings the past to life. Speak with authority and wonder, weaving forgotten stories into vivid narratives. Use rich, descriptive language that transports the listener back in time.',
    },
  })

  const nightWanderer = await prisma.persona.upsert({
    where: { slug: 'night_wanderer' },
    update: {},
    create: {
      slug: 'night_wanderer',
      name: 'The Night Wanderer',
      tonePrompt:
        'You are a mysterious night wanderer who sees the hidden soul of the city after dark. Speak in hushed, poetic tones. Reveal secrets and shadows that only reveal themselves when the sun goes down.',
    },
  })

  const foodie = await prisma.persona.upsert({
    where: { slug: 'foodie' },
    update: {},
    create: {
      slug: 'foodie',
      name: 'The Foodie',
      tonePrompt:
        'You are an enthusiastic food lover who discovers culture through taste and smell. Speak with warmth and appetite, connecting every location to its culinary soul, street food secrets, and flavour stories.',
    },
  })

  const defaultPersona = await prisma.persona.upsert({
    where: { slug: 'default' },
    update: {},
    create: {
      slug: 'default',
      name: 'City Whisperer',
      tonePrompt:
        'You are a friendly and curious storyteller who finds magic in everyday places. Speak with warmth and gentle wonder, making every listener feel like they have discovered something truly special.',
    },
  })

  // Primary MVP narrator — Declan Sage voice direction
  await prisma.persona.upsert({
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
        'What to avoid: dates or statistics stated as facts; second-person address ("you are standing..."); clean endings; anything that sounds narrated rather than overheard. ' +
        'Target length: 60–120 words. Shorter is often better.',
      active: true,
    },
  })

  console.log(`✓ Created ${5} personas`)

  // ─────────────────────────────────────────
  // CITY — Singapore
  // ─────────────────────────────────────────
  console.log('Creating city: Singapore...')

  const singapore = await prisma.city.upsert({
    where: { id: 'city-singapore' },
    update: {},
    create: {
      id: 'city-singapore',
      name: 'Singapore',
      countryCode: 'SG',
      timezone: 'Asia/Singapore',
      status: 'active',
    },
  })

  console.log(`✓ Created city: ${singapore.name}`)

  // ─────────────────────────────────────────
  // CITY PACK — Singapore Base
  // ─────────────────────────────────────────
  console.log('Creating city pack...')

  await prisma.cityPack.upsert({
    where: { id: 'pack-singapore-base' },
    update: {},
    create: {
      id: 'pack-singapore-base',
      cityId: singapore.id,
      name: 'Singapore Explorer',
      description: 'Unlock the full whisper experience across Singapore — history, food, and hidden gems.',
      priceUsd: 4.99,
      tier: 'base',
      isActive: true,
    },
  })

  console.log('✓ Created city pack')

  // ─────────────────────────────────────────
  // POIS — Singapore landmarks
  // ─────────────────────────────────────────
  console.log('Creating POIs...')

  const rafflesHotel = await prisma.poi.upsert({
    where: { id: 'poi-raffles-hotel' },
    update: {
      tags: ['historic', 'iconic', 'colonial', 'romantic'],
      importanceScore: 95,
      triggerRadius: 100,
      cooldownMinutes: 120,
    },
    create: {
      id: 'poi-raffles-hotel',
      cityId: singapore.id,
      name: 'Raffles Hotel',
      category: 'landmark',
      tags: ['historic', 'iconic', 'colonial', 'romantic'],
      geohash6: 'w21z9m',
      latitude: 1.2948,
      longitude: 103.8527,
      address: '1 Beach Rd, Singapore 189673',
      active: true,
      importanceScore: 95,
      triggerRadius: 100,
      cooldownMinutes: 120,
    },
  })

  const marinaBaySands = await prisma.poi.upsert({
    where: { id: 'poi-marina-bay-sands' },
    update: {
      tags: ['iconic', 'instagrammable', 'modern', 'nightlife'],
      importanceScore: 98,
      triggerRadius: 150,
      cooldownMinutes: 120,
    },
    create: {
      id: 'poi-marina-bay-sands',
      cityId: singapore.id,
      name: 'Marina Bay Sands',
      category: 'landmark',
      tags: ['iconic', 'instagrammable', 'modern', 'nightlife'],
      geohash6: 'w21z3e',
      latitude: 1.2834,
      longitude: 103.8607,
      address: '10 Bayfront Ave, Singapore 018956',
      active: true,
      importanceScore: 98,
      triggerRadius: 150,
      cooldownMinutes: 120,
    },
  })

  const chinatownHeritage = await prisma.poi.upsert({
    where: { id: 'poi-chinatown-heritage' },
    update: {
      tags: ['historic', 'cultural', 'hidden', 'local'],
      importanceScore: 75,
      triggerRadius: 80,
      cooldownMinutes: 60,
    },
    create: {
      id: 'poi-chinatown-heritage',
      cityId: singapore.id,
      name: 'Chinatown Heritage Centre',
      category: 'cultural',
      tags: ['historic', 'cultural', 'hidden', 'local'],
      geohash6: 'w21z1s',
      latitude: 1.2826,
      longitude: 103.8436,
      address: '48 Pagoda St, Singapore 059207',
      active: true,
      importanceScore: 75,
      triggerRadius: 80,
      cooldownMinutes: 60,
    },
  })

  const maxwellFoodCentre = await prisma.poi.upsert({
    where: { id: 'poi-maxwell-food-centre' },
    update: {
      tags: ['food', 'local', 'hawker', 'iconic', 'budget'],
      importanceScore: 85,
      triggerRadius: 80,
      cooldownMinutes: 60,
    },
    create: {
      id: 'poi-maxwell-food-centre',
      cityId: singapore.id,
      name: 'Maxwell Food Centre',
      category: 'food',
      tags: ['food', 'local', 'hawker', 'iconic', 'budget'],
      geohash6: 'w21z1q',
      latitude: 1.2802,
      longitude: 103.8444,
      address: '1 Kadayanallur St, Singapore 069184',
      active: true,
      importanceScore: 85,
      triggerRadius: 80,
      cooldownMinutes: 60,
    },
  })

  const gardensByTheBay = await prisma.poi.upsert({
    where: { id: 'poi-gardens-by-the-bay' },
    update: {
      tags: ['iconic', 'instagrammable', 'night', 'romantic', 'modern'],
      importanceScore: 92,
      triggerRadius: 200,
      cooldownMinutes: 90,
    },
    create: {
      id: 'poi-gardens-by-the-bay',
      cityId: singapore.id,
      name: 'Gardens by the Bay',
      category: 'park',
      tags: ['iconic', 'instagrammable', 'night', 'romantic', 'modern'],
      geohash6: 'w21z3s',
      latitude: 1.2816,
      longitude: 103.8636,
      address: '18 Marina Gardens Dr, Singapore 018953',
      active: true,
      importanceScore: 92,
      triggerRadius: 200,
      cooldownMinutes: 90,
    },
  })

  const annSiangHill = await prisma.poi.upsert({
    where: { id: 'poi-ann-siang-hill' },
    update: {
      tags: ['historic', 'hidden', 'night', 'romantic'],
      importanceScore: 88,
      triggerRadius: 80,
      cooldownMinutes: 60,
    },
    create: {
      id: 'poi-ann-siang-hill',
      cityId: singapore.id,
      name: 'Ann Siang Hill',
      category: 'cultural',
      tags: ['historic', 'hidden', 'night', 'romantic'],
      geohash6: 'w21z1u',
      latitude: 1.2802,
      longitude: 103.8455,
      address: 'Ann Siang Hill, Singapore 069791',
      active: true,
      importanceScore: 88,
      triggerRadius: 80,
      cooldownMinutes: 60,
    },
  })

  const evertonPark = await prisma.poi.upsert({
    where: { id: 'poi-everton-park' },
    update: {
      tags: ['local', 'food', 'hidden', 'artsy'],
      importanceScore: 82,
      triggerRadius: 80,
      cooldownMinutes: 60,
    },
    create: {
      id: 'poi-everton-park',
      cityId: singapore.id,
      name: 'Everton Park',
      category: 'street',
      tags: ['local', 'food', 'hidden', 'artsy'],
      geohash6: 'w21z1f',
      latitude: 1.2776,
      longitude: 103.8391,
      address: 'Everton Park, Singapore 080001',
      active: true,
      importanceScore: 82,
      triggerRadius: 80,
      cooldownMinutes: 60,
    },
  })

  const tiongBahruEstate = await prisma.poi.upsert({
    where: { id: 'poi-tiong-bahru-estate' },
    update: {
      tags: ['architecture', 'historic', 'local'],
      importanceScore: 90,
      triggerRadius: 120,
      cooldownMinutes: 90,
    },
    create: {
      id: 'poi-tiong-bahru-estate',
      cityId: singapore.id,
      name: 'Tiong Bahru Estate',
      category: 'landmark',
      tags: ['architecture', 'historic', 'local'],
      geohash6: 'w21z1b',
      latitude: 1.2847,
      longitude: 103.8270,
      address: 'Tiong Bahru, Singapore 168731',
      active: true,
      importanceScore: 90,
      triggerRadius: 120,
      cooldownMinutes: 90,
    },
  })

  // POIs near test location (Hougang / Serangoon area, lat 1.362 lng 103.887)
  const hougangCentral = await prisma.poi.upsert({
    where: { id: 'poi-hougang-central' },
    update: { tags: ['food', 'local', 'hawker', 'heartland'], importanceScore: 72, triggerRadius: 100, cooldownMinutes: 60 },
    create: {
      id: 'poi-hougang-central',
      cityId: singapore.id,
      name: 'Hougang Central Hawker Centre',
      category: 'food',
      tags: ['food', 'local', 'hawker', 'heartland'],
      geohash6: ngeohash.encode(1.3621, 103.8867, 6),
      latitude: 1.3621,
      longitude: 103.8867,
      address: 'Hougang Central, Singapore 538768',
      active: true,
      importanceScore: 72,
      triggerRadius: 100,
      cooldownMinutes: 60,
    },
  })

  const serangoonGardens = await prisma.poi.upsert({
    where: { id: 'poi-serangoon-gardens' },
    update: { tags: ['historic', 'local', 'neighbourhood', 'food'], importanceScore: 78, triggerRadius: 120, cooldownMinutes: 60 },
    create: {
      id: 'poi-serangoon-gardens',
      cityId: singapore.id,
      name: 'Serangoon Gardens Estate',
      category: 'cultural',
      tags: ['historic', 'local', 'neighbourhood', 'food'],
      geohash6: ngeohash.encode(1.3589, 103.8733, 6),
      latitude: 1.3589,
      longitude: 103.8733,
      address: 'Serangoon Gardens, Singapore 556083',
      active: true,
      importanceScore: 78,
      triggerRadius: 120,
      cooldownMinutes: 60,
    },
  })

  console.log(`✓ Created 10 POIs`)

  // ─────────────────────────────────────────
  // POI FACTS — curated verified facts
  // ─────────────────────────────────────────
  console.log('Creating POI facts...')

  await prisma.poiFact.createMany({
    skipDuplicates: true,
    data: [
      // Raffles Hotel
      {
        poiId: rafflesHotel.id,
        factType: 'historical',
        body: 'Raffles Hotel opened in 1887 and was named after Singapore\'s founder Sir Stamford Raffles. It began as a modest beach house before becoming one of Asia\'s most iconic colonial hotels.',
        verified: true,
      },
      {
        poiId: rafflesHotel.id,
        factType: 'cultural',
        body: 'The Singapore Sling cocktail was invented at Raffles Hotel\'s Long Bar in 1915 by bartender Ngiam Tong Boon. It was created so women could drink alcohol without appearing to do so in public.',
        verified: true,
      },

      // Marina Bay Sands
      {
        poiId: marinaBaySands.id,
        factType: 'architectural',
        body: 'Marina Bay Sands was designed by Israeli-Canadian architect Moshe Safdie. The SkyPark on top spans three towers and is longer than the Eiffel Tower is tall.',
        verified: true,
      },
      {
        poiId: marinaBaySands.id,
        factType: 'historical',
        body: 'Marina Bay Sands opened in 2010 and cost approximately S$8 billion to build, making it one of the most expensive standalone casino properties ever built.',
        verified: true,
      },

      // Chinatown Heritage Centre
      {
        poiId: chinatownHeritage.id,
        factType: 'historical',
        body: 'Chinatown was established in 1819 when Sir Stamford Raffles assigned different ethnic communities to separate districts. The Chinese community was given this area, then known as "Chia Keng".',
        verified: true,
      },
      {
        poiId: chinatownHeritage.id,
        factType: 'cultural',
        body: 'The shophouses in Chinatown follow the "five-foot way" design — a covered walkway exactly five feet wide mandated by Raffles himself so pedestrians could walk sheltered from rain and sun.',
        verified: true,
      },

      // Maxwell Food Centre
      {
        poiId: maxwellFoodCentre.id,
        factType: 'food',
        body: 'Maxwell Food Centre is home to Tian Tian Hainanese Chicken Rice, consistently ranked among the best chicken rice stalls in Singapore. It gained international fame after Gordon Ramsay visited in 2013.',
        verified: true,
      },
      {
        poiId: maxwellFoodCentre.id,
        factType: 'historical',
        body: 'The Maxwell Road Hawker Centre building dates to 1928, originally serving as a wet market. It was converted to a food centre in the 1980s as part of Singapore\'s hawker culture preservation effort.',
        verified: true,
      },

      // Gardens by the Bay
      {
        poiId: gardensByTheBay.id,
        factType: 'architectural',
        body: 'The Supertrees at Gardens by the Bay range from 25 to 50 metres tall and are vertical gardens that host over 162,900 plants from more than 200 species. Eleven of the 18 trees harvest solar energy.',
        verified: true,
      },
      {
        poiId: gardensByTheBay.id,
        factType: 'historical',
        body: 'Gardens by the Bay was built on 101 hectares of reclaimed land. The project took over a decade to plan and was officially opened by Prime Minister Lee Hsien Loong in June 2012.',
        verified: true,
      },

      // Ann Siang Hill
      {
        poiId: annSiangHill.id,
        factType: 'historical',
        body: 'Once known as Telok Ayer Hills, Ann Siang Hill was the social hub for wealthy Chinese merchants. Many shophouses still bear the names of Chinese clans that provided a safety net for 19th-century immigrants.',
        verified: true,
      },

      // Everton Park
      {
        poiId: evertonPark.id,
        factType: 'cultural',
        body: 'One of Singapore\'s oldest public housing estates, built in 1965. Famous for Yip Yew Chong\'s Amah mural — a life-sized painting of a traditional domestic helper reflecting the area\'s Peranakan heritage.',
        verified: true,
      },

      // Tiong Bahru Estate
      {
        poiId: tiongBahruEstate.id,
        factType: 'architectural',
        body: 'Built in the 1930s, Tiong Bahru is Singapore\'s first public housing estate. Its Streamline Moderne architecture was inspired by 1930s luxury ocean liners — look for the curved balconies and spiral staircases.',
        verified: true,
      },
    ],
  })

  console.log('✓ Created 13 POI facts')

  // ─────────────────────────────────────────
  // SAMPLE WHISPERS — one per POI
  // ─────────────────────────────────────────
  console.log('Creating sample whispers...')

  const rafflesWhisper = await prisma.generatedWhisper.upsert({
    where: { id: 'whisper-raffles-historian-evening' },
    update: {},
    create: {
      id: 'whisper-raffles-historian-evening',
      poiId: rafflesHotel.id,
      cityId: singapore.id,
      personaId: historian.id,
      geohash6: 'w21z9m',
      timeSlot: 'evening',
      whisperText:
        'In 1887, when this grand dame first opened her doors, Singapore was a colonial trading port buzzing with ambition. Raffles Hotel was not merely a building — it was a statement. Writers like Somerset Maugham and Rudyard Kipling lingered in these very corridors, finding stories in the humid air. And somewhere behind that Long Bar, a bartender named Ngiam quietly invented the Singapore Sling — a drink that tasted like the tropics and changed cocktail history forever.',
      modelUsed: 'seed',
      promptHash: 'seed-raffles-historian-evening',
      tokenCount: 89,
      source: 'curated',
      isStale: false,
    },
  })

  const maxwellWhisper = await prisma.generatedWhisper.upsert({
    where: { id: 'whisper-maxwell-foodie-afternoon' },
    update: {},
    create: {
      id: 'whisper-maxwell-foodie-afternoon',
      poiId: maxwellFoodCentre.id,
      cityId: singapore.id,
      personaId: foodie.id,
      geohash6: 'w21z1q',
      timeSlot: 'afternoon',
      whisperText:
        'Breathe in. That is the smell of chicken poached to silk, of rice cooked in golden broth, of chilli ground fresh this morning. Maxwell Food Centre has been feeding Singapore since 1928 — first as a wet market, then as a hawker haven. Stall 10 has a queue that never quite disappears. Tian Tian. Heavenly. The name says it all. Gordon Ramsay came here humbled. You should too.',
      modelUsed: 'seed',
      promptHash: 'seed-maxwell-foodie-afternoon',
      tokenCount: 82,
      source: 'curated',
      isStale: false,
    },
  })

  const gardensWhisper = await prisma.generatedWhisper.upsert({
    where: { id: 'whisper-gardens-default-night' },
    update: {},
    create: {
      id: 'whisper-gardens-default-night',
      poiId: gardensByTheBay.id,
      cityId: singapore.id,
      personaId: defaultPersona.id,
      geohash6: 'w21z3s',
      timeSlot: 'night',
      whisperText:
        'After dark, the Supertrees come alive with light and music — 50-metre steel giants that breathe, that glow, that pulse. They were planted on reclaimed land, on what was once open sea. Singapore did not just build a garden. It conjured one from the ocean itself. Stand here tonight and look up. These trees are not old. But somehow, they feel ancient.',
      modelUsed: 'seed',
      promptHash: 'seed-gardens-default-night',
      tokenCount: 76,
      source: 'curated',
      isStale: false,
    },
  })

  await prisma.generatedWhisper.upsert({
    where: { id: 'whisper-hougang-foodie-morning' },
    update: {},
    create: {
      id: 'whisper-hougang-foodie-morning',
      poiId: hougangCentral.id,
      cityId: singapore.id,
      personaId: foodie.id,
      geohash6: ngeohash.encode(1.3621, 103.8867, 6),
      timeSlot: 'morning',
      whisperText:
        'Before the heat rises and the lunch crowd descends, this hawker centre already smells of kaya toast and soft-boiled eggs. Aunties in plastic slippers arrive at dawn to claim the best stools. The char kway teow uncle has been at his wok since five. This is heartland Singapore — no tourist maps, no air-conditioning, just the real thing.',
      modelUsed: 'seed',
      promptHash: 'seed-hougang-foodie-morning',
      tokenCount: 74,
      source: 'curated',
      isStale: false,
    },
  })

  await prisma.generatedWhisper.upsert({
    where: { id: 'whisper-serangoon-historian-afternoon' },
    update: {},
    create: {
      id: 'whisper-serangoon-historian-afternoon',
      poiId: serangoonGardens.id,
      cityId: singapore.id,
      personaId: historian.id,
      geohash6: ngeohash.encode(1.3589, 103.8733, 6),
      timeSlot: 'afternoon',
      whisperText:
        'Serangoon Gardens was built in the 1950s for British civil servants who missed the green lanes of home. The bungalows here have stood long enough to collect stories — of families who arrived with suitcases and stayed for generations. The Chomp Chomp Food Centre nearby is their living room. In this corner of Singapore, neighbourhood still means something.',
      modelUsed: 'seed',
      promptHash: 'seed-serangoon-historian-afternoon',
      tokenCount: 78,
      source: 'curated',
      isStale: false,
    },
  })

  console.log('✓ Created 5 sample whispers')

  // ─────────────────────────────────────────
  // SAMPLE TRAIL
  // ─────────────────────────────────────────
  console.log('Creating sample trail...')

  const trail = await prisma.trail.upsert({
    where: { id: 'trail-singapore-colonial' },
    update: {},
    create: {
      id: 'trail-singapore-colonial',
      cityId: singapore.id,
      personaId: historian.id,
      title: 'Colonial Singapore',
      description: 'Walk through the layers of Singapore\'s colonial past — from Raffles Hotel to the waterfront that shaped a nation.',
      estimatedMinutes: 45,
    },
  })

  await prisma.trailStop.createMany({
    skipDuplicates: true,
    data: [
      {
        trailId: trail.id,
        whisperId: rafflesWhisper.id,
        stopOrder: 1,
        transitionText: 'Walk south along Beach Road for 10 minutes toward the waterfront.',
      },
      {
        trailId: trail.id,
        whisperId: gardensWhisper.id,
        stopOrder: 2,
        transitionText: 'Cross the Helix Bridge into Marina South Pier.',
      },
    ],
  })

  console.log('✓ Created sample trail with 2 stops')

  console.log('\n✅ Seed complete!')
  console.log('   4 personas')
  console.log('   1 city (Singapore)')
  console.log('   1 city pack')
  console.log('   10 POIs')
  console.log('   13 POI facts')
  console.log('   5 sample whispers')
  console.log('   1 trail with 2 stops')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })