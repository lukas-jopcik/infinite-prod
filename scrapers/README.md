# APOD Archive Scraper

Kompletný scraper pre NASA APOD archív, ktorý extrahuje články a pripravuje ich pre AI content generator.

## Prehľad

Tento scraper:
- Načíta APOD archive stránku z https://apod.nasa.gov/apod/archivepixFull.html
- Extrahuje články pre roky 2024-2025
- Pre každý článok získa všetky dostupné údaje (title, explanation, image URL, HD URL, atď.)
- Uloží dáta do JSON súboru v správnom formáte pre AI content generator
- Podporuje resumable scraping (pokračovanie po prerušení)

## Inštalácia

```bash
npm install
```

## Použitie

### Test mode (10 článkov)

```bash
npm run test
```

### Kompletný scraping (všetky články 2024-2025)

```bash
npm run scrape
```

## Konfigurácia

Všetky nastavenia sú v `config.js`:

- `RATE_LIMIT_MS`: 500ms medzi requestmi (šetrné k serveru)
- `RETRY_ATTEMPTS`: 3 pokusy pri chybe
- `START_YEAR` / `END_YEAR`: Rozsah dátumov
- `PROGRESS_SAVE_INTERVAL`: Ukladanie progress každých 10 článkov

## Výstupné súbory

- **apod-archive-data.json** - Hlavný výstup so všetkými článkami
- **progress.json** - Progress tracking pre resumable scraping
- **scraper.log** - Detailný log všetkých operácií

## Formát výstupných dát

Každý článok obsahuje:

```json
{
  "contentId": "apod-2025-10-01-{uuid}",
  "source": "apod",
  "title": "NGC 6960: The Witchs Broom Nebula",
  "explanation": "Popis článku...",
  "date": "2025-10-01",
  "url": "https://apod.nasa.gov/apod/image/...",
  "hdurl": "https://apod.nasa.gov/apod/image/... (voliteľné)",
  "copyright": "Copyright info (voliteľné)",
  "mediaType": "image" alebo "video",
  "category": "objav-dna",
  "status": "raw",
  "fetchedAt": "2025-10-12T21:23:30.000Z",
  "environment": "dev"
}
```

## Výsledky scraping-u (2024-2025)

- ✅ **640 článkov** úspešne načítaných
- ✅ **523 obrázkov** (použiteľných pre AI generator)
- ⚠️ **117 videí** (nebudú použité)
- ✅ **100% úspešnosť** (0 chýb)
- ⏱️ **Trvanie**: ~7 minút
- 💾 **Veľkosť súboru**: 811 KB

## Kompatibilita

Výstupný formát je plne kompatibilný s:
- `backend/functions/scheduled/ai-content-generator-working.js`
- DynamoDB tabuľka `InfiniteRawContent-dev`

## Features

- ✅ Rate limiting (500ms medzi requestmi)
- ✅ Retry mechanizmus s exponential backoff
- ✅ Resumable scraping (pokračovanie po prerušení)
- ✅ Progress tracking
- ✅ Detailné logovanie
- ✅ Validácia extrahovaných dát
- ✅ Správne parsovanie HTML štruktúry APOD stránok

## Technické detaily

- **Node.js** runtime
- **axios** pre HTTP requesty
- **uuid@8.3.2** pre generovanie content ID (kompatibilná s Lambda)
- Regex parsing pre extrahovanie údajov z HTML
- Podpora rôznych formátov obrázkov (JPG, JPEG, PNG, GIF, WEBP)

## Autor

Infinite.sk

