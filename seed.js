require('dotenv').config()
const mongoose = require('mongoose')
const bcrypt = require('bcrypt')
const User = require('./models/User')
const Item = require('./models/Item')

const HASHED_PW = bcrypt.hashSync('Rewear2025', 10)

// ── 38 Bahraini users spread across all governorates ──────────────────────────
const USERS_DATA = [
  // Capital Governorate
  { username: 'fatima_seef',      neighborhood: 'Seef',          coordinates: [50.5264, 26.2128] },
  { username: 'ahmed_juffair',    neighborhood: 'Juffair',       coordinates: [50.5958, 26.2198] },
  { username: 'sara_adliya',      neighborhood: 'Adliya',        coordinates: [50.5886, 26.2072] },
  { username: 'khalid_manama',    neighborhood: 'Manama',        coordinates: [50.5860, 26.2154] },
  { username: 'noor_zinj',        neighborhood: 'Zinj',          coordinates: [50.5650, 26.2050] },
  { username: 'jasim_salmaniya',  neighborhood: 'Salmaniya',     coordinates: [50.5780, 26.2100] },
  { username: 'reem_hoora',       neighborhood: 'Hoora',         coordinates: [50.5833, 26.2300] },
  { username: 'ali_gudaibiya',    neighborhood: 'Gudaibiya',     coordinates: [50.5833, 26.2100] },
  { username: 'lulwa_sanabis',    neighborhood: 'Sanabis',       coordinates: [50.5700, 26.2200] },
  { username: 'faisal_jidd_hafs', neighborhood: 'Jidd Hafs',     coordinates: [50.5500, 26.2200] },
  // Muharraq Governorate
  { username: 'mariam_muharraq',  neighborhood: 'Muharraq',      coordinates: [50.6119, 26.2574] },
  { username: 'yousif_hidd',      neighborhood: 'Hidd',          coordinates: [50.6500, 26.2500] },
  { username: 'shaikha_amwaj',    neighborhood: 'Amwaj Islands', coordinates: [50.6656, 26.2850] },
  { username: 'hamad_arad',       neighborhood: 'Arad',          coordinates: [50.6200, 26.2400] },
  { username: 'dana_busaiteen',   neighborhood: 'Busaiteen',     coordinates: [50.6100, 26.2400] },
  { username: 'tariq_galali',     neighborhood: 'Galali',        coordinates: [50.6300, 26.2600] },
  { username: 'hessa_dair',       neighborhood: 'Dair',          coordinates: [50.6150, 26.2700] },
  // Northern Governorate
  { username: 'ibrahim_saar',     neighborhood: 'Saar',          coordinates: [50.4822, 26.2108] },
  { username: 'maryam_budaiya',   neighborhood: 'Budaiya',       coordinates: [50.4500, 26.2200] },
  { username: 'bader_janabiyah',  neighborhood: 'Janabiyah',     coordinates: [50.5000, 26.2300] },
  { username: 'noura_barbar',     neighborhood: 'Barbar',        coordinates: [50.5100, 26.2400] },
  { username: 'abdulla_diraz',    neighborhood: 'Diraz',         coordinates: [50.4900, 26.2350] },
  { username: 'lubna_hamala',     neighborhood: 'Hamala',        coordinates: [50.5050, 26.2250] },
  { username: 'talal_tubli',      neighborhood: 'Tubli',         coordinates: [50.5650, 26.1850] },
  { username: 'zainab_sehla',     neighborhood: 'Sehla',         coordinates: [50.5200, 26.2150] },
  { username: 'wafa_karbabad',    neighborhood: 'Karbabad',      coordinates: [50.4950, 26.2300] },
  { username: 'hassan_malkiya',   neighborhood: 'Malkiya',       coordinates: [50.4300, 26.2300] },
  // Southern Governorate
  { username: 'layla_riffa',      neighborhood: 'Riffa',         coordinates: [50.5500, 26.1333] },
  { username: 'mohammed_isa',     neighborhood: 'Isa Town',      coordinates: [50.5450, 26.1750] },
  { username: 'aisha_hamad',      neighborhood: 'Hamad Town',    coordinates: [50.5000, 26.1500] },
  { username: 'yusuf_aali',       neighborhood: "A'ali",         coordinates: [50.5289, 26.1700] },
  { username: 'rawan_sitra',      neighborhood: 'Sitra',         coordinates: [50.6350, 26.1700] },
  { username: 'omar_west_riffa',  neighborhood: 'West Riffa',    coordinates: [50.5300, 26.1200] },
  { username: 'salma_east_riffa', neighborhood: 'East Riffa',    coordinates: [50.5700, 26.1400] },
  { username: 'khalifa_askar',    neighborhood: 'Askar',         coordinates: [50.6200, 26.1600] },
  { username: 'muna_zallaq',      neighborhood: 'Zallaq',        coordinates: [50.4700, 26.1300] },
  { username: 'jassim_durrat',    neighborhood: 'Durrat Al Bahrain', coordinates: [50.5300, 26.0200] },
  { username: 'nadia_jaww',       neighborhood: 'Jaw',           coordinates: [50.6100, 26.1000] },
]

