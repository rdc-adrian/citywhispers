import { PrismaClient } from '@prisma/client'
import geohash from 'ngeohash'

const prisma = new PrismaClient()

async function main() {
  console.log('🇸🇬 Seeding Singapore...')

  // First, find or create Singapore city
  let singapore = await prisma.city.findFirst({
    where: { name: 'Singapore' }
  })

  if (!singapore) {
    singapore = await prisma.city.create({
      data: {
        name: 'Singapore',
        countryCode: 'SG',
        timezone: 'Asia/Singapore',
        status: 'active',
      }
    })
    console.log('✅ Created Singapore city')
  } else {
    console.log('✅ Found Singapore city')
  }

  // POIs to create
  const pois = [
    {
      id: 'marina_bay_sands_sg',
      name: 'Marina Bay Sands',
      latitude: 1.2834,
      longitude: 103.8607,
      category: 'landmark',
      tags: ['iconic', 'resort', 'pool'],
      address: '10 Bayfront Avenue, Singapore 018956',
    },
    {
      id: 'gardens_by_the_bay_sg',
      name: 'Gardens by the Bay',
      latitude: 1.2816,
      longitude: 103.8636,
      category: 'park',
      tags: ['nature', 'supertrees', 'conservatory'],
      address: '18 Marina Gardens Drive, Singapore 018953',
    },
    {
      id: 'merlion_park_sg',
      name: 'Merlion Park',
      latitude: 1.2868,
      longitude: 103.8545,
      category: 'landmark',
      tags: ['statue', 'waterfront', 'tourist'],
      address: 'One Fullerton, Singapore 049213',
    },
    {
      id: 'chinatown_singapore_sg',
      name: 'Chinatown',
      latitude: 1.2839,
      longitude: 103.8446,
      category: 'district',
      tags: ['heritage', 'food', 'temples'],
      address: 'Chinatown, Singapore',
    },
    {
      id: 'arab_street_sg',
      name: 'Arab Street',
      latitude: 1.3024,
      longitude: 103.8589,
      category: 'street',
      tags: ['culture', 'shopping', 'mosque'],
      address: 'Arab Street, Singapore',
    },
    {
      id: 'clarke_quay_sg',
      name: 'Clarke Quay',
      latitude: 1.2903,
      longitude: 103.8467,
      category: 'district',
      tags: ['nightlife', 'riverside', 'restaurants'],
      address: 'Clarke Quay, Singapore',
    },
    {
      id: 'haji_lane_sg',
      name: 'Haji Lane',
      latitude: 1.3007,
      longitude: 103.8590,
      category: 'street',
      tags: ['art', 'boutique', 'hipster'],
      address: 'Haji Lane, Singapore',
    },
    {
      id: 'sentosa_island_sg',
      name: 'Sentosa Island',
      latitude: 1.2494,
      longitude: 103.8303,
      category: 'landmark',
      tags: ['beach', 'resort', 'attractions'],
      address: 'Sentosa Island, Singapore',
    },
  ]

  // Create POIs
  for (const poi of pois) {
    const geohash6 = geohash.encode(poi.latitude, poi.longitude, 6)
    
    await prisma.poi.upsert({
      where: { id: poi.id },
      update: {
        cityId: singapore.id,
        name: poi.name,
        category: poi.category,
        tags: poi.tags,
        geohash6,
        address: poi.address,
        latitude: poi.latitude,
        longitude: poi.longitude,
        active: true,
        importanceScore: 70,
        triggerRadius: 100,
        cooldownMinutes: 60,
      },
      create: {
        id: poi.id,
        cityId: singapore.id,
        name: poi.name,
        category: poi.category,
        tags: poi.tags,
        geohash6,
        address: poi.address,
        latitude: poi.latitude,
        longitude: poi.longitude,
        active: true,
        importanceScore: 70,
        triggerRadius: 100,
        cooldownMinutes: 60,
      },
    })
    console.log(`✅ Created POI: ${poi.name}`)
  }

  console.log('🎉 Singapore POIs seeded successfully!')
  console.log(`📍 Total POIs: ${pois.length}`)
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })