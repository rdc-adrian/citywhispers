// apps/api/scripts/debug-pois.ts
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

// Initialize with Supabase connection
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL not found in environment');
}

const adapter = new PrismaPg(connectionString);
const prisma = new PrismaClient({ adapter });

async function debugPois() {
  console.log('🔍 Debugging POI data...\n');

  try {
    // Get Seoul POIs
    const seoulCity = await prisma.city.findFirst({
      where: { name: { contains: 'Seoul', mode: 'insensitive' } },
    });

    if (!seoulCity) {
      console.log('❌ Seoul city not found!');
      return;
    }

    console.log(`✅ Seoul city found: ${seoulCity.id}`);

    const seoulPois = await prisma.poi.findMany({
      where: {
        cityId: seoulCity.id,
        active: true,
      },
      take: 5,
      orderBy: {
        importanceScore: 'desc',
      },
    });

    console.log(`\n📍 Sample Seoul POIs (${seoulPois.length}):\n`);

    for (const poi of seoulPois) {
      console.log(`${poi.name}`);
      console.log(`  ID: ${poi.id}`);
      console.log(`  Location: ${poi.latitude}, ${poi.longitude}`);
      console.log(`  Category: ${poi.category}`);
      console.log(`  Geohash: ${poi.geohash6}`);
      console.log(`  Importance: ${poi.importanceScore}`);
      
      // Check if this POI has whispers
      const whisperCount = await prisma.generatedWhisper.count({
        where: { poiId: poi.id },
      });
      console.log(`  Whispers: ${whisperCount}`);
      console.log('');
    }

    // Test coordinates for Seoul city center
    const testLat = 37.5665;
    const testLng = 126.9780;
    
    console.log(`\n🧪 Testing nearby query at Seoul center (${testLat}, ${testLng})...\n`);

    // Simple distance calculation
    const nearbyPois = await prisma.$queryRaw<Array<{
      id: string;
      name: string;
      latitude: number;
      longitude: number;
      distance: number;
    }>>`
      SELECT 
        id,
        name,
        latitude,
        longitude,
        (
          6371000 * acos(
            cos(radians(${testLat})) * 
            cos(radians(latitude)) * 
            cos(radians(longitude) - radians(${testLng})) + 
            sin(radians(${testLat})) * 
            sin(radians(latitude))
          )
        ) as distance
      FROM "Poi"
      WHERE 
        "cityId" = ${seoulCity.id}
        AND active = true
      ORDER BY distance
      LIMIT 10
    `;

    console.log(`Found ${nearbyPois.length} POIs within calculation:\n`);
    
    for (const poi of nearbyPois) {
      console.log(`${poi.name} - ${Math.round(poi.distance)}m away`);
    }

    // Check Jeju
    console.log('\n\n🏝️ Checking Jeju...\n');
    
    const jejuCity = await prisma.city.findFirst({
      where: { name: { contains: 'Jeju', mode: 'insensitive' } },
    });

    if (jejuCity) {
      const jejuPois = await prisma.poi.findMany({
        where: { cityId: jejuCity.id, active: true },
        take: 3,
      });

      console.log(`✅ Jeju city found: ${jejuCity.id}`);
      console.log(`📍 Sample Jeju POIs (${jejuPois.length}):\n`);

      for (const poi of jejuPois) {
        console.log(`${poi.name} - ${poi.latitude}, ${poi.longitude}`);
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

debugPois()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
  