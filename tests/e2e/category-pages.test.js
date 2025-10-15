/**
 * End-to-end tests for category pages
 * Tests the complete category page workflow and navigation
 */

const request = require('supertest');
const { AWSMockHelper, TestDataGenerator, AssertionHelper } = require('../helpers/test-utils');

// Mock AWS SDK
jest.mock('aws-sdk', () => ({
  DynamoDB: {
    DocumentClient: jest.fn(() => ({
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

describe('Category Pages E2E', () => {
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

  describe('Objav DNA Category Page', () => {
    test('should display articles in objav-dna category', async () => {
      const mockArticles = [
        TestDataGenerator.generateArticle({
          id: '1',
          title: 'Objav DNA v meteorite z Marsu',
          slug: 'objav-dna-v-meteorite-z-marsu',
          perex: 'Vedci objavili stopy DNA v meteorite, ktorý pochádza z Marsu. Tento objav môže naznačovať existenciu života na červenej planéte.',
          category: 'objav-dna',
          publishedAt: '2025-01-15T06:00:00.000Z',
          originalDate: '2025-01-15',
          author: 'AI Assistant',
          readingTime: '6 min',
          imageUrl: 'https://d2ydyf9w4v170.cloudfront.net/images/2025-01-15.jpg',
          metaTitle: 'Objav DNA v meteorite z Marsu',
          metaDescription: 'Vedci objavili stopy DNA v meteorite z Marsu',
          type: 'discovery',
          tags: ['mars', 'dna', 'meteorit', 'život', 'objav']
        }),
        TestDataGenerator.generateArticle({
          id: '2',
          title: 'Nový objav exoplanéty s podmienkami pre život',
          slug: 'novy-objav-exoplanety-s-podmienkami-pre-zivot',
          perex: 'Astronómovia objavili exoplanétu v obyvateľnej zóne s podmienkami podobnými Zemi. Tento objav otvára nové možnosti pre hľadanie mimozemského života.',
          category: 'objav-dna',
          publishedAt: '2025-01-14T06:00:00.000Z',
          originalDate: '2025-01-14',
          author: 'AI Assistant',
          readingTime: '7 min',
          imageUrl: 'https://d2ydyf9w4v170.cloudfront.net/images/2025-01-14.jpg',
          metaTitle: 'Nový objav exoplanéty s podmienkami pre život',
          metaDescription: 'Astronómovia objavili exoplanétu v obyvateľnej zóne',
          type: 'discovery',
          tags: ['exoplanéta', 'život', 'obyvateľná zóna', 'objav']
        }),
        TestDataGenerator.generateArticle({
          id: '3',
          title: 'Objav novej čiernej diery v centre galaxie',
          slug: 'objav-novej-ciernej-diary-v-centre-galaxie',
          perex: 'Vedci objavili novú supermasívnu čiernu dieru v centre našej galaxie. Tento objav mení naše chápanie galaktickej štruktúry.',
          category: 'objav-dna',
          publishedAt: '2025-01-13T06:00:00.000Z',
          originalDate: '2025-01-13',
          author: 'AI Assistant',
          readingTime: '5 min',
          imageUrl: 'https://d2ydyf9w4v170.cloudfront.net/images/2025-01-13.jpg',
          metaTitle: 'Objav novej čiernej diery v centre galaxie',
          metaDescription: 'Vedci objavili novú supermasívnu čiernu dieru',
          type: 'discovery',
          tags: ['čierna diera', 'galaxia', 'objav', 'vesmír']
        })
      ];

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockQuery = jest.fn().mockResolvedValue({ Items: mockArticles });
      DynamoDBDocumentClient.from.mockReturnValue({
        query: mockQuery
      });

      const response = await request(app)
        .get('/api/articles/category/objav-dna')
        .query({ limit: '10' })
        .expect(200);

      expect(response.body).toHaveProperty('articles');
      expect(response.body.articles).toHaveLength(3);
      
      // Verify all articles are in objav-dna category
      response.body.articles.forEach(article => {
        expect(article.category).toBe('objav-dna');
        expect(article.type).toBe('discovery');
      });

      // Verify article details
      const firstArticle = response.body.articles[0];
      expect(firstArticle.title).toBe('Objav DNA v meteorite z Marsu');
      expect(firstArticle.slug).toBe('objav-dna-v-meteorite-z-marsu');
      expect(firstArticle.tags).toContain('mars');
      expect(firstArticle.tags).toContain('dna');
      expect(firstArticle.readingTime).toBe('6 min');

      console.log('✅ Objav DNA category page verified');
      console.log(`📂 Category: objav-dna`);
      console.log(`📊 Articles: ${response.body.articles.length}`);
      console.log(`📰 Latest: ${firstArticle.title}`);
    });

    test('should sort articles by publication date', async () => {
      const mockArticles = [
        TestDataGenerator.generateArticle({
          id: '1',
          title: 'Najnovší objav',
          slug: 'najnovsi-objav',
          category: 'objav-dna',
          publishedAt: '2025-01-15T06:00:00.000Z',
          originalDate: '2025-01-15'
        }),
        TestDataGenerator.generateArticle({
          id: '2',
          title: 'Starší objav',
          slug: 'starsie-objav',
          category: 'objav-dna',
          publishedAt: '2025-01-14T06:00:00.000Z',
          originalDate: '2025-01-14'
        }),
        TestDataGenerator.generateArticle({
          id: '3',
          title: 'Najstarší objav',
          slug: 'najstarsie-objav',
          category: 'objav-dna',
          publishedAt: '2025-01-13T06:00:00.000Z',
          originalDate: '2025-01-13'
        })
      ];

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockQuery = jest.fn().mockResolvedValue({ Items: mockArticles });
      DynamoDBDocumentClient.from.mockReturnValue({
        query: mockQuery
      });

      const response = await request(app)
        .get('/api/articles/category/objav-dna')
        .query({ limit: '10' })
        .expect(200);

      expect(response.body.articles).toHaveLength(3);
      
      // Verify sorting (newest first)
      expect(response.body.articles[0].title).toBe('Najnovší objav');
      expect(response.body.articles[1].title).toBe('Starší objav');
      expect(response.body.articles[2].title).toBe('Najstarší objav');

      console.log('✅ Article sorting by date verified');
      console.log(`📅 Latest: ${response.body.articles[0].publishedAt}`);
      console.log(`📅 Oldest: ${response.body.articles[2].publishedAt}`);
    });
  });

  describe('Týždenný Výber Category Page', () => {
    test('should display articles in tyzdenny-vyber category', async () => {
      const mockArticles = [
        TestDataGenerator.generateArticle({
          id: '1',
          title: 'Týždenný výber z ESA Hubble teleskopu',
          slug: 'tyzdenny-vyber-z-esa-hubble-teleskopu',
          perex: 'Tento týždeň vám prinášame najkrajšie snímky z ESA Hubble teleskopu. Objavte fascinujúce galaxie, hmloviny a hviezdne formácie.',
          category: 'tyzdenny-vyber',
          publishedAt: '2025-01-15T06:00:00.000Z',
          originalDate: '2025-01-15',
          author: 'AI Assistant',
          readingTime: '4 min',
          imageUrl: 'https://d2ydyf9w4v170.cloudfront.net/images/2025-01-15.jpg',
          metaTitle: 'Týždenný výber z ESA Hubble teleskopu',
          metaDescription: 'Najkrajšie snímky z ESA Hubble teleskopu',
          type: 'weekly-pick',
          tags: ['hubble', 'esa', 'galaxia', 'hmlovina', 'týždenný výber']
        }),
        TestDataGenerator.generateArticle({
          id: '2',
          title: 'Týždenný výber z NASA APOD',
          slug: 'tyzdenny-vyber-z-nasa-apod',
          perex: 'Tento týždeň sme vybrali najzaujímavejšie snímky z NASA Astronomy Picture of the Day. Objavte krásu vesmíru.',
          category: 'tyzdenny-vyber',
          publishedAt: '2025-01-14T06:00:00.000Z',
          originalDate: '2025-01-14',
          author: 'AI Assistant',
          readingTime: '3 min',
          imageUrl: 'https://d2ydyf9w4v170.cloudfront.net/images/2025-01-14.jpg',
          metaTitle: 'Týždenný výber z NASA APOD',
          metaDescription: 'Najzaujímavejšie snímky z NASA APOD',
          type: 'weekly-pick',
          tags: ['nasa', 'apod', 'astronómia', 'týždenný výber']
        })
      ];

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockQuery = jest.fn().mockResolvedValue({ Items: mockArticles });
      DynamoDBDocumentClient.from.mockReturnValue({
        query: mockQuery
      });

      const response = await request(app)
        .get('/api/articles/category/tyzdenny-vyber')
        .query({ limit: '10' })
        .expect(200);

      expect(response.body).toHaveProperty('articles');
      expect(response.body.articles).toHaveLength(2);
      
      // Verify all articles are in tyzdenny-vyber category
      response.body.articles.forEach(article => {
        expect(article.category).toBe('tyzdenny-vyber');
        expect(article.type).toBe('weekly-pick');
      });

      // Verify article details
      const firstArticle = response.body.articles[0];
      expect(firstArticle.title).toBe('Týždenný výber z ESA Hubble teleskopu');
      expect(firstArticle.slug).toBe('tyzdenny-vyber-z-esa-hubble-teleskopu');
      expect(firstArticle.tags).toContain('hubble');
      expect(firstArticle.tags).toContain('esa');
      expect(firstArticle.readingTime).toBe('4 min');

      console.log('✅ Týždenný výber category page verified');
      console.log(`📂 Category: tyzdenny-vyber`);
      console.log(`📊 Articles: ${response.body.articles.length}`);
      console.log(`📰 Latest: ${firstArticle.title}`);
    });

    test('should display weekly pick articles with proper metadata', async () => {
      const mockArticles = [
        TestDataGenerator.generateArticle({
          id: '1',
          title: 'Týždenný výber z ESA',
          slug: 'tyzdenny-vyber-z-esa',
          perex: 'Tento týždeň vám prinášame najkrajšie snímky z ESA.',
          category: 'tyzdenny-vyber',
          publishedAt: '2025-01-15T06:00:00.000Z',
          originalDate: '2025-01-15',
          type: 'weekly-pick',
          tags: ['esa', 'týždenný výber']
        })
      ];

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockQuery = jest.fn().mockResolvedValue({ Items: mockArticles });
      DynamoDBDocumentClient.from.mockReturnValue({
        query: mockQuery
      });

      const response = await request(app)
        .get('/api/articles/category/tyzdenny-vyber')
        .query({ limit: '10' })
        .expect(200);

      expect(response.body.articles).toHaveLength(1);
      
      const article = response.body.articles[0];
      expect(article.type).toBe('weekly-pick');
      expect(article.category).toBe('tyzdenny-vyber');
      expect(article.tags).toContain('týždenný výber');

      console.log('✅ Weekly pick metadata verified');
      console.log(`📰 Type: ${article.type}`);
      console.log(`🏷️ Tags: ${article.tags.join(', ')}`);
    });
  });

  describe('Category Navigation and Filtering', () => {
    test('should handle pagination in category pages', async () => {
      const mockArticles = Array(25).fill().map((_, i) => 
        TestDataGenerator.generateArticle({
          id: `${i + 1}`,
          title: `Objav číslo ${i + 1}`,
          slug: `objav-cislo-${i + 1}`,
          category: 'objav-dna',
          publishedAt: `2025-01-${15 - i}T06:00:00.000Z`,
          originalDate: `2025-01-${15 - i}`
        })
      );

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockQuery = jest.fn().mockImplementation((params, callback) => {
        // Simulate pagination
        const limit = parseInt(params.Limit) || 10;
        const startIndex = 0;
        const endIndex = Math.min(startIndex + limit, mockArticles.length);
        const paginatedArticles = mockArticles.slice(startIndex, endIndex);
        
        callback(null, { 
          Items: paginatedArticles,
          LastEvaluatedKey: endIndex < mockArticles.length ? { articleId: `${endIndex}` } : null
        });
      });
      DynamoDBDocumentClient.from.mockReturnValue({
        query: mockQuery
      });

      // First page
      const response = await request(app)
        .get('/api/articles/category/objav-dna')
        .query({ limit: '10' })
        .expect(200);

      expect(response.body.articles).toHaveLength(10);
      expect(response.body.articles[0].title).toBe('Objav číslo 1');
      expect(response.body.articles[9].title).toBe('Objav číslo 10');

      console.log('✅ Category pagination verified');
      console.log(`📊 Page 1: ${response.body.articles.length} articles`);
      console.log(`📰 First: ${response.body.articles[0].title}`);
      console.log(`📰 Last: ${response.body.articles[9].title}`);
    });

    test('should handle empty category gracefully', async () => {
      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockQuery = jest.fn().mockResolvedValue({ Items: [] });
      DynamoDBDocumentClient.from.mockReturnValue({
        query: mockQuery
      });

      const response = await request(app)
        .get('/api/articles/category/empty-category')
        .query({ limit: '10' })
        .expect(200);

      expect(response.body.articles).toHaveLength(0);

      console.log('✅ Empty category handled gracefully');
    });

    test('should validate category parameter', async () => {
      const response = await request(app)
        .get('/api/articles/category/')
        .expect(404);

      console.log('✅ Category parameter validation verified');
    });
  });

  describe('Category Page Performance', () => {
    test('should load category pages within acceptable time', async () => {
      const mockArticles = Array(50).fill().map((_, i) => 
        TestDataGenerator.generateArticle({
          id: `${i + 1}`,
          title: `Článok ${i + 1}`,
          slug: `clanok-${i + 1}`,
          category: 'objav-dna'
        })
      );

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockQuery = jest.fn().mockImplementation((params, callback) => {
        // Simulate processing time
        setTimeout(() => {
          const limit = parseInt(params.Limit) || 10;
          const paginatedArticles = mockArticles.slice(0, limit);
          callback(null, { Items: paginatedArticles });
        }, 50);
      });
      DynamoDBDocumentClient.from.mockReturnValue({
        query: mockQuery
      });

      const startTime = Date.now();

      const response = await request(app)
        .get('/api/articles/category/objav-dna')
        .query({ limit: '20' })
        .expect(200);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.body.articles).toHaveLength(20);
      expect(responseTime).toBeLessThan(1000); // Should load within 1 second

      console.log(`⏱️ Category page load time: ${responseTime}ms`);
      console.log('✅ Category page performance requirements met');
    });

    test('should handle concurrent category page requests', async () => {
      const mockArticles = [
        TestDataGenerator.generateArticle({
          id: '1',
          title: 'Test Article',
          slug: 'test-article',
          category: 'objav-dna'
        })
      ];

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockQuery = jest.fn().mockResolvedValue({ Items: mockArticles });
      DynamoDBDocumentClient.from.mockReturnValue({
        query: mockQuery
      });

      // Execute multiple concurrent category requests
      const categories = ['objav-dna', 'tyzdenny-vyber'];
      const promises = categories.map(category => 
        request(app)
          .get(`/api/articles/category/${category}`)
          .query({ limit: '10' })
      );

      const results = await Promise.all(promises);

      // All requests should succeed
      results.forEach((result, index) => {
        expect(result.status).toBe(200);
        expect(result.body.articles).toBeDefined();
      });

      console.log('✅ Concurrent category requests handled');
      console.log(`📂 Tested ${categories.length} categories concurrently`);
    });
  });

  describe('Category Page SEO and Metadata', () => {
    test('should provide proper metadata for category pages', async () => {
      const mockArticles = [
        TestDataGenerator.generateArticle({
          id: '1',
          title: 'SEO Test Article',
          slug: 'seo-test-article',
          category: 'objav-dna',
          metaTitle: 'SEO Test Article - Objav DNA',
          metaDescription: 'Toto je testovací článok pre SEO kategóriu Objav DNA',
          tags: ['seo', 'test', 'objav']
        })
      ];

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockQuery = jest.fn().mockResolvedValue({ Items: mockArticles });
      DynamoDBDocumentClient.from.mockReturnValue({
        query: mockQuery
      });

      const response = await request(app)
        .get('/api/articles/category/objav-dna')
        .query({ limit: '10' })
        .expect(200);

      expect(response.body.articles).toHaveLength(1);
      
      const article = response.body.articles[0];
      expect(article).toHaveProperty('metaTitle');
      expect(article).toHaveProperty('metaDescription');
      expect(article).toHaveProperty('tags');
      expect(article.metaTitle).toContain('Objav DNA');
      expect(article.metaDescription).toContain('objav');

      console.log('✅ Category page SEO metadata verified');
      console.log(`📝 Meta title: ${article.metaTitle}`);
      console.log(`📝 Meta description: ${article.metaDescription}`);
    });

    test('should provide structured data for category pages', async () => {
      const mockArticles = [
        TestDataGenerator.generateArticle({
          id: '1',
          title: 'Structured Data Test',
          slug: 'structured-data-test',
          category: 'objav-dna',
          publishedAt: '2025-01-15T06:00:00.000Z',
          author: 'AI Assistant',
          readingTime: '5 min',
          tags: ['structured', 'data', 'test']
        })
      ];

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockQuery = jest.fn().mockResolvedValue({ Items: mockArticles });
      DynamoDBDocumentClient.from.mockReturnValue({
        query: mockQuery
      });

      const response = await request(app)
        .get('/api/articles/category/objav-dna')
        .query({ limit: '10' })
        .expect(200);

      expect(response.body.articles).toHaveLength(1);
      
      const article = response.body.articles[0];
      expect(article).toHaveProperty('publishedAt');
      expect(article).toHaveProperty('author');
      expect(article).toHaveProperty('readingTime');
      expect(article).toHaveProperty('tags');
      expect(article.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(article.readingTime).toMatch(/^\d+\s+min$/);

      console.log('✅ Category page structured data verified');
      console.log(`📅 Published: ${article.publishedAt}`);
      console.log(`👤 Author: ${article.author}`);
      console.log(`⏱️ Reading time: ${article.readingTime}`);
    });
  });

  describe('Category Page Error Handling', () => {
    test('should handle database errors gracefully', async () => {
      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockQuery = jest.fn().mockRejectedValue(new Error('Database connection failed'));
      DynamoDBDocumentClient.from.mockReturnValue({
        query: mockQuery
      });

      const response = await request(app)
        .get('/api/articles/category/objav-dna')
        .query({ limit: '10' })
        .expect(500);

      expect(response.body).toHaveProperty('error');

      console.log('✅ Database errors handled gracefully');
    });

    test('should handle invalid category names', async () => {
      const invalidCategories = ['invalid-category', 'non-existent', 'test@#$%'];

      for (const category of invalidCategories) {
        const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
        const mockQuery = jest.fn().mockResolvedValue({ Items: [] });
        DynamoDBDocumentClient.from.mockReturnValue({
          query: mockQuery
        });

        const response = await request(app)
          .get(`/api/articles/category/${category}`)
          .query({ limit: '10' })
          .expect(200);

        expect(response.body.articles).toHaveLength(0);
      }

      console.log('✅ Invalid category names handled gracefully');
    });

    test('should handle malformed requests', async () => {
      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockQuery = jest.fn().mockResolvedValue({ Items: [] });
      DynamoDBDocumentClient.from.mockReturnValue({
        query: mockQuery
      });

      // Test with invalid limit
      const response = await request(app)
        .get('/api/articles/category/objav-dna')
        .query({ limit: 'invalid' })
        .expect(200); // Should use default limit

      expect(response.body.articles).toBeDefined();

      console.log('✅ Malformed requests handled gracefully');
    });
  });
});
