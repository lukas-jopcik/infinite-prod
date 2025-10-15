/**
 * End-to-end tests for content display
 * Tests the complete content display workflow from API to frontend
 */

const request = require('supertest');
const { AWSMockHelper, TestDataGenerator, AssertionHelper } = require('../helpers/test-utils');

// Mock AWS SDK
jest.mock('aws-sdk', () => ({
  DynamoDB: {
    DocumentClient: jest.fn(() => ({
      put: jest.fn(),
      get: jest.fn(),
      query: jest.fn(),
      scan: jest.fn()
    }))
  }
}));

// Create a simple Express app for testing
const express = require('express');
const articlesAPI = require('../../backend/functions/api/articles-api');

const app = express();
app.use(express.json());
app.use('/api', articlesAPI);

describe('Content Display E2E', () => {
  beforeEach(() => {
    AWSMockHelper.mockAll();
    
    // Set environment variables
    process.env.REGION = 'eu-central-1';
    process.env.ENVIRONMENT = 'test';
    process.env.DYNAMODB_ARTICLES_TABLE = 'InfiniteArticles-test';
  });

  afterEach(() => {
    AWSMockHelper.restore();
    jest.clearAllMocks();
  });

  describe('Homepage Content Display', () => {
    test('should display latest articles on homepage', async () => {
      const mockArticles = [
        TestDataGenerator.generateArticle({
          id: '1',
          title: 'Najnovší článok o astronómii',
          slug: 'najnovsi-clanok-o-astronomii',
          perex: 'Toto je najnovší článok o fascinujúcich objavoch v astronómii.',
          category: 'objav-dna',
          publishedAt: '2025-01-15T06:00:00.000Z',
          originalDate: '2025-01-15',
          author: 'AI Assistant',
          readingTime: '5 min',
          imageUrl: 'https://d2ydyf9w4v170.cloudfront.net/images/2025-01-15.jpg',
          metaTitle: 'Najnovší článok o astronómii',
          metaDescription: 'Fascinujúce objavy v astronómii',
          type: 'discovery',
          tags: ['astronómia', 'vesmír', 'objavy']
        }),
        TestDataGenerator.generateArticle({
          id: '2',
          title: 'Týždenný výber z Hubble teleskopu',
          slug: 'tyzdenny-vyber-z-hubble-teleskopu',
          perex: 'Tento týždeň vám prinášame najkrajšie snímky z Hubble teleskopu.',
          category: 'tyzdenny-vyber',
          publishedAt: '2025-01-14T06:00:00.000Z',
          originalDate: '2025-01-14',
          author: 'AI Assistant',
          readingTime: '3 min',
          imageUrl: 'https://d2ydyf9w4v170.cloudfront.net/images/2025-01-14.jpg',
          metaTitle: 'Týždenný výber z Hubble teleskopu',
          metaDescription: 'Najkrajšie snímky z Hubble teleskopu',
          type: 'weekly-pick',
          tags: ['hubble', 'galaxia', 'vesmír']
        })
      ];

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockQuery = jest.fn().mockResolvedValue({ Items: mockArticles });
      DynamoDBDocumentClient.from.mockReturnValue({
        query: mockQuery
      });

      const response = await request(app)
        .get('/api/articles/latest')
        .query({ limit: '10' })
        .expect(200);

      expect(response.body).toHaveProperty('articles');
      expect(response.body.articles).toHaveLength(2);
      
      // Verify first article (most recent)
      const firstArticle = response.body.articles[0];
      expect(firstArticle.title).toBe('Najnovší článok o astronómii');
      expect(firstArticle.slug).toBe('najnovsi-clanok-o-astronomii');
      expect(firstArticle.category).toBe('objav-dna');
      expect(firstArticle.readingTime).toBe('5 min');
      expect(firstArticle.imageUrl).toContain('cloudfront.net');
      expect(firstArticle.tags).toContain('astronómia');
      expect(firstArticle.tags).toContain('vesmír');

      // Verify second article
      const secondArticle = response.body.articles[1];
      expect(secondArticle.title).toBe('Týždenný výber z Hubble teleskopu');
      expect(secondArticle.category).toBe('tyzdenny-vyber');
      expect(secondArticle.type).toBe('weekly-pick');

      console.log('✅ Homepage content display verified');
      console.log(`📰 Displayed ${response.body.articles.length} articles`);
      console.log(`🖼️ Images served from CloudFront: ${firstArticle.imageUrl.includes('cloudfront.net')}`);
    });

    test('should handle empty content gracefully', async () => {
      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockQuery = jest.fn().mockResolvedValue({ Items: [] });
      DynamoDBDocumentClient.from.mockReturnValue({
        query: mockQuery
      });

      const response = await request(app)
        .get('/api/articles/latest')
        .expect(200);

      expect(response.body.articles).toHaveLength(0);
      expect(response.body.count).toBe(0);

      console.log('✅ Empty content handled gracefully');
    });
  });

  describe('Article Detail Display', () => {
    test('should display full article content', async () => {
      const mockArticle = TestDataGenerator.generateArticle({
        id: '1',
        title: 'Komplexný článok o galaxiách',
        slug: 'komplexny-clanok-o-galaxiach',
        perex: 'Tento článok sa zaoberá fascinujúcimi vlastnosťami galaxií v našom vesmíre.',
        category: 'objav-dna',
        publishedAt: '2025-01-15T06:00:00.000Z',
        originalDate: '2025-01-15',
        author: 'AI Assistant',
        readingTime: '8 min',
        imageUrl: 'https://d2ydyf9w4v170.cloudfront.net/images/2025-01-15.jpg',
        metaTitle: 'Komplexný článok o galaxiách',
        metaDescription: 'Fascinujúce vlastnosti galaxií v našom vesmíre',
        type: 'discovery',
        tags: ['galaxia', 'vesmír', 'astronómia'],
        content: [
          {
            title: 'Úvod do galaxií',
            content: 'Galaxie sú obrovské zoskupenia hviezd, plynu a prachu, ktoré sú držané pohromade gravitáciou. V našom vesmíre existujú miliardy galaxií, každá s jedinečnými vlastnosťami a štruktúrou.'
          },
          {
            title: 'Typy galaxií',
            content: 'Galaxie sa delia na tri hlavné typy: špirálové, eliptické a nepravidelné. Špirálové galaxie, ako je naša Mliečna cesta, majú charakteristické ramená s hviezdami a plynom.'
          },
          {
            title: 'Výskum galaxií',
            content: 'Moderné teleskopy a vesmírne observatóriá nám umožňujú študovať galaxie v detailoch, ktoré boli predtým nepredstaviteľné. Hubble teleskop a ďalšie nástroje odhaľujú tajomstvá vesmíru.'
          }
        ],
        faq: [
          {
            question: 'Koľko galaxií existuje v pozorovateľnom vesmíre?',
            answer: 'V pozorovateľnom vesmíre existuje odhadom 100-200 miliárd galaxií, ale toto číslo sa môže zmeniť s pokrokom v technológii pozorovania.'
          },
          {
            question: 'Ako sa galaxie formovali?',
            answer: 'Galaxie sa formovali z gravitačného kolapsu hmoty v ranom vesmíre, približne 13,8 miliardy rokov dozadu.'
          }
        ],
        keywords: ['galaxia', 'vesmír', 'astronómia', 'hubble', 'hviezdy']
      });

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockQuery = jest.fn().mockResolvedValue({ Items: [mockArticle] });
      DynamoDBDocumentClient.from.mockReturnValue({
        query: mockQuery
      });

      const response = await request(app)
        .get('/api/articles/slug/komplexny-clanok-o-galaxiach')
        .expect(200);

      expect(response.body).toHaveProperty('articleId', '1');
      expect(response.body).toHaveProperty('title', 'Komplexný článok o galaxiách');
      expect(response.body).toHaveProperty('slug', 'komplexny-clanok-o-galaxiach');
      expect(response.body).toHaveProperty('perex');
      expect(response.body).toHaveProperty('content');
      expect(response.body).toHaveProperty('faq');
      expect(response.body).toHaveProperty('keywords');

      // Verify content structure
      expect(response.body.content).toHaveLength(3);
      expect(response.body.content[0].title).toBe('Úvod do galaxií');
      expect(response.body.content[0].content).toContain('Galaxie sú obrovské zoskupenia');

      // Verify FAQ structure
      expect(response.body.faq).toHaveLength(2);
      expect(response.body.faq[0].question).toContain('Koľko galaxií');
      expect(response.body.faq[0].answer).toContain('100-200 miliárd');

      // Verify metadata
      expect(response.body.readingTime).toBe('8 min');
      expect(response.body.author).toBe('AI Assistant');
      expect(response.body.tags).toContain('galaxia');
      expect(response.body.tags).toContain('vesmír');

      console.log('✅ Article detail display verified');
      console.log(`📖 Article: ${response.body.title}`);
      console.log(`⏱️ Reading time: ${response.body.readingTime}`);
      console.log(`📝 Content sections: ${response.body.content.length}`);
      console.log(`❓ FAQ items: ${response.body.faq.length}`);
    });

    test('should handle article not found', async () => {
      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockQuery = jest.fn().mockResolvedValue({ Items: [] });
      DynamoDBDocumentClient.from.mockReturnValue({
        query: mockQuery
      });

      const response = await request(app)
        .get('/api/articles/slug/non-existent-article')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Article not found');

      console.log('✅ Article not found handled correctly');
    });
  });

  describe('Category Page Display', () => {
    test('should display articles by category', async () => {
      const mockArticles = [
        TestDataGenerator.generateArticle({
          id: '1',
          title: 'Objav DNA v meteorite',
          slug: 'objav-dna-v-meteorite',
          category: 'objav-dna',
          publishedAt: '2025-01-15T06:00:00.000Z'
        }),
        TestDataGenerator.generateArticle({
          id: '2',
          title: 'Nový objav exoplanéty',
          slug: 'novy-objav-exoplanety',
          category: 'objav-dna',
          publishedAt: '2025-01-14T06:00:00.000Z'
        }),
        TestDataGenerator.generateArticle({
          id: '3',
          title: 'Týždenný výber z ESA',
          slug: 'tyzdenny-vyber-z-esa',
          category: 'tyzdenny-vyber',
          publishedAt: '2025-01-13T06:00:00.000Z'
        })
      ];

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockQuery = jest.fn().mockImplementation((params, callback) => {
        // Filter by category
        const category = params.ExpressionAttributeValues[':category'];
        const filteredArticles = mockArticles.filter(article => article.category === category);
        callback(null, { Items: filteredArticles });
      });
      DynamoDBDocumentClient.from.mockReturnValue({
        query: mockQuery
      });

      // Test objav-dna category
      const response = await request(app)
        .get('/api/articles/category/objav-dna')
        .query({ limit: '10' })
        .expect(200);

      expect(response.body.articles).toHaveLength(2);
      expect(response.body.articles[0].category).toBe('objav-dna');
      expect(response.body.articles[1].category).toBe('objav-dna');

      // Test tyzdenny-vyber category
      const response2 = await request(app)
        .get('/api/articles/category/tyzdenny-vyber')
        .query({ limit: '10' })
        .expect(200);

      expect(response2.body.articles).toHaveLength(1);
      expect(response2.body.articles[0].category).toBe('tyzdenny-vyber');

      console.log('✅ Category page display verified');
      console.log(`📂 Objav DNA articles: ${response.body.articles.length}`);
      console.log(`📂 Týždenný výber articles: ${response2.body.articles.length}`);
    });

    test('should handle empty category gracefully', async () => {
      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockQuery = jest.fn().mockResolvedValue({ Items: [] });
      DynamoDBDocumentClient.from.mockReturnValue({
        query: mockQuery
      });

      const response = await request(app)
        .get('/api/articles/category/empty-category')
        .expect(200);

      expect(response.body.articles).toHaveLength(0);

      console.log('✅ Empty category handled gracefully');
    });
  });

  describe('Search Functionality', () => {
    test('should search articles by query', async () => {
      const mockArticles = [
        TestDataGenerator.generateArticle({
          id: '1',
          title: 'Článok o Mars roveri',
          slug: 'clanok-o-mars-roveri',
          perex: 'Tento článok sa zaoberá najnovšími objavmi Mars roveru Perseverance.',
          tags: ['mars', 'rover', 'vesmír']
        }),
        TestDataGenerator.generateArticle({
          id: '2',
          title: 'Galaxia Andromeda',
          slug: 'galaxia-andromeda',
          perex: 'Andromeda je naša najbližšia galaktická susedka.',
          tags: ['galaxia', 'andromeda', 'vesmír']
        }),
        TestDataGenerator.generateArticle({
          id: '3',
          title: 'Hubble teleskop a jeho objavy',
          slug: 'hubble-teleskop-a-jeho-objavy',
          perex: 'Hubble teleskop prispel k mnohým dôležitým objavom v astronómii.',
          tags: ['hubble', 'teleskop', 'astronómia']
        })
      ];

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockScan = jest.fn().mockImplementation((params, callback) => {
        // Simple search simulation - filter by query
        const query = params.FilterExpression.includes('mars') ? 'mars' : 'hubble';
        const filteredArticles = mockArticles.filter(article => 
          article.title.toLowerCase().includes(query) || 
          article.perex.toLowerCase().includes(query) ||
          article.tags.some(tag => tag.toLowerCase().includes(query))
        );
        callback(null, { Items: filteredArticles });
      });
      DynamoDBDocumentClient.from.mockReturnValue({
        scan: mockScan
      });

      // Search for "mars"
      const response = await request(app)
        .get('/api/articles/search')
        .query({ q: 'mars', limit: '10' })
        .expect(200);

      expect(response.body.articles).toHaveLength(1);
      expect(response.body.articles[0].title).toContain('Mars');

      // Search for "hubble"
      const response2 = await request(app)
        .get('/api/articles/search')
        .query({ q: 'hubble', limit: '10' })
        .expect(200);

      expect(response2.body.articles).toHaveLength(1);
      expect(response2.body.articles[0].title).toContain('Hubble');

      console.log('✅ Search functionality verified');
      console.log(`🔍 Mars search results: ${response.body.articles.length}`);
      console.log(`🔍 Hubble search results: ${response2.body.articles.length}`);
    });

    test('should handle empty search results', async () => {
      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockScan = jest.fn().mockResolvedValue({ Items: [] });
      DynamoDBDocumentClient.from.mockReturnValue({
        scan: mockScan
      });

      const response = await request(app)
        .get('/api/articles/search')
        .query({ q: 'nonexistent', limit: '10' })
        .expect(200);

      expect(response.body.articles).toHaveLength(0);

      console.log('✅ Empty search results handled gracefully');
    });

    test('should require search query', async () => {
      const response = await request(app)
        .get('/api/articles/search')
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Search query is required');

      console.log('✅ Search query validation verified');
    });
  });

  describe('Image and Media Display', () => {
    test('should serve images from CloudFront', async () => {
      const mockArticle = TestDataGenerator.generateArticle({
        id: '1',
        title: 'Článok s obrázkom',
        slug: 'clanok-s-obrazkom',
        imageUrl: 'https://d2ydyf9w4v170.cloudfront.net/images/2025-01-15.jpg',
        cachedImage: {
          bucket: 'infinite-nasa-apod-dev-images-349660737637',
          key: 'images/2025-01-15.jpg',
          url: 'https://d2ydyf9w4v170.cloudfront.net/images/2025-01-15.jpg',
          contentType: 'image/jpeg',
          originalUrl: 'https://apod.nasa.gov/apod/image/test.jpg'
        }
      });

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockQuery = jest.fn().mockResolvedValue({ Items: [mockArticle] });
      DynamoDBDocumentClient.from.mockReturnValue({
        query: mockQuery
      });

      const response = await request(app)
        .get('/api/articles/slug/clanok-s-obrazkom')
        .expect(200);

      expect(response.body.imageUrl).toContain('cloudfront.net');
      expect(response.body.imageUrl).toContain('images/2025-01-15.jpg');
      expect(response.body.cachedImage).toBeDefined();
      expect(response.body.cachedImage.url).toContain('cloudfront.net');

      console.log('✅ Image serving from CloudFront verified');
      console.log(`🖼️ Image URL: ${response.body.imageUrl}`);
      console.log(`☁️ CloudFront domain: ${response.body.cachedImage.url}`);
    });

    test('should handle missing images gracefully', async () => {
      const mockArticle = TestDataGenerator.generateArticle({
        id: '1',
        title: 'Článok bez obrázka',
        slug: 'clanok-bez-obrazka',
        imageUrl: null,
        cachedImage: null
      });

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockQuery = jest.fn().mockResolvedValue({ Items: [mockArticle] });
      DynamoDBDocumentClient.from.mockReturnValue({
        query: mockQuery
      });

      const response = await request(app)
        .get('/api/articles/slug/clanok-bez-obrazka')
        .expect(200);

      expect(response.body.imageUrl).toBeNull();
      expect(response.body.cachedImage).toBeNull();

      console.log('✅ Missing images handled gracefully');
    });
  });

  describe('Performance and Caching', () => {
    test('should respond within acceptable time limits', async () => {
      const mockArticles = Array(10).fill().map((_, i) => 
        TestDataGenerator.generateArticle({ id: `${i + 1}`, title: `Article ${i + 1}` })
      );

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockQuery = jest.fn().mockResolvedValue({ Items: mockArticles });
      DynamoDBDocumentClient.from.mockReturnValue({
        query: mockQuery
      });

      const startTime = Date.now();

      const response = await request(app)
        .get('/api/articles/latest')
        .query({ limit: '10' })
        .expect(200);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.body.articles).toHaveLength(10);
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second

      console.log(`⏱️ API response time: ${responseTime}ms`);
      console.log('✅ Performance requirements met');
    });

    test('should include proper caching headers', async () => {
      const mockArticles = [TestDataGenerator.generateArticle()];

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockQuery = jest.fn().mockResolvedValue({ Items: mockArticles });
      DynamoDBDocumentClient.from.mockReturnValue({
        query: mockQuery
      });

      const response = await request(app)
        .get('/api/articles/latest')
        .expect(200);

      expect(response.headers['cache-control']).toContain('max-age');
      expect(response.headers['etag']).toBeDefined();

      console.log('✅ Caching headers included');
      console.log(`📦 Cache-Control: ${response.headers['cache-control']}`);
      console.log(`🏷️ ETag: ${response.headers['etag']}`);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle database errors gracefully', async () => {
      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockQuery = jest.fn().mockRejectedValue(new Error('Database connection failed'));
      DynamoDBDocumentClient.from.mockReturnValue({
        query: mockQuery
      });

      const response = await request(app)
        .get('/api/articles/latest')
        .expect(500);

      expect(response.body).toHaveProperty('error');

      console.log('✅ Database errors handled gracefully');
    });

    test('should handle malformed requests', async () => {
      const response = await request(app)
        .get('/api/articles/latest')
        .query({ limit: 'invalid' })
        .expect(200); // Should use default limit

      expect(response.body.articles).toBeDefined();

      console.log('✅ Malformed requests handled gracefully');
    });

    test('should handle large result sets', async () => {
      const mockArticles = Array(100).fill().map((_, i) => 
        TestDataGenerator.generateArticle({ id: `${i + 1}`, title: `Article ${i + 1}` })
      );

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockQuery = jest.fn().mockResolvedValue({ Items: mockArticles });
      DynamoDBDocumentClient.from.mockReturnValue({
        query: mockQuery
      });

      const response = await request(app)
        .get('/api/articles/latest')
        .query({ limit: '100' })
        .expect(200);

      expect(response.body.articles).toHaveLength(100);

      console.log('✅ Large result sets handled correctly');
      console.log(`📊 Returned ${response.body.articles.length} articles`);
    });
  });
});
