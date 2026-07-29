/* =========================================================
   product-lookup.js — pencarian produk berlapis (fallback chain)
   Urutan:
   1. Cache lokal (jika masih segar) -> langsung pakai, refresh di background jika stale
   2. Database lokal TabungKu (produk yang pernah discan/diisi manual)
   3. Open Food Facts (gratis, tanpa API key, khusus makanan/minuman tapi datanya luas)
   4. Barcode Lookup API (butuh API key, diisi user di Pengaturan)
   5. Jika semua gagal -> null (UI akan minta input manual)
   ========================================================= */

const ProductLookup = (() => {

  const OFF_URL = (code) => `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`;
  const BARCODE_LOOKUP_URL = (code, key) => `https://api.barcodelookup.com/v3/products?barcode=${encodeURIComponent(code)}&key=${encodeURIComponent(key)}`;

  function getBarcodeLookupKey(){
    const settings = Storage.getSettings();
    return (settings && settings.barcodeLookupApiKey) ? settings.barcodeLookupApiKey.trim() : '';
  }

  /* Bentuk data produk yang seragam dipakai di seluruh app,
     apa pun sumbernya (OFF, Barcode Lookup, DB lokal, manual). */
  function emptyProduct(barcode){
    return {
      barcode,
      name: '',
      brand: '',
      category: '',
      country: '',
      weight: '',
      netContent: '',
      photo: '',
      ingredients: '',
      nutrition: null,
      nutriScore: '',
      ecoScore: '',
      allergens: '',
      halal: false,
      certifications: [],
      source: ''
    };
  }

  function fromOpenFoodFacts(json, barcode){
    if (!json || json.status !== 1 || !json.product) return null;
    const p = json.product;
    const out = emptyProduct(barcode);
    out.name = p.product_name || p.product_name_id || p.generic_name || '';
    out.brand = p.brands || '';
    out.category = (p.categories_tags && p.categories_tags[0])
      ? p.categories_tags[0].replace(/^[a-z]{2}:/, '').replace(/-/g, ' ')
      : (p.categories || '').split(',')[0] || '';
    out.country = (p.countries || '').split(',')[0] || '';
    out.weight = p.quantity || '';
    out.netContent = p.quantity || '';
    out.photo = p.image_front_url || p.image_url || '';
    out.ingredients = p.ingredients_text_id || p.ingredients_text || '';
    out.nutrition = p.nutriments ? {
      energy: p.nutriments['energy-kcal_100g'] ?? p.nutriments['energy-kcal'] ?? null,
      protein: p.nutriments['proteins_100g'] ?? null,
      fat: p.nutriments['fat_100g'] ?? null,
      carbs: p.nutriments['carbohydrates_100g'] ?? null,
      sugar: p.nutriments['sugars_100g'] ?? null,
      salt: p.nutriments['salt_100g'] ?? null
    } : null;
    out.nutriScore = (p.nutriscore_grade || p.nutrition_grades || '').toUpperCase();
    out.ecoScore = (p.ecoscore_grade || '').toUpperCase();
    out.allergens = (p.allergens_tags || []).map(a => a.replace(/^[a-z]{2}:/, '')).join(', ') || (p.allergens || '');
    out.halal = /halal/i.test(p.labels || '') || (p.labels_tags || []).some(l => /halal/i.test(l));
    out.certifications = (p.labels_tags || []).map(l => l.replace(/^[a-z]{2}:/, ''));
    out.source = 'Open Food Facts';
    return out.name ? out : null;
  }

  function fromBarcodeLookup(json, barcode){
    if (!json || !json.products || !json.products.length) return null;
    const p = json.products[0];
    const out = emptyProduct(barcode);
    out.name = p.title || p.product_name || '';
    out.brand = p.brand || p.manufacturer || '';
    out.category = (p.category || '').split(',')[0] || '';
    out.country = p.country || '';
    out.weight = p.weight || '';
    out.netContent = p.size || p.weight || '';
    out.photo = (p.images && p.images[0]) || '';
    out.ingredients = p.ingredients || '';
    out.source = 'Barcode Lookup API';
    return out.name ? out : null;
  }

  function fromLocalDb(barcode){
    const p = ProductDB.getLocalProduct(barcode);
    if (!p) return null;
    return { ...emptyProduct(barcode), ...p, source: p.source || 'Database Lokal TabungKu' };
  }

  async function tryOpenFoodFacts(barcode){
    try{
      const res = await fetch(OFF_URL(barcode));
      if (!res.ok) return null;
      const json = await res.json();
      return fromOpenFoodFacts(json, barcode);
    }catch(e){
      console.warn('Open Food Facts gagal:', e.message);
      return null;
    }
  }

  async function tryBarcodeLookup(barcode){
    const key = getBarcodeLookupKey();
    if (!key) return null; // fitur ini opsional; kalau user belum isi key, lewati diam-diam
    try{
      const res = await fetch(BARCODE_LOOKUP_URL(barcode, key));
      if (!res.ok) return null;
      const json = await res.json();
      return fromBarcodeLookup(json, barcode);
    }catch(e){
      console.warn('Barcode Lookup API gagal:', e.message);
      return null;
    }
  }

  /* Fungsi utama: jalankan rantai fallback sampai salah satu berhasil.
     onSourceTried(sourceName) dipanggil di setiap langkah agar UI bisa
     menampilkan progress "Mencari di ..." secara realtime. */
  async function lookup(barcode, { onSourceTried, skipCache } = {}){
    barcode = String(barcode).trim();
    if (!barcode) return { product: null, fromCache: false };

    // 1. Cache
    if (!skipCache){
      const cached = ProductDB.getCached(barcode);
      if (cached && !cached.isStale){
        onSourceTried && onSourceTried('Cache Lokal');
        return { product: cached.data, fromCache: true, source: cached.source };
      }
    }

    // 2. Database lokal TabungKu
    onSourceTried && onSourceTried('Database Lokal TabungKu');
    const local = fromLocalDb(barcode);
    if (local){
      ProductDB.setCached(barcode, local, local.source);
      return { product: local, fromCache: false, source: local.source };
    }

    // Kalau offline, jangan coba fetch — langsung gagal ke input manual
    if (!navigator.onLine){
      return { product: null, fromCache: false, offline: true };
    }

    // 3. Open Food Facts
    onSourceTried && onSourceTried('Open Food Facts');
    const off = await tryOpenFoodFacts(barcode);
    if (off){
      ProductDB.setCached(barcode, off, off.source);
      return { product: off, fromCache: false, source: off.source };
    }

    // 4. Barcode Lookup API
    onSourceTried && onSourceTried('Barcode Lookup API');
    const bl = await tryBarcodeLookup(barcode);
    if (bl){
      ProductDB.setCached(barcode, bl, bl.source);
      return { product: bl, fromCache: false, source: bl.source };
    }

    // 5. Semua gagal
    return { product: null, fromCache: false };
  }

  /* Refresh cache di background (dipanggil setelah menampilkan data cache lama,
     supaya user tidak menunggu tapi data tetap ter-update untuk kunjungan berikutnya). */
  async function refreshInBackground(barcode){
    if (!navigator.onLine) return;
    const off = await tryOpenFoodFacts(barcode);
    if (off){ ProductDB.setCached(barcode, off, off.source); return; }
    const bl = await tryBarcodeLookup(barcode);
    if (bl){ ProductDB.setCached(barcode, bl, bl.source); }
  }

  return { lookup, refreshInBackground, emptyProduct, getBarcodeLookupKey };
})();
