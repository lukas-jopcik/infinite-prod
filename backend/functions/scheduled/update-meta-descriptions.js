const { DynamoDBClient, ScanCommand, UpdateItemCommand } = require('@aws-sdk/client-dynamodb');

const dynamodb = new DynamoDBClient({ region: 'eu-central-1' });
const TABLE_NAME = 'InfiniteArticles-dev';

/**
 * Generate a proper meta description from content
 */
function generateMetaDescription(content, maxLength = 160) {
  if (!content || content.trim().length === 0) {
    return null;
  }
  
  // Clean the content - remove HTML tags and extra whitespace
  const cleanContent = content
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&[^;]+;/g, ' ') // Replace HTML entities
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .trim();
  
  // If content is shorter than max length, use it as is
  if (cleanContent.length <= maxLength) {
    return cleanContent;
  }
  
  // Find the last complete sentence within the limit
  const truncated = cleanContent.substring(0, maxLength);
  const lastSentenceEnd = Math.max(
    truncated.lastIndexOf('.'),
    truncated.lastIndexOf('!'),
    truncated.lastIndexOf('?')
  );
  
  if (lastSentenceEnd > maxLength * 0.7) { // If we found a sentence end in the last 30%
    return truncated.substring(0, lastSentenceEnd + 1);
  }
  
  // Otherwise, truncate at word boundary
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLength * 0.8) { // If we found a space in the last 20%
    return truncated.substring(0, lastSpace) + '...';
  }
  
  // Final fallback - just truncate and add ellipsis
  return truncated.substring(0, maxLength - 3) + '...';
}

/**
 * Get the best available meta description for an article
 */
function getArticleMetaDescription(article, category = 'objav-dna') {
  // First try the dedicated meta description
  if (article.metaDescription && article.metaDescription.trim().length > 0) {
    return article.metaDescription;
  }
  
  // Then try the perex
  if (article.perex && article.perex.trim().length > 0) {
    return generateMetaDescription(article.perex);
  }
  
  // Then try the first section content
  if (article.content && article.content.length > 0) {
    const firstSection = article.content[0];
    if (firstSection && firstSection.content) {
      return generateMetaDescription(firstSection.content);
    }
  }
  
  // Final fallback based on category
  switch (category) {
    case 'tyzdenny-vyber':
      return "Týždenný výber z vesmíru na Infinite - najzaujímavejšie objavy a udalosti z astronómie.";
    case 'komunita':
      return "Komunitný článok o vesmíre na Infinite - diskusie a názory astronomických nadšencov.";
    default:
      return "Objav dňa z vesmíru na Infinite - denné objavy, vizuálne snímky a vzdelávacie články o vesmíre a astronómii.";
  }
}

/**
 * Check if an article needs a meta description update
 */
function needsMetaDescriptionUpdate(article) {
  const currentMetaDescription = article.metaDescription;
  
  // If no meta description at all, it needs an update
  if (!currentMetaDescription || currentMetaDescription.trim().length === 0) {
    return true;
  }
  
  // If meta description is too short (less than 50 characters), it needs an update
  if (currentMetaDescription.trim().length < 50) {
    return true;
  }
  
  // If meta description is too long (more than 160 characters), it needs an update
  if (currentMetaDescription.trim().length > 160) {
    return true;
  }
  
  // If meta description is just the title or very generic, it needs an update
  const genericDescriptions = [
    "Objav dňa z vesmíru na Infinite",
    "Astronomický článok",
    "Článok o vesmíre",
    "Vesmírny objav"
  ];
  
  if (genericDescriptions.some(generic => currentMetaDescription.includes(generic))) {
    return true;
  }
  
  return false;
}

/**
 * Update article with improved meta description
 */