// ── Realistic Bahrain-style clothing pool ─────────────────────────────────────
const ITEM_POOL = [
  // Abayas
  { title: 'Black Crepe Abaya — Everyday', category: 'dresses', size: 'M', condition: 'good', ecoCreditsPrice: 10,
    description: 'Plain black polyester-crepe abaya, size M. Comfortable daily wear, no tears or stains.' },
  { title: 'Embroidered Abaya — Silver Sleeves', category: 'dresses', size: 'L', condition: 'like-new', ecoCreditsPrice: 15,
    description: 'Elegant abaya with silver embroidery along cuffs and collar. Worn once for a family gathering.' },
  { title: 'Open Abaya — Embroidered Collar', category: 'dresses', size: 'M', condition: 'good', ecoCreditsPrice: 12,
    description: 'Open-front abaya with embroidered collar and cuffs. Versatile for formal casual occasions.' },
  { title: 'Formal Abaya — Pearl Embroidery', category: 'dresses', size: 'XL', condition: 'new', ecoCreditsPrice: 25,
    description: 'Stunning black abaya with pearl and crystal embroidery. Bought for wedding, size too big.' },
  { title: 'Velvet Abaya — Occasion', category: 'dresses', size: 'M', condition: 'like-new', ecoCreditsPrice: 20,
    description: 'Dark burgundy velvet abaya with floral embroidery. Worn once to an engagement ceremony.' },
  { title: 'Linen Abaya — Modest Casual', category: 'dresses', size: 'S', condition: 'new', ecoCreditsPrice: 20,
    description: 'Linen-blend open abaya, breathable for Bahrain summers. Never worn — bought online, size too small.' },
  { title: 'Sports Abaya — Gym Friendly', category: 'dresses', size: 'M', condition: 'good', ecoCreditsPrice: 10,
    description: 'Stretchy sports abaya with hood, perfect for the gym or evening walks. Worn a few times.' },
  { title: 'Abaya with Hood — Active Wear', category: 'dresses', size: 'L', condition: 'good', ecoCreditsPrice: 10,
    description: 'Sporty abaya with attached hood, ideal for walking or light exercise. Size L.' },
  { title: 'Kids Girls Abaya — School', category: 'kids', size: 'Kids', condition: 'good', ecoCreditsPrice: 7,
    description: "Girl's school abaya, age 12 approximately. Used one full school year, still good condition." },
  // Kanduras & Thobes (men)
  { title: 'White Kandura — Everyday Cotton', category: 'tops', size: 'L', condition: 'good', ecoCreditsPrice: 10,
    description: "Men's white cotton kandura for daily wear. Comfortable fabric, slight fading from washing." },
  { title: 'Premium Kandura — Eid Wear', category: 'tops', size: 'XL', condition: 'like-new', ecoCreditsPrice: 15,
    description: 'High-quality Eid kandura with subtle textured weave. Worn once, very clean. Dry cleaned after.' },
  { title: "Men's Thobe — Grey Formal", category: 'tops', size: 'XL', condition: 'like-new', ecoCreditsPrice: 15,
    description: 'Dark grey formal thobe, custom tailored, size XL approx. Perfect for business or occasions.' },
  { title: 'Kids Thobe — Eid Set', category: 'kids', size: 'Kids', condition: 'like-new', ecoCreditsPrice: 8,
    description: "Boy's white thobe with matching ghutra for Eid, age 6-7. Worn twice, brilliant white." },
  { title: "Traditional Bisht — Men's Gold Trim", category: 'outerwear', size: 'L', condition: 'like-new', ecoCreditsPrice: 20,
    description: 'Classic black bisht with gold thread trim. Worn once at a graduation ceremony, stored properly.' },
  // Jalabiyas & Kaftans
  { title: 'Floral Jalabiya — Summer Cotton', category: 'dresses', size: 'M', condition: 'good', ecoCreditsPrice: 10,
    description: 'Comfortable cotton jalabiya with floral print, perfect for home or relaxed occasions.' },
  { title: 'Embroidered Kaftan — Gold Thread', category: 'dresses', size: 'L', condition: 'like-new', ecoCreditsPrice: 20,
    description: 'Beautiful kaftan with gold embroidery, worn to a wedding. Professionally dry cleaned after.' },
  { title: 'Kids Jalabiya — Eid Colourful', category: 'kids', size: 'Kids', condition: 'like-new', ecoCreditsPrice: 7,
    description: "Girl's colourful jalabiya with embroidery, age 5-6. Worn twice for Eid celebrations." },
  // Hijabs & Accessories
  { title: 'Hijab Bundle — 5 Neutral Tones', category: 'accessories', size: 'One Size', condition: 'good', ecoCreditsPrice: 5,
    description: '5 jersey hijabs in daily neutral tones: black, white, grey, beige, and navy. All in good condition.' },
  { title: 'Floral Silk Hijab — Printed', category: 'accessories', size: 'One Size', condition: 'new', ecoCreditsPrice: 8,
    description: 'Floral printed silk-feel hijab. Never worn, still in original packaging.' },
  { title: 'Shemagh — Red & White Traditional', category: 'accessories', size: 'One Size', condition: 'like-new', ecoCreditsPrice: 8,
    description: 'Traditional red and white shemagh/ghutra, high quality wool blend. Barely used.' },
  { title: 'Wool Pashmina — Camel Winter Wrap', category: 'accessories', size: 'One Size', condition: 'good', ecoCreditsPrice: 8,
    description: "Camel-coloured wool pashmina, warm for Bahrain's cooler winter evenings. Light wear." },
  // Western casual / Cosmopolitan Bahrain
  { title: "Slim Jeans — Dark Wash Men's", category: 'bottoms', size: 'M', condition: 'good', ecoCreditsPrice: 8,
    description: "Men's slim-fit dark wash jeans, worn regularly but in good shape. Zara size M." },
  { title: "Men's Polo Shirt Pack — 3 Pieces", category: 'tops', size: 'L', condition: 'good', ecoCreditsPrice: 10,
    description: 'Three polo shirts (white, navy, olive), all size L. Good condition, no fading.' },
  { title: "Linen Shirt — Men's Summer White", category: 'tops', size: 'M', condition: 'good', ecoCreditsPrice: 8,
    description: 'White linen shirt, perfect for Bahrain heat. Breathable fabric, size M. Minor crease marks.' },
  { title: "Men's Casual Floral Shirt", category: 'tops', size: 'M', condition: 'good', ecoCreditsPrice: 8,
    description: 'Short-sleeve floral-print casual shirt, light fabric for summer. H&M size M.' },
  { title: "Denim Jacket — Oversized Women's", category: 'outerwear', size: 'L', condition: 'good', ecoCreditsPrice: 12,
    description: 'Oversized denim jacket, great for Bahrain winter evenings. Zara size L.' },
  { title: 'Windbreaker Jacket — Navy Nike', category: 'outerwear', size: 'L', condition: 'good', ecoCreditsPrice: 12,
    description: 'Lightweight navy windbreaker, perfect for spring evenings. Nike, size L.' },
  { title: "Chiffon Top — Dusty Rose Women's", category: 'tops', size: 'S', condition: 'like-new', ecoCreditsPrice: 8,
    description: 'Dusty rose chiffon top with ruffled sleeves. Worn once, perfect for evening outings.' },
  { title: 'Maxi Dress — Navy Formal', category: 'dresses', size: 'S', condition: 'good', ecoCreditsPrice: 10,
    description: 'Navy blue modest maxi dress, side slit. H&M size S, great for formal occasions.' },
  { title: "Cargo Trousers — Khaki Men's", category: 'bottoms', size: 'L', condition: 'good', ecoCreditsPrice: 8,
    description: "Men's khaki cargo trousers with ample pockets. Zara, size L." },
  { title: 'Gym Leggings — Set of 2', category: 'bottoms', size: 'S', condition: 'good', ecoCreditsPrice: 8,
    description: 'Two pairs of high-waisted gym leggings, black and grey. Good elasticity, worn a season.' },
  { title: "Formal Trouser Set — Men's Navy", category: 'bottoms', size: 'L', condition: 'like-new', ecoCreditsPrice: 12,
    description: 'Dark navy formal trousers. Worn once for a job interview, pressed and clean.' },
  { title: "Summer Shorts Pack — Men's 3pc", category: 'bottoms', size: 'M', condition: 'good', ecoCreditsPrice: 8,
    description: 'Three cotton shorts in different colours. Great for home or beachside casual wear. Size M.' },
  // Footwear
  { title: "Women's Running Shoes — Nike 38", category: 'footwear', size: 'One Size', condition: 'good', ecoCreditsPrice: 10,
    description: 'Nike running shoes, EU 38. Used for park walking, still good grip and support.' },
  { title: "Men's Leather Sandals — EU 43", category: 'footwear', size: 'One Size', condition: 'good', ecoCreditsPrice: 10,
    description: 'Brown leather sandals, EU 43. Comfortable everyday sandals for Bahrain weather.' },
  { title: "Men's White Sneakers — EU 42", category: 'footwear', size: 'One Size', condition: 'good', ecoCreditsPrice: 10,
    description: 'White casual sneakers, EU 42. Regular wear but cleaned and still presentable.' },
  { title: "Women's Gold Flat Sandals — EU 37", category: 'footwear', size: 'One Size', condition: 'good', ecoCreditsPrice: 8,
    description: 'Gold flat sandals, EU 37. Light wear, perfect for everyday casual use.' },
  // Kids
  { title: 'Girls School Uniform — Age 10', category: 'kids', size: 'Kids', condition: 'fair', ecoCreditsPrice: 5,
    description: 'Full school uniform set: abaya, white shirt, trousers. Used one school year, some wear.' },
  { title: 'Boys School Uniform — Age 7', category: 'kids', size: 'Kids', condition: 'good', ecoCreditsPrice: 5,
    description: 'Full boys school uniform, age 7: white shirt, dark trousers. Clean and still good.' },
  { title: "Boys' Football Kit — Al Ahli", category: 'kids', size: 'Kids', condition: 'good', ecoCreditsPrice: 5,
    description: "Al Ahli club jersey and shorts, age 8-9. Worn for playing, good condition." },
]

