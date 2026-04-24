import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import ngeohash from 'ngeohash'
import 'dotenv/config'

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
})

const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Starting seed...')

  const persona = await prisma.persona.upsert({
    where: { slug: 'default' },
    update: {},
    create: {
      slug: 'default',
      name: 'The Observer',
      tonePrompt: 'Subtle, observational, and grounded. Feels discovered, not narrated.',
      active: true,
    },
  })
  console.log('Persona ready:', persona.name)

  const seoul = await prisma.city.upsert({
    where: { id: 'city-seoul' },
    update: {},
    create: { id: 'city-seoul', name: 'Seoul', countryCode: 'KR', timezone: 'Asia/Seoul', status: 'active' },
  })

  const jeju = await prisma.city.upsert({
    where: { id: 'city-jeju' },
    update: {},
    create: { id: 'city-jeju', name: 'Jeju', countryCode: 'KR', timezone: 'Asia/Seoul', status: 'active' },
  })

  console.log('Cities ready')

  const seoulPois = [
    { id: 'sewoon_sangga', name: 'Sewoon Sangga', category: 'landmark', latitude: 37.5695, longitude: 126.9997, address: '157 Cheonggyecheon-ro, Jongno-gu, Seoul', importanceScore: 85 },
    { id: 'pimatgol_alley', name: 'Pimatgol', category: 'alley', latitude: 37.5715, longitude: 126.9823, address: 'Pimatgol, Jongno-gu, Seoul', importanceScore: 75 },
    { id: 'ikseon_dong_hanok', name: 'Ikseon-dong Hanok Village', category: 'neighbourhood', latitude: 37.5762, longitude: 126.9927, address: 'Ikseon-dong, Jongno-gu, Seoul', importanceScore: 85 },
    { id: 'dongdaemun_design_plaza', name: 'Dongdaemun Design Plaza', category: 'landmark', latitude: 37.5670, longitude: 127.0095, address: '281 Eulji-ro, Jung-gu, Seoul', importanceScore: 90 },
    { id: 'cheonggyecheon_stream', name: 'Cheonggyecheon Stream', category: 'landmark', latitude: 37.5696, longitude: 126.9783, address: 'Cheonggyecheon-ro, Jung-gu, Seoul', importanceScore: 90 },
    { id: 'oil_tank_culture_park', name: 'Oil Tank Culture Park', category: 'park', latitude: 37.5657, longitude: 126.8977, address: '87 Jeungsan-ro, Mapo-gu, Seoul', importanceScore: 80 },
    { id: 'seoullo_7017', name: 'Seoullo 7017', category: 'landmark', latitude: 37.5536, longitude: 126.9713, address: 'Seoullo 7017, Seodaemun-gu, Seoul', importanceScore: 85 },
    { id: 'donuimun_museum_village', name: 'Donuimun Museum Village', category: 'site', latitude: 37.5712, longitude: 126.9631, address: '15 Saemunan-ro, Seodaemun-gu, Seoul', importanceScore: 80 },
    { id: 'euljiro_industrial_alleys', name: 'Euljiro Printing and Hardware Alleys', category: 'alley', latitude: 37.5662, longitude: 126.9934, address: 'Euljiro 3-ga, Jung-gu, Seoul', importanceScore: 80 },
    { id: 'gyeongui_line_forest_park', name: 'Gyeongui Line Forest Park', category: 'park', latitude: 37.5607, longitude: 126.9239, address: 'Yeonnam-dong, Mapo-gu, Seoul', importanceScore: 80 },
    { id: 'jongmyo_shrine', name: 'Jongmyo Shrine', category: 'landmark', latitude: 37.5752, longitude: 126.9940, address: '157 Jong-ro, Jongno-gu, Seoul', importanceScore: 95 },
    { id: 'seodaemun_prison', name: 'Seodaemun Prison History Hall', category: 'site', latitude: 37.5791, longitude: 126.9597, address: '251 Tongil-ro, Seodaemun-gu, Seoul', importanceScore: 90 },
    { id: 'sungnyemun_gate', name: 'Sungnyemun Gate', category: 'landmark', latitude: 37.5600, longitude: 126.9752, address: '40 Sejong-daero, Jung-gu, Seoul', importanceScore: 95 },
    { id: 'namsangol_hanok_village', name: 'Namsangol Hanok Village', category: 'site', latitude: 37.5594, longitude: 126.9942, address: '28 Toegye-ro 34-gil, Jung-gu, Seoul', importanceScore: 80 },
    { id: 'tapgol_park', name: 'Tapgol Park', category: 'park', latitude: 37.5720, longitude: 126.9877, address: '99 Jong-ro, Jongno-gu, Seoul', importanceScore: 85 },
    { id: 'euljiro_nogari_alley', name: 'Euljiro Nogari Alley', category: 'alley', latitude: 37.5659, longitude: 126.9910, address: 'Euljiro 3-ga, Jung-gu, Seoul', importanceScore: 75 },
    { id: 'gwangtonggyo_bridge', name: 'Gwangtonggyo Bridge', category: 'landmark', latitude: 37.5697, longitude: 126.9804, address: 'Cheonggyecheon-ro, Jongno-gu, Seoul', importanceScore: 80 },
    { id: 'd_tower_gwanghwamun', name: 'Gwanghwamun D-Tower', category: 'landmark', latitude: 37.5720, longitude: 126.9763, address: '17 Jong-ro 3-gil, Jongno-gu, Seoul', importanceScore: 70 },
    { id: 'seodaemun_independence_park', name: 'Seodaemun Independence Park', category: 'park', latitude: 37.5795, longitude: 126.9581, address: '251 Tongil-ro, Seodaemun-gu, Seoul', importanceScore: 85 },
    { id: 'dongmyo_flea_market', name: 'Dongmyo Flea Market', category: 'site', latitude: 37.5714, longitude: 127.0134, address: 'Jangchungdan-ro, Jongno-gu, Seoul', importanceScore: 75 },
    { id: 'changsin_cliff_village', name: 'Changsin-dong Cliff Village', category: 'neighbourhood', latitude: 37.5788, longitude: 127.0051, address: 'Changsin-dong, Jongno-gu, Seoul', importanceScore: 80 },
    { id: 'deoksugung_stonewall_path', name: 'Deoksugung Stonewall Path', category: 'street', latitude: 37.5659, longitude: 126.9745, address: 'Jeongdong-gil, Jung-gu, Seoul', importanceScore: 85 },
    { id: 'sajikdan_altar', name: 'Sajikdan Altar', category: 'site', latitude: 37.5784, longitude: 126.9696, address: 'Sajik-ro, Jongno-gu, Seoul', importanceScore: 80 },
    { id: 'euljiro_tool_alley', name: 'Euljiro Tool and Industrial Alleys', category: 'alley', latitude: 37.5655, longitude: 126.9920, address: 'Euljiro, Jung-gu, Seoul', importanceScore: 75 },
  ]

  for (const poi of seoulPois) {
    const geohash6 = ngeohash.encode(poi.latitude, poi.longitude, 6)
    await prisma.poi.upsert({
      where: { id: poi.id },
      update: {},
      create: { ...poi, cityId: seoul.id, geohash6, active: true, tags: [] },
    })
    console.log('Seoul POI seeded:', poi.name)
  }

  const jejuPois = [
    { id: 'manjanggul_cave', name: 'Manjanggul Cave', category: 'cave', latitude: 33.5284, longitude: 126.7713, address: '182 Manjanggul-gil, Gujwa-eup, Jeju', importanceScore: 95 },
    { id: 'daepo_jusangjeolli', name: 'Daepo Jusangjeolli Cliff', category: 'coastline', latitude: 33.2417, longitude: 126.4226, address: '36-30 Ieodo-ro, Seogwipo', importanceScore: 90 },
    { id: 'seopjikoji', name: 'Seopjikoji', category: 'coastline', latitude: 33.4601, longitude: 126.9298, address: 'Seopjikoji-ro, Seongsan-eup, Seogwipo', importanceScore: 85 },
    { id: 'dongmun_market', name: 'Jeju Dongmun Traditional Market', category: 'market', latitude: 33.5111, longitude: 126.5295, address: '18 Gwaldeok-ro 14-gil, Jeju City', importanceScore: 85 },
    { id: 'jeju_stone_park', name: 'Jeju Stone Park', category: 'site', latitude: 33.4707, longitude: 126.7646, address: '2894-70 Jeonyeok-ro, Jocheon-eup, Jeju', importanceScore: 80 },
    { id: 'seongsan_ilchulbong', name: 'Seongsan Ilchulbong', category: 'landmark', latitude: 33.4586, longitude: 126.9425, address: 'Seongsan-eup, Seogwipo', importanceScore: 95 },
    { id: 'jeongbang_waterfall', name: 'Jeongbang Waterfall', category: 'landmark', latitude: 33.2458, longitude: 126.5631, address: '37 Chilsimni-ro 214-beon-gil, Seogwipo', importanceScore: 85 },
    { id: 'handam_coastal_walk', name: 'Handam Coastal Walk', category: 'trail', latitude: 33.4678, longitude: 126.3011, address: 'Aewol-eup, Jeju City', importanceScore: 80 },
    { id: 'lee_jung_seop_street', name: 'Lee Jung-seop Cultural Street', category: 'street', latitude: 33.2498, longitude: 126.5619, address: 'Lee Jung-seop-ro, Seogwipo', importanceScore: 80 },
    { id: 'yongmeori_coast', name: 'Yongmeori Coast', category: 'coastline', latitude: 33.2344, longitude: 126.3121, address: 'Sanbang-ro, Andeok-myeon, Seogwipo', importanceScore: 85 },
    { id: 'yongduam_rock', name: 'Yongduam Rock', category: 'landmark', latitude: 33.5157, longitude: 126.4846, address: 'Yongduam-ro, Jeju City', importanceScore: 80 },
    { id: 'jeju_batdam_trail', name: 'Jeju Batdam Trail', category: 'trail', latitude: 33.3887, longitude: 126.2443, address: 'Hallim-eup, Jeju City', importanceScore: 80 },
    { id: 'seogwipo_olle_market', name: 'Seogwipo Maeil Olle Market', category: 'market', latitude: 33.2513, longitude: 126.5631, address: '22 Jungjeong-ro, Seogwipo', importanceScore: 80 },
    { id: 'haenyeo_museum_site', name: 'Jeju Haenyeo Museum', category: 'site', latitude: 33.5238, longitude: 126.8701, address: '26 Haenyeo-bak-ro, Gujwa-eup, Jeju', importanceScore: 85 },
  ]

  for (const poi of jejuPois) {
    const geohash6 = ngeohash.encode(poi.latitude, poi.longitude, 6)
    await prisma.poi.upsert({
      where: { id: poi.id },
      update: {},
      create: { ...poi, cityId: jeju.id, geohash6, active: true, tags: [] },
    })
    console.log('Jeju POI seeded:', poi.name)
  }

  const seoulWhispers = [
    { id: 'w-sewoon_sangga', poiId: 'sewoon_sangga', timeSlot: 'afternoon', whisperText: `You step onto the elevated deck and the traffic drops away beneath you. The concrete stretches in a long, continuous line, nearly a kilometer from end to end. Small electronics shops sit below, their interiors dense with parts and repairs. This structure was completed in 1968 as Korea's first integrated residential and commercial complex. It stands where a cleared firebreak once cut through the city in 1945. The walkway you follow was restored decades later. It now reconnects paths that had been broken.` },
    { id: 'w-pimatgol_alley', poiId: 'pimatgol_alley', timeSlot: 'morning', whisperText: `You turn into the narrow passage and the road beside it disappears. The alley runs parallel to Jongno, but it feels sealed off, barely two meters wide in places. Wires hang low above stone paving and older shop signs remain fixed to the walls. The name means avoiding horses. It began as a route for commoners who did not want to bow to passing aristocrats. Parts of it have been absorbed into newer buildings. What remains is tucked behind glass towers.` },
    { id: 'w-ikseon_dong_hanok', poiId: 'ikseon_dong_hanok', timeSlot: 'afternoon', whisperText: `You move through a tight grid of low roofs and narrow paths. The alleys twist without a clear pattern, opening briefly into small courtyards before closing again. These houses were built in the 1920s as dense housing for working-class residents. Their shared walls and compact layout remain intact. Many now hold cafes and small shops. The rooflines stay low while taller buildings rise just beyond the edges. The older structure of the neighborhood still defines how you move through it.` },
    { id: 'w-dongdaemun_design_plaza', poiId: 'dongdaemun_design_plaza', timeSlot: 'evening', whisperText: `You stand near the edge of the structure and the surface curves without a straight line. The exterior is formed from thousands of aluminum panels, each shaped differently. The building opened in 2014. It sits on the site of a former stadium built during the colonial period. Below, older stone foundations and sections of the city wall are preserved within the park. The ground shifts between excavation and new construction. The two layers remain visible at the same time.` },
    { id: 'w-cheonggyecheon_stream', poiId: 'cheonggyecheon_stream', timeSlot: 'morning', whisperText: `You walk down the steps and the street level lifts above you. The stream runs through the city in a long, controlled channel, its water continuously pumped. It follows the path of an older waterway that was once covered by concrete and an elevated road. The restoration removed that structure and reopened the space. Bridges cross overhead at regular intervals. Some elements of the former highway remain in place nearby. The corridor below stays separate from the traffic above.` },
    { id: 'w-oil_tank_culture_park', poiId: 'oil_tank_culture_park', timeSlot: 'afternoon', whisperText: `You walk between circular steel walls and the air feels contained, as if the space still holds its previous function. Six tanks sit apart from each other, each with a different condition. One remains rusted and untouched, while another encloses a glass structure within its original stone boundary. This site stored over 69 million liters of oil after 1973. It was closed for decades before reopening in 2017. The paths now move through forested edges and between heavy industrial forms that were never removed.` },
    { id: 'w-seoullo_7017', poiId: 'seoullo_7017', timeSlot: 'evening', whisperText: `You step onto the elevated path and look down through a glass opening at the traffic below. The structure runs just over a kilometer, suspended above the roads and rail lines near Seoul Station. It was built from a highway completed in 1970 and later closed due to structural concerns. The path reopened in 2017 with plants arranged in circular concrete planters. Connections branch off toward nearby districts. The original purpose of the road is still visible in its straight, linear form.` },
    { id: 'w-donuimun_museum_village', poiId: 'donuimun_museum_village', timeSlot: 'afternoon', whisperText: `You walk along a narrow path and the buildings shift in style every few steps. A hanok sits beside a brick house, followed by a structure from a later decade. Around forty buildings remain here, preserved instead of replaced. The site stands where the western gate of the city wall once existed before its demolition in 1915. The village was marked for redevelopment but retained in 2017. The layout follows older residential patterns, even as taller office buildings rise immediately beyond its edges.` },
    { id: 'w-euljiro_industrial_alleys', poiId: 'euljiro_industrial_alleys', timeSlot: 'morning', whisperText: `You move through a tight alley where machines and pedestrians share the same narrow space. Stacks of metal and paper extend out from ground-floor workshops. This district contains thousands of small factories and printing shops clustered within a few blocks. It developed as an industrial center during the 1960s and 70s. Upper floors now hold cafes and bars with minimal signage. The buildings remain low and worn, with exposed pipes and wiring running across their surfaces.` },
    { id: 'w-gyeongui_line_forest_park', poiId: 'gyeongui_line_forest_park', timeSlot: 'morning', whisperText: `You follow a straight path where sections of iron rail still appear underfoot. The corridor stretches across several neighborhoods, replacing a railway line built in 1906. The tracks were moved underground between 2005 and 2012. The space above became a long, narrow park. In some sections, a shallow stream runs alongside the walkway. Residential buildings line both sides, many converted into cafes. The linear shape remains fixed, marking the exact route the trains once followed.` },
    { id: 'w-jongmyo_shrine', poiId: 'jongmyo_shrine', timeSlot: 'morning', whisperText: `You stand at the edge of a wide stone courtyard facing a long wooden hall that stretches across the frame. The facade runs over a hundred meters, divided into multiple chambers. Three stone paths cut through the ground, with the raised center line set apart. This shrine was first built in 1394 and later reconstructed after destruction in the 16th century. It remains a site for ancestral rites. The surrounding trees block out much of the city, keeping the space enclosed and quiet.` },
    { id: 'w-seodaemun_prison', poiId: 'seodaemun_prison', timeSlot: 'afternoon', whisperText: `You walk down a narrow corridor lined with heavy doors and barred windows. The buildings are arranged in a radial layout, allowing visibility from a central point. The complex opened in 1908 as a prison facility. It was used to detain independence activists during the colonial period. After 1945, it continued operating under a different government until 1987. The red brick structures remain intact. High walls and watchtowers still define the perimeter against the surrounding residential blocks.` },
    { id: 'w-sungnyemun_gate', poiId: 'sungnyemun_gate', timeSlot: 'morning', whisperText: `You stand at the edge of a wide road and the gate rises alone at the center of the traffic. A stone arch forms the base, supporting a two-level wooden pavilion above. The structure dates back to the late 14th century, built as the main southern entrance to the city wall. It survived multiple conflicts before the upper structure was destroyed in 2008 and rebuilt using traditional methods. The surrounding roads remain wide and constant, isolating the gate within modern movement.` },
    { id: 'w-namsangol_hanok_village', poiId: 'namsangol_hanok_village', timeSlot: 'afternoon', whisperText: `You walk between wooden structures set along a gentle slope, each with a different scale and layout. The houses were relocated here to represent various social classes from the Joseon period. Some are compact, while others open into larger courtyards. The site includes a pond and a pavilion positioned within the landscape. It was established in 1998 on land that once held a military facility. The arrangement forms a contained cluster, distinct from the dense buildings just beyond the boundary.` },
    { id: 'w-tapgol_park', poiId: 'tapgol_park', timeSlot: 'morning', whisperText: `You step into a walled park and see a tall stone pagoda enclosed within a glass structure. The park sits directly along a main road, but the interior remains separated. It was built on the grounds of a former temple site. In 1919, a public declaration was read here, marking the start of a national movement. An octagonal pavilion stands nearby. Bronze panels line parts of the park, depicting scenes from that period. The layout remains compact and enclosed within its boundaries.` },
    { id: 'w-euljiro_nogari_alley', poiId: 'euljiro_nogari_alley', timeSlot: 'evening', whisperText: `You step into the alley and the space narrows until tables fill almost the entire width. Plastic chairs press against each other under dense neon signs. By evening, the corridor is fully occupied, leaving little room to pass through. This place formed in the 1980s for workers from nearby industrial shops. The buildings around you still hold those workshops during the day. The ground remains marked by that earlier use, even as the activity shifts at night.` },
    { id: 'w-gwangtonggyo_bridge', poiId: 'gwangtonggyo_bridge', timeSlot: 'afternoon', whisperText: `You stand along the stream and look up at the low stone arch crossing above. The bridge rests on large granite blocks, some surfaces showing worn carvings. It was rebuilt in stone in 1410 to replace an earlier wooden version. The materials include stones taken from a royal tomb. The structure now sits slightly away from its original position. Water moves beneath it at a lower level than the surrounding streets. The older construction remains visible within the modern setting.` },
    { id: 'w-d_tower_gwanghwamun', poiId: 'd_tower_gwanghwamun', timeSlot: 'morning', whisperText: `You walk through an open ground level where the building splits into two vertical towers above. The lower section forms a passage with smaller-scale storefronts arranged along it. The structure was completed in 2014 using a steel frame and glass exterior. It stands on land that once formed part of a network of narrow alleys. During construction, older drainage systems and foundations were uncovered. The current layout leaves space at ground level where those earlier pathways once ran.` },
    { id: 'w-seodaemun_independence_park', poiId: 'seodaemun_independence_park', timeSlot: 'morning', whisperText: `You move across an open plaza and the stone gate rises ahead, set apart from the surrounding roads. The structure was built in 1897 to mark a shift in diplomatic relations. Nearby, the grounds extend toward enclosed brick buildings from a former prison complex. The gate has been relocated slightly from its original position. The park spans a wide area, combining open space with walled sections. Statues line parts of the paths, marking figures connected to the site's history.` },
    { id: 'w-dongmyo_flea_market', poiId: 'dongmyo_flea_market', timeSlot: 'afternoon', whisperText: `You walk along a crowded path where goods are laid directly on the ground in uneven rows. Items form loose piles, spilling across blankets and pavement. The market developed after the war as a place to trade used supplies. It runs alongside the stone walls of a shrine built in the early 17th century. The boundary between the two remains sharp, with the wall rising directly behind the stalls. The layout extends through narrow side alleys branching from the main stretch.` },
    { id: 'w-changsin_cliff_village', poiId: 'changsin_cliff_village', timeSlot: 'morning', whisperText: `You move uphill along a narrow path where the ground rises sharply beneath your steps. Houses sit directly against exposed granite faces, some built into the slope itself. The terrain drops away in steep sections between clustered homes. This area once functioned as a quarry during the colonial period, with stone extracted for major buildings across the city. After the war, the space shifted into a base for small sewing workshops. Those activities still continue in rooms pressed into the lower levels of the village.` },
    { id: 'w-deoksugung_stonewall_path', poiId: 'deoksugung_stonewall_path', timeSlot: 'afternoon', whisperText: `You walk beside a curved stone wall that follows the edge of a palace perimeter. The path runs without interruption for several hundred meters, lined with evenly spaced trees. The surface underfoot is smooth and designed for pedestrians, with no clear separation from surrounding space. This corridor connects several historical sites along its length. In the late 19th century, this area formed part of a foreign legation district. The wall remains intact as a continuous boundary against the surrounding streets.` },
    { id: 'w-sajikdan_altar', poiId: 'sajikdan_altar', timeSlot: 'morning', whisperText: `You step into an open square where two stone altars sit separated within a quiet courtyard. The space is minimal, with no decorative elements beyond the stone boundaries and surrounding gates. This site was established in 1394 for state rituals dedicated to earth and grain deities. During the colonial period, its function was reduced and the area was turned into a public park. The altars remain aligned within a formal layout, positioned within a simple rectangular enclosure near busy roads.` },
    { id: 'w-euljiro_tool_alley', poiId: 'euljiro_tool_alley', timeSlot: 'morning', whisperText: `You walk through a tight network of alleys where metal sounds and machine work come from open workshop fronts. Sparks flicker briefly as materials are cut or welded in small ground-floor spaces. This district developed as an industrial center during the mid-20th century and now contains thousands of small workshops. Above them, newer businesses occupy upper floors in older concrete buildings. Pipes and wiring remain exposed across facades, marking the layered use of the same narrow corridors.` },
  ]

  for (const w of seoulWhispers) {
    const poi = seoulPois.find((p) => p.id === w.poiId)
    if (!poi) { console.warn('POI not found:', w.poiId); continue }
    const geohash6 = ngeohash.encode(poi.latitude, poi.longitude, 6)
    await prisma.generatedWhisper.upsert({
      where: { id: w.id },
      update: {},
      create: { id: w.id, poiId: w.poiId, cityId: seoul.id, personaId: persona.id, geohash6, timeSlot: w.timeSlot, whisperText: w.whisperText, audioUrl: null, modelUsed: 'curated', promptHash: w.id, source: 'curated', isStale: false },
    })
    console.log('Seoul whisper seeded:', w.poiId)
  }

  const jejuWhispers = [
    { id: 'w-manjanggul_cave', poiId: 'manjanggul_cave', timeSlot: 'morning', whisperText: `A buried river of fire turned to silence, where the island's volcanic breath still lingers in the dark.` },
    { id: 'w-daepo_jusangjeolli', poiId: 'daepo_jusangjeolli', timeSlot: 'afternoon', whisperText: `Stone pillars stand like frozen waves, as if the ocean once hardened mid-sigh along the shore.` },
    { id: 'w-seopjikoji', poiId: 'seopjikoji', timeSlot: 'afternoon', whisperText: `Red earth cliffs lean into the wind, where the sea and land keep negotiating without ever agreeing.` },
    { id: 'w-dongmun_market', poiId: 'dongmun_market', timeSlot: 'morning', whisperText: `A restless maze of salt, citrus, and voices where Jeju's daily life is traded in colour and noise.` },
    { id: 'w-jeju_stone_park', poiId: 'jeju_stone_park', timeSlot: 'afternoon', whisperText: `An open archive of stone memories, where every basalt figure feels like it's quietly remembering the island's past.` },
    { id: 'w-seongsan_ilchulbong', poiId: 'seongsan_ilchulbong', timeSlot: 'morning', whisperText: `A crater-shaped crown of earth, where sunrise feels like it's being born directly from the island itself.` },
    { id: 'w-jeongbang_waterfall', poiId: 'jeongbang_waterfall', timeSlot: 'afternoon', whisperText: `Water falls without hesitation into the sea, as if land was never meant to stop it.` },
    { id: 'w-handam_coastal_walk', poiId: 'handam_coastal_walk', timeSlot: 'morning', whisperText: `A shoreline path where basalt meets turquoise calm, and every step feels borrowed from the wind.` },
    { id: 'w-lee_jung_seop_street', poiId: 'lee_jung_seop_street', timeSlot: 'afternoon', whisperText: `An alley where paintings refuse to fade, and the walls still carry traces of an artist's quiet exile.` },
    { id: 'w-yongmeori_coast', poiId: 'yongmeori_coast', timeSlot: 'morning', whisperText: `A dragon-shaped coastline carved by time, where layered cliffs tell stories written in stone and tide.` },
    { id: 'w-yongduam_rock', poiId: 'yongduam_rock', timeSlot: 'morning', whisperText: `A stone head gazing endlessly at the horizon, as if waiting for an answer only the sea remembers.` },
    { id: 'w-jeju_batdam_trail', poiId: 'jeju_batdam_trail', timeSlot: 'afternoon', whisperText: `Fields stitched with black stone walls, where the island learns to hold its ground against the wind.` },
    { id: 'w-seogwipo_olle_market', poiId: 'seogwipo_olle_market', timeSlot: 'morning', whisperText: `A warm corridor of flavours and footsteps, where the island's southern rhythm gathers under one roof.` },
    { id: 'w-haenyeo_museum_site', poiId: 'haenyeo_museum_site', timeSlot: 'morning', whisperText: `A quiet tribute to women who learned to belong beneath the waves, where the sea is both memory and livelihood.` },
  ]

  for (const w of jejuWhispers) {
    const poi = jejuPois.find((p) => p.id === w.poiId)
    if (!poi) { console.warn('POI not found:', w.poiId); continue }
    const geohash6 = ngeohash.encode(poi.latitude, poi.longitude, 6)
    await prisma.generatedWhisper.upsert({
      where: { id: w.id },
      update: {},
      create: { id: w.id, poiId: w.poiId, cityId: jeju.id, personaId: persona.id, geohash6, timeSlot: w.timeSlot, whisperText: w.whisperText, audioUrl: null, modelUsed: 'curated', promptHash: w.id, source: 'curated', isStale: false },
    })
    console.log('Jeju whisper seeded:', w.poiId)
  }

  console.log('\nAll done. Seoul and Jeju are live.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