async function updateArticleMetaDescription(articleId, type, newMetaDescription) {
  try {
    const updateParams = {
      TableName: TABLE_NAME,
      Key: {
        articleId: { S: articleId },
        type: { S: type }
      },
      UpdateExpression: 'SET metaDescription = :metaDescription, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':metaDescription': { S: newMetaDescription },
        ':updatedAt': { S: new Date().toISOString() }
      },
      ReturnValues: 'UPDATED_NEW'
    };

    const result = await dynamodb.send(new UpdateItemCommand(updateParams));
    console.log(`✅ Updated article ${articleId} with new meta description (${newMetaDescription.length} chars)`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to update article ${articleId}:`, error.message);
    return false;
  }
}

/**
 * Convert DynamoDB item to regular object
 */
function convertDynamoItem(item) {
  const converted = {};
  for (const [key, value] of Object.entries(item)) {
    if (value.S) converted[key] = value.S;
    else if (value.N) converted[key] = value.N;
    else if (value.BOOL !== undefined) converted[key] = value.BOOL;
    else if (value.SS) converted[key] = value.SS;
    else if (value.NS) converted[key] = value.NS;
    else if (value.L) converted[key] = value.L.map(v => v.S || v.N || v.BOOL);
    else if (value.M) {
      converted[key] = {};
      for (const [subKey, subValue] of Object.entries(value.M)) {
        if (subValue.S) converted[key][subKey] = subValue.S;
        else if (subValue.N) converted[key][subKey] = subValue.N;
        else if (subValue.BOOL !== undefined) converted[key][subKey] = subValue.BOOL;
        else if (subValue.L) converted[key][subKey] = subValue.L.map(v => v.S || v.N || v.BOOL);
        else if (subValue.M) {
          converted[key][subKey] = {};
          for (const [subSubKey, subSubValue] of Object.entries(subValue.M)) {
            if (subSubValue.S) converted[key][subKey][subSubKey] = subSubValue.S;
            else if (subSubValue.N) converted[key][subKey][subSubKey] = subSubValue.N;
            else if (subSubValue.BOOL !== undefined) converted[key][subKey][subSubKey] = subSubValue.BOOL;
          }
        }
      }
    }
  }
  return converted;
}

/**
 * Migrate all articles to improve meta descriptions
 */
async function migrateAllArticles() {
  console.log('🚀 Starting meta descriptions migration...');
  
  let totalScanned = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalNeedsUpdate = 0;
  let lastEvaluatedKey = null;

  try {
    do {
      // Scan articles in batches
      const scanParams = {
        TableName: TABLE_NAME,
        ProjectionExpression: 'articleId, #type, metaDescription, perex, content, category, title',
        ExpressionAttributeNames: {
          '#type': 'type'
        },
        Limit: 25 // Process in smaller batches
      };

      if (lastEvaluatedKey) {
        scanParams.ExclusiveStartKey = lastEvaluatedKey;
      }

      const scanResult = await dynamodb.send(new ScanCommand(scanParams));
      const articles = scanResult.Items || [];
      
      console.log(`📄 Processing batch of ${articles.length} articles...`);
      totalScanned += articles.length;

      // Process each article in the batch
      for (const article of articles) {
        const articleId = article.articleId?.S;
        const type = article.type?.S;

        if (!articleId || !type) {
          console.log('⚠️ Article missing articleId or type, skipping');
          totalSkipped++;
          continue;
        }

        // Convert DynamoDB item to regular object
        const articleData = convertDynamoItem(article);
        
        // Check if this article needs a meta description update
        if (!needsMetaDescriptionUpdate(articleData)) {
          console.log(`⏭️ Article ${articleId} already has good meta description, skipping`);
          totalSkipped++;
          continue;
        }

        totalNeedsUpdate++;
        
        // Generate new meta description
        const newMetaDescription = getArticleMetaDescription(articleData, articleData.category);
        
        if (!newMetaDescription) {
          console.log(`⚠️ Could not generate meta description for article ${articleId}, skipping`);
          totalSkipped++;
          continue;
        }

        console.log(`📝 Article: ${articleData.title}`);
        console.log(`   Old meta: ${articleData.metaDescription || 'NONE'}`);
        console.log(`   New meta: ${newMetaDescription}`);

        const updated = await updateArticleMetaDescription(articleId, type, newMetaDescription);
        
        if (updated) {
          totalUpdated++;
        } else {
          totalSkipped++;
        }

        // Small delay to avoid throttling
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      lastEvaluatedKey = scanResult.LastEvaluatedKey;
      
      if (lastEvaluatedKey) {
        console.log(`📊 Progress: ${totalScanned} scanned, ${totalNeedsUpdate} need updates, ${totalUpdated} updated, ${totalSkipped} skipped`);
      }

    } while (lastEvaluatedKey);

    console.log('🎉 Migration completed!');
    console.log(`📊 Final results:`);
    console.log(`   - Total articles scanned: ${totalScanned}`);
    console.log(`   - Articles needing updates: ${totalNeedsUpdate}`);
    console.log(`   - Total articles updated: ${totalUpdated}`);
    console.log(`   - Total articles skipped: ${totalSkipped}`);

    return {
      success: true,
      totalScanned,
      totalNeedsUpdate,
      totalUpdated,
      totalSkipped
    };

  } catch (error) {
    console.error('❌ Migration failed:', error);
    return {
      success: false,
      error: error.message,
      totalScanned,
      totalNeedsUpdate,
      totalUpdated,
      totalSkipped
    };
  }
}

/**
 * Lambda handler
 */
exports.handler = async (event) => {
  console.log('Meta descriptions migration Lambda started');
  console.log('Event:', JSON.stringify(event, null, 2));

  const result = await migrateAllArticles();
  
  return {
    statusCode: result.success ? 200 : 500,
    body: JSON.stringify(result)
  };
};

// For local testing
if (require.main === module) {
  migrateAllArticles()
    .then(result => {
      console.log('Local test completed:', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Local test failed:', error);
      process.exit(1);
    });
}