// ── Seed function ─────────────────────────────────────────────────────────────
async function seed() {
  await mongoose.connect(process.env.MONGODB_URI)
  console.log('Connected to MongoDB')

  let usersCreated = 0
  let itemsCreated = 0
  let skipped = 0
  const createdUsers = []

  for (const ud of USERS_DATA) {
    try {
      const user = await User.create({
        username: ud.username,
        hashedPassword: HASHED_PW,
        ecoCredits: 100,
        location: {
          type: 'Point',
          coordinates: ud.coordinates,
          neighborhood: ud.neighborhood,
        },
      })
      createdUsers.push(user)
      usersCreated++
    } catch (err) {
      if (err.code === 11000) {
        console.log(`  skip — ${ud.username} already exists`)
        skipped++
      } else {
        console.error(`  error creating ${ud.username}: ${err.message}`)
      }
    }
  }

  // Assign 1–2 random items from the pool to each newly created user
  const shufflePool = () => [...ITEM_POOL].sort(() => Math.random() - 0.5)

  for (const user of createdUsers) {
    const numItems = Math.random() < 0.55 ? 1 : 2
    const selected = shufflePool().slice(0, numItems)
    for (const itemData of selected) {
      try {
        await Item.create({
          ...itemData,
          owner: user._id,
          location: user.location,
        })
        itemsCreated++
      } catch (err) {
        console.error(`  item error for ${user.username}: ${err.message}`)
      }
    }
  }

  console.log(`\nSeed complete:`)
  console.log(`  Users created : ${usersCreated}`)
  console.log(`  Users skipped : ${skipped}`)
  console.log(`  Items created : ${itemsCreated}`)
  console.log(`\nAll seed users have password: Rewear2025`)
  await mongoose.disconnect()
}

seed().catch(err => { console.error(err); process.exit(1) })
