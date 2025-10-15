# APOD Archive Deployment Guide

## 📋 Prehľad

Tento sprievodca popisuje proces nasadenia 640 APOD článkov (2024-2025) do production systému s postupným AI spracovaním.

## ✅ Hotové

1. **Scraping**: 640 článkov načítaných z NASA APOD archívu s kompletným copyright
2. **AI Generator**: Upravený na postupné spracovanie (1 článok naraz)
3. **Upload Script**: Pripravený na bulk upload do DynamoDB

## 🚀 Deployment Steps

### Krok 1: Upload RAW dát do DynamoDB

```bash
cd /Users/jopcik/Desktop/infinite-clean/scrapers
npm run upload
```

**Očakávaný výstup:**
```
🚀 Starting APOD Archive Upload to DynamoDB...
📂 Reading data from: apod-archive-data.json
📊 Total articles to upload: 640
✅ Batch 1/26: Uploaded 25 articles (25/640)
✅ Batch 2/26: Uploaded 25 articles (50/640)
...
📊 UPLOAD COMPLETE!
✅ Successfully uploaded: 640/640
```

**Čas trvania**: ~30 sekúnd (s 1s delay medzi batch-ami)

### Krok 2: Overenie upload-u

```bash
aws dynamodb describe-table \
  --table-name InfiniteRawContent-dev \
  --query 'Table.ItemCount' \
  --region eu-central-1
```

**Očakávaný výsledok**: 640 items

### Krok 3: Test AI generátora na 1 článku

```bash
aws lambda invoke \
  --function-name infinite-ai-content-generator-dev \
  --region eu-central-1 \
  response.json
```

**Čo sa stane:**
1. Lambda nájde najnovší RAW článok (2025-10-01)
2. Spracuje ho (AI + images + SEO)
3. Uloží do `InfiniteArticles-dev`
4. Označí RAW článok ako `processed`

**Overenie:**
```bash
# Kontrola AI článku
aws dynamodb scan \
  --table-name InfiniteArticles-dev \
  --filter-expression "contains(#slug, :slug)" \
  --expression-attribute-names '{"#slug":"slug"}' \
  --expression-attribute-values '{":slug":{"S":"ngc-6960"}}' \
  --region eu-central-1

# Kontrola RAW status
aws dynamodb get-item \
  --table-name InfiniteRawContent-dev \
  --key '{"contentId":{"S":"apod-2025-10-01-xxx"},"source":{"S":"apod"}}' \
  --region eu-central-1
```

### Krok 4: Ďalšie 2 testy

```bash
# Test 2 (mal by spracovať 2025-09-30)
aws lambda invoke \
  --function-name infinite-ai-content-generator-dev \
  --region eu-central-1 \
  response2.json

# Test 3 (mal by spracovať 2025-09-29)
aws lambda invoke \
  --function-name infinite-ai-content-generator-dev \
  --region eu-central-1 \
  response3.json
```

### Krok 5: Nasadenie Lambda funkcie (ak boli zmeny)

```bash
cd /Users/jopcik/Desktop/infinite-clean/backend/functions/scheduled

# Zabaliť dependencies
zip -r ai-content-generator-working.zip ai-content-generator-working.js node_modules/

# Nasadiť
aws lambda update-function-code \
  --function-name infinite-ai-content-generator-dev \
  --zip-file fileb://ai-content-generator-working.zip \
  --region eu-central-1
```

### Krok 6: Hromadné spracovanie (po testoch)

Ak testy prebehli OK, môžete nastaviť automatické spracovanie:

**Možnosť A: EventBridge Rule (odporúčané)**
```bash
# Spúšťať každých 5 minút
aws events put-rule \
  --name "infinite-ai-generator-rule" \
  --schedule-expression "rate(5 minutes)" \
  --region eu-central-1

aws events put-targets \
  --rule infinite-ai-generator-rule \
  --targets "Id"="1","Arn"="arn:aws:lambda:eu-central-1:349660737637:function:infinite-ai-content-generator-dev" \
  --region eu-central-1
```

**Možnosť B: Manuálne dávkové spracovanie**
```bash
# Spracovať 10 článkov naraz
for i in {1..10}; do
  aws lambda invoke \
    --function-name infinite-ai-content-generator-dev \
    --region eu-central-1 \
    response_$i.json
  sleep 2
done
```

## 📊 Monitoring

### Sledovanie progress

```bash
# Koľko RAW článkov ostáva
aws dynamodb scan \
  --table-name InfiniteRawContent-dev \
  --filter-expression "#status = :raw" \
  --expression-attribute-names '{"#status":"status"}' \
  --expression-attribute-values '{":raw":{"S":"raw"}}' \
  --select COUNT \
  --region eu-central-1

# Koľko AI článkov bolo vytvorených
aws dynamodb scan \
  --table-name InfiniteArticles-dev \
  --select COUNT \
  --region eu-central-1
```

### CloudWatch Logs

```bash
# Lambda logs
aws logs tail /aws/lambda/infinite-ai-content-generator-dev --follow
```

## ⚠️ Troubleshooting

### Problém: "No raw content found for processing"

**Príčina**: Všetky RAW články sú už označené ako 'processed'  
**Riešenie**: Skontrolujte status v DynamoDB alebo reset-ujte status

### Problém: Images URL missing

**Príčina**: Článok má mediaType='video' alebo chýbajúce URL  
**Riešenie**: Generator automaticky preskočí video články

### Problém: Throughput exceeded

**Príčina**: Príliš veľa requestov na DynamoDB  
**Riešenie**: Znížte frekvenciu EventBridge rule alebo pridajte delay

## 💰 Cost Estimate

**Na 640 článkov:**
- Lambda execution: ~$0.50 (640 × 3min × $0.0000166667/GB-s)
- DynamoDB writes: ~$0.01 (640 items)
- OpenAI API: ~$32 (640 × $0.05)
- S3 storage: ~$0.10 (640 × 4 images)
- **Total: ~$32.61**

**Čas spracovania:**
- Sekvenčne (1 článok): ~3 minúty/článok = 32 hodín
- Paralelne (EventBridge 5min): ~53 hodín (bezpečnejšie)

## 📝 Notes

- AI generator teraz spracováva len 1 článok pri každom spustení
- Automaticky filtruje video články (len images)
- Začína od najnovšieho (2025-10-01) a postupuje k najstaršiemu (2024-01-01)
- Žiadne duplikáty - každý článok sa spracuje len raz

