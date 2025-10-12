# Google Bot Robots.txt Fix

## Problém
Google bot bol blokovaný robots.txt súborom, čo bránilo indexovaniu stránok.

## Riešenie

### 1. Aktualizovaný robots.ts
- Pridané explicitné pravidlá pre všetky hlavné search boty
- Googlebot, Bingbot, Slurp, DuckDuckBot, Baiduspider, YandexBot
- Všetky boty majú povolený prístup k hlavným stránkam
- Blokované sú len API, admin a technické sekcie

### 2. Nový robots.txt obsah
```
User-Agent: Googlebot
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /_next/
Disallow: /private/

User-Agent: Bingbot
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /_next/
Disallow: /private/

[... ďalšie boty ...]

User-Agent: *
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /_next/
Disallow: /private/

Sitemap: https://infinite.sk/sitemap.xml
```

### 3. Ďalšie kroky pre Google Search Console

1. **Prejdite do Google Search Console**
   - https://search.google.com/search-console

2. **Pridajte sitemap**
   - Navigate to "Sitemaps" section
   - Add sitemap URL: `https://infinite.sk/sitemap.xml`
   - Submit for indexing

3. **Požiadajte o re-indexovanie**
   - Use "URL Inspection" tool
   - Test live URL
   - Request indexing for important pages

4. **Skontrolujte robots.txt**
   - Use "robots.txt Tester" tool
   - Verify that Googlebot can access your pages

### 4. Monitoring

- Sledujte Google Search Console pre chyby
- Monitorujte indexovanie stránok
- Skontrolujte, či sa nové články indexujú

### 5. Cache clearing

Ak Google bot stále má starú verziu robots.txt:
- Počkajte 24-48 hodín na cache refresh
- Alebo použite Google Search Console "robots.txt Tester"
- Alebo požiadajte o re-indexovanie cez URL Inspection

## Súbory zmenené

- `infinite-v2/app/robots.ts` - Aktualizované pravidlá pre boty
- `infinite-v2/app/api/submit-sitemap/route.ts` - Nový endpoint pre sitemap submission

## Testovanie

```bash
# Test robots.txt
curl -s https://infinite.sk/robots.txt

# Test sitemap
curl -s https://infinite.sk/sitemap.xml | head -20
```

## Výsledok

✅ Google bot má teraz explicitné povolenie prístupu
✅ Všetky hlavné search boty sú podporované
✅ Sitemap je správne referencovaná
✅ API a admin sekcie zostávajú chránené
