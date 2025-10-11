<!-- 40f5c237-cfe5-4f5b-a2e8-f0f813f0571a a25b1a8e-9aa7-4c64-9587-9aaed22c2488 -->
# Community AI Content Improvements

## 1. Update AI Prompt for Dynamic Structure
**File:** `backend/functions/scheduled/ai-content-generator.js`

Modify `createCommunityPrompt()` function to:
- Remove all emoji requirements from section titles and content
- Change from 4 fixed sections to dynamic structure based on content
- Add rules for creating engaging, catchy section titles
- Keep conversational tone but more professional
- Emphasize creating compelling questions naturally embedded in text

**Key changes:**
```javascript
function createCommunityPrompt(rawItem) {
    return `Si expertný slovenský astronomický novinár a komunita moderátor. Vytvor zaujímavý článok pre sekciu "Komunita".

**VSTUPNÉ ÚDAJE:**
- Názov: ${rawItem.title}
...

**Štýl a jazyk (KOMUNITA):**
- TÓN: Konverzačný, priateľský, ale profesionálny
- ŠTYL: Menej formálny, viac príbehový
- NEPOUŽÍVAJ EMOJI v nadpisoch ani v texte
- Pridaj citáty z pôvodných komentárov
- Vytváraj otázky prirodzene vložené do textu

**Požiadavky na článok:**
1. **Meta title** (max 60 znakov): Zaujímavý, SEO-optimalizovaný názov
2. **Meta description** (max 160 znakov): Krátky popis článku
3. **H1 názov**: Hlavný názov článku (bez emoji)
4. **Perex** (MINIMÁLNE 150 znakov): Úvodný text
5. **Dynamické sekcie** (3-5 sekcií, každá MINIMÁLNE 300 znakov):
   - Názvy sekcií vytvor na základe obsahu
   - Musí byť chytľavé a zaujímavé
   - Prirodzene vlož otázky do textu namiesto FAQ
   - Príklady dobrých názvov: "Ako to celé začalo", "Čo na to hovorí komunita", "Prekvapivé zistenia"
   
6. **FAQ sekcia** (3-5 otázok):
   - Vytvor prirodzené otázky založené na obsahu
   - Otázky musia byť relevantné k téme
   - Odpovede stručné ale informatívne

**Formát výstupu (JSON):**
{
  "metaTitle": "...",
  "metaDescription": "...",
  "h1Title": "...",
  "perex": "...",
  "sections": [
    {"title": "Dynamický názov sekcie", "content": "..."},
    ...
  ],
  "faq": [
    {"question": "...", "answer": "..."},
    ...
  ],
  "keywords": [...],
  "estimatedReadingTime": "X minút"
}`
}
```

## 2. Add Image Fetching from Pexels/Unsplash
**File:** `backend/functions/scheduled/ai-content-generator.js`

Create new function `fetchCommunityImage()`:
- Use axios to call Pexels API and/or Unsplash API
- Search using combination of title + AI-generated keywords
- Download image and upload to S3
- Add image URL to article record

**New dependencies to add:**
- `axios` (already installed)

**New function structure:**
```javascript
async function fetchCommunityImage(title, keywords) {
  // 1. Get API keys from environment/secrets
  // 2. Search Pexels first (simpler API)
  // 3. If no results, try Unsplash
  // 4. Download image
  // 5. Upload to S3 bucket
  // 6. Return image URL
}
```

Integration point: Call after `generateSlovakArticle()` and before `storeArticle()`

## 3. API Keys Setup Documentation
**File:** Create `backend/functions/scheduled/IMAGE_API_SETUP.md`

Document how to:
1. Create Pexels API account at https://www.pexels.com/api/
2. Create Unsplash API account at https://unsplash.com/developers
3. Get API keys from both services
4. Add to AWS Secrets Manager as `infinite-image-api-keys-dev`
5. Update Lambda environment variables

**Secret structure:**
```json
{
  "PEXELS_API_KEY": "your-key-here",
  "UNSPLASH_ACCESS_KEY": "your-key-here"
}
```

## 4. Update Validation Rules
**File:** `backend/functions/scheduled/ai-content-generator.js`

Modify `validateGeneratedContent()` for community articles:
- Change from 4 fixed sections to 3-5 dynamic sections
- Require FAQ with 3-5 questions (not optional)
- Minimum content length stays 1200 characters
- Each section still minimum 300 characters

## 5. Test Changes
- Reset existing community articles status to 'raw' in DynamoDB
- Run ai-content-generator Lambda
- Verify no emojis in output
- Verify dynamic section titles
- Verify FAQ is present
- Verify images are fetched and stored

### To-dos

- [ ] Remove /infinite/ directory (old NASA APOD project)
- [ ] Delete .zip files, AWSCLIV2.pkg, and test files from root
- [ ] Remove agents/, expansion-packs/, teams/ directories
- [ ] Delete root package.json and package-lock.json
- [ ] Confirm amplify.yml configuration is correct
- [ ] Document and verify environment variables in Amplify Console
- [ ] Create /infinite-v2/DEPLOYMENT.md with instructions
- [ ] Test local build and verify no localhost references
- [ ] Commit all changes and push to trigger Amplify build
- [ ] Update NEXT_PUBLIC_SITE_URL after first deployment