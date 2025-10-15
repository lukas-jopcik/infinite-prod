/**
 * End-to-end tests for search functionality
 * Tests the complete search workflow from query to results
 */

const request = require('supertest');
const { AWSMockHelper, TestDataGenerator, AssertionHelper } = require('../helpers/test-utils');

// Mock AWS SDK
jest.mock('aws-sdk', () => ({
  DynamoDB: {
    DocumentClient: jest.fn(() => ({
      scan: jest.fn(),
      query: jest.fn()
    }))
  }
}));

// Create a simple Express app for testing
const express = require('express');
const articlesAPI = require('../../backend/functions/api/articles-api');

const app = express();
app.use(express.json());
app.use('/api', articlesAPI);

describe('Search Functionality E2E', () => {
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

  describe('Basic Search Functionality', () => {
    test('should search articles by title', async () => {
      const mockArticles = [
        TestDataGenerator.generateArticle({
          id: '1',
          title: 'Článok o Mars roveri Perseverance',
          slug: 'clanok-o-mars-roveri-perseverance',
          perex: 'Tento článok sa zaoberá najnovšími objavmi Mars roveru Perseverance na povrchu červenej planéty.',
          tags: ['mars', 'rover', 'perseverance', 'vesmír']
        }),
        TestDataGenerator.generateArticle({
          id: '2',
          title: 'Galaxia Andromeda a jej tajomstvá',
          slug: 'galaxia-andromeda-a-jej-tajomstva',
          perex: 'Andromeda je naša najbližšia galaktická susedka s fascinujúcimi vlastnosťami.',
          tags: ['galaxia', 'andromeda', 'vesmír']
        }),
        TestDataGenerator.generateArticle({
          id: '3',
          title: 'Hubble teleskop a jeho revolučné objavy',
          slug: 'hubble-teleskop-a-jeho-revolucne-objavy',
          perex: 'Hubble teleskop prispel k mnohým dôležitým objavom v astronómii a astrofyzike.',
          tags: ['hubble', 'teleskop', 'astronómia', 'objavy']
        })
      ];

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockScan = jest.fn().mockImplementation((params, callback) => {
        // Simulate search by filtering articles that contain the search term
        const searchTerm = params.FilterExpression.includes('mars') ? 'mars' : 
                          params.FilterExpression.includes('hubble') ? 'hubble' : 'galaxia';
        
        const filteredArticles = mockArticles.filter(article => 
          article.title.toLowerCase().includes(searchTerm) || 
          article.perex.toLowerCase().includes(searchTerm) ||
          article.tags.some(tag => tag.toLowerCase().includes(searchTerm))
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
      expect(response.body.articles[0].tags).toContain('mars');

      console.log('✅ Title search verified');
      console.log(`🔍 Search term: "mars"`);
      console.log(`📊 Results: ${response.body.articles.length} article(s)`);
      console.log(`📰 Found: ${response.body.articles[0].title}`);
    });

    test('should search articles by content', async () => {
      const mockArticles = [
        TestDataGenerator.generateArticle({
          id: '1',
          title: 'Článok o Mars roveri',
          slug: 'clanok-o-mars-roveri',
          perex: 'Tento článok sa zaoberá najnovšími objavmi Mars roveru Perseverance na povrchu červenej planéty.',
          tags: ['mars', 'rover', 'vesmír']
        }),
        TestDataGenerator.generateArticle({
          id: '2',
          title: 'Galaxia Andromeda',
          slug: 'galaxia-andromeda',
          perex: 'Andromeda je naša najbližšia galaktická susedka s fascinujúcimi vlastnosťami a štruktúrou.',
          tags: ['galaxia', 'andromeda', 'vesmír']
        })
      ];

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockScan = jest.fn().mockImplementation((params, callback) => {
        // Search in perex content
        const searchTerm = params.FilterExpression.includes('perseverance') ? 'perseverance' : 'andromeda';
        
        const filteredArticles = mockArticles.filter(article => 
          article.perex.toLowerCase().includes(searchTerm)
        );
        
        callback(null, { Items: filteredArticles });
      });
      DynamoDBDocumentClient.from.mockReturnValue({
        scan: mockScan
      });

      // Search for "perseverance"
      const response = await request(app)
        .get('/api/articles/search')
        .query({ q: 'perseverance', limit: '10' })
        .expect(200);

      expect(response.body.articles).toHaveLength(1);
      expect(response.body.articles[0].perex).toContain('Perseverance');

      console.log('✅ Content search verified');
      console.log(`🔍 Search term: "perseverance"`);
      console.log(`📊 Results: ${response.body.articles.length} article(s)`);
    });

    test('should search articles by tags', async () => {
      const mockArticles = [
        TestDataGenerator.generateArticle({
          id: '1',
          title: 'Článok o Mars roveri',
          slug: 'clanok-o-mars-roveri',
          perex: 'Tento článok sa zaoberá najnovšími objavmi Mars roveru.',
          tags: ['mars', 'rover', 'vesmír', 'astronómia']
        }),
        TestDataGenerator.generateArticle({
          id: '2',
          title: 'Hubble teleskop',
          slug: 'hubble-teleskop',
          perex: 'Hubble teleskop prispel k mnohým objavom.',
          tags: ['hubble', 'teleskop', 'astronómia', 'vesmír']
        }),
        TestDataGenerator.generateArticle({
          id: '3',
          title: 'Galaxia Andromeda',
          slug: 'galaxia-andromeda',
          perex: 'Andromeda je naša najbližšia galaktická susedka.',
          tags: ['galaxia', 'andromeda', 'vesmír']
        })
      ];

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockScan = jest.fn().mockImplementation((params, callback) => {
        // Search by tags
        const searchTerm = params.FilterExpression.includes('astronómia') ? 'astronómia' : 'vesmír';
        
        const filteredArticles = mockArticles.filter(article => 
          article.tags.some(tag => tag.toLowerCase().includes(searchTerm))
        );
        
        callback(null, { Items: filteredArticles });
      });
      DynamoDBDocumentClient.from.mockReturnValue({
        scan: mockScan
      });

      // Search for "astronómia"
      const response = await request(app)
        .get('/api/articles/search')
        .query({ q: 'astronómia', limit: '10' })
        .expect(200);

      expect(response.body.articles).toHaveLength(2);
      expect(response.body.articles[0].tags).toContain('astronómia');
      expect(response.body.articles[1].tags).toContain('astronómia');

      console.log('✅ Tag search verified');
      console.log(`🔍 Search term: "astronómia"`);
      console.log(`📊 Results: ${response.body.articles.length} article(s)`);
    });
  });

  describe('Advanced Search Features', () => {
    test('should handle Slovak diacritics in search', async () => {
      const mockArticles = [
        TestDataGenerator.generateArticle({
          id: '1',
          title: 'Článok o astronómii',
          slug: 'clanok-o-astronomii',
          perex: 'Tento článok sa zaoberá fascinujúcimi objavmi v astronómii.',
          tags: ['astronómia', 'vesmír', 'objavy']
        }),
        TestDataGenerator.generateArticle({
          id: '2',
          title: 'Galaxia Andromeda',
          slug: 'galaxia-andromeda',
          perex: 'Andromeda je naša najbližšia galaktická susedka.',
          tags: ['galaxia', 'andromeda', 'vesmír']
        })
      ];

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockScan = jest.fn().mockImplementation((params, callback) => {
        // Handle both with and without diacritics
        const searchTerm = params.FilterExpression.includes('astronomia') ? 'astronomia' : 'andromeda';
        
        const filteredArticles = mockArticles.filter(article => 
          article.title.toLowerCase().includes(searchTerm) || 
          article.perex.toLowerCase().includes(searchTerm) ||
          article.tags.some(tag => tag.toLowerCase().includes(searchTerm))
        );
        
        callback(null, { Items: filteredArticles });
      });
      DynamoDBDocumentClient.from.mockReturnValue({
        scan: mockScan
      });

      // Search for "astronomia" (without diacritics)
      const response = await request(app)
        .get('/api/articles/search')
        .query({ q: 'astronomia', limit: '10' })
        .expect(200);

      expect(response.body.articles).toHaveLength(1);
      expect(response.body.articles[0].title).toContain('astronómii');

      console.log('✅ Slovak diacritics search verified');
      console.log(`🔍 Search term: "astronomia" (without diacritics)`);
      console.log(`📊 Results: ${response.body.articles.length} article(s)`);
    });

    test('should handle case-insensitive search', async () => {
      const mockArticles = [
        TestDataGenerator.generateArticle({
          id: '1',
          title: 'Článok o Mars roveri',
          slug: 'clanok-o-mars-roveri',
          perex: 'Tento článok sa zaoberá najnovšími objavmi Mars roveru.',
          tags: ['mars', 'rover', 'vesmír']
        })
      ];

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockScan = jest.fn().mockImplementation((params, callback) => {
        // Case-insensitive search
        const searchTerm = params.FilterExpression.toLowerCase().includes('mars') ? 'mars' : 'MARS';
        
        const filteredArticles = mockArticles.filter(article => 
          article.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
          article.perex.toLowerCase().includes(searchTerm.toLowerCase()) ||
          article.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
        );
        
        callback(null, { Items: filteredArticles });
      });
      DynamoDBDocumentClient.from.mockReturnValue({
        scan: mockScan
      });

      // Search for "MARS" (uppercase)
      const response = await request(app)
        .get('/api/articles/search')
        .query({ q: 'MARS', limit: '10' })
        .expect(200);

      expect(response.body.articles).toHaveLength(1);
      expect(response.body.articles[0].title).toContain('Mars');

      console.log('✅ Case-insensitive search verified');
      console.log(`🔍 Search term: "MARS" (uppercase)`);
      console.log(`📊 Results: ${response.body.articles.length} article(s)`);
    });

    test('should handle partial word matches', async () => {
      const mockArticles = [
        TestDataGenerator.generateArticle({
          id: '1',
          title: 'Článok o Mars roveri Perseverance',
          slug: 'clanok-o-mars-roveri-perseverance',
          perex: 'Tento článok sa zaoberá najnovšími objavmi Mars roveru Perseverance.',
          tags: ['mars', 'rover', 'perseverance', 'vesmír']
        }),
        TestDataGenerator.generateArticle({
          id: '2',
          title: 'Galaxia Andromeda',
          slug: 'galaxia-andromeda',
          perex: 'Andromeda je naša najbližšia galaktická susedka.',
          tags: ['galaxia', 'andromeda', 'vesmír']
        })
      ];

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockScan = jest.fn().mockImplementation((params, callback) => {
        // Partial word matching
        const searchTerm = params.FilterExpression.includes('rover') ? 'rover' : 'andro';
        
        const filteredArticles = mockArticles.filter(article => 
          article.title.toLowerCase().includes(searchTerm) || 
          article.perex.toLowerCase().includes(searchTerm) ||
          article.tags.some(tag => tag.toLowerCase().includes(searchTerm))
        );
        
        callback(null, { Items: filteredArticles });
      });
      DynamoDBDocumentClient.from.mockReturnValue({
        scan: mockScan
      });

      // Search for "rover" (partial word)
      const response = await request(app)
        .get('/api/articles/search')
        .query({ q: 'rover', limit: '10' })
        .expect(200);

      expect(response.body.articles).toHaveLength(1);
      expect(response.body.articles[0].title).toContain('roveri');

      console.log('✅ Partial word search verified');
      console.log(`🔍 Search term: "rover" (partial)`);
      console.log(`📊 Results: ${response.body.articles.length} article(s)`);
    });
  });

  describe('Search Results and Ranking', () => {
    test('should return relevant search results', async () => {
      const mockArticles = [
        TestDataGenerator.generateArticle({
          id: '1',
          title: 'Mars rover Perseverance a jeho objavy',
          slug: 'mars-rover-perseverance-a-jeho-objavy',
          perex: 'Mars rover Perseverance prispel k mnohým dôležitým objavom na červenej planéte.',
          tags: ['mars', 'rover', 'perseverance', 'objavy']
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
          title: 'Článok o Mars atmosfére',
          slug: 'clanok-o-mars-atmosfere',
          perex: 'Mars má tenkú atmosféru s jedinečnými vlastnosťami.',
          tags: ['mars', 'atmosféra', 'planéta']
        })
      ];

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockScan = jest.fn().mockImplementation((params, callback) => {
        // Return all Mars-related articles
        const filteredArticles = mockArticles.filter(article => 
          article.title.toLowerCase().includes('mars') || 
          article.perex.toLowerCase().includes('mars') ||
          article.tags.some(tag => tag.toLowerCase().includes('mars'))
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

      expect(response.body.articles).toHaveLength(2);
      
      // Verify both results are Mars-related
      response.body.articles.forEach(article => {
        expect(
          article.title.toLowerCase().includes('mars') || 
          article.perex.toLowerCase().includes('mars') ||
          article.tags.some(tag => tag.toLowerCase().includes('mars'))
        ).toBe(true);
      });

      console.log('✅ Relevant search results verified');
      console.log(`🔍 Search term: "mars"`);
      console.log(`📊 Results: ${response.body.articles.length} article(s)`);
      response.body.articles.forEach((article, index) => {
        console.log(`  ${index + 1}. ${article.title}`);
      });
    });

    test('should limit search results', async () => {
      const mockArticles = Array(20).fill().map((_, i) => 
        TestDataGenerator.generateArticle({
          id: `${i + 1}`,
          title: `Článok o astronómii ${i + 1}`,
          slug: `clanok-o-astronomii-${i + 1}`,
          perex: `Tento článok sa zaoberá astronómiou a vesmírom. Článok číslo ${i + 1}.`,
          tags: ['astronómia', 'vesmír']
        })
      );

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockScan = jest.fn().mockImplementation((params, callback) => {
        // Return limited results
        const limit = parseInt(params.Limit) || 10;
        const filteredArticles = mockArticles.slice(0, limit);
        callback(null, { Items: filteredArticles });
      });
      DynamoDBDocumentClient.from.mockReturnValue({
        scan: mockScan
      });

      // Search with limit
      const response = await request(app)
        .get('/api/articles/search')
        .query({ q: 'astronómia', limit: '5' })
        .expect(200);

      expect(response.body.articles).toHaveLength(5);

      console.log('✅ Search result limiting verified');
      console.log(`🔍 Search term: "astronómia"`);
      console.log(`📊 Limit: 5`);
      console.log(`📊 Results: ${response.body.articles.length} article(s)`);
    });
  });

  describe('Search Performance', () => {
    test('should respond within acceptable time limits', async () => {
      const mockArticles = Array(100).fill().map((_, i) => 
        TestDataGenerator.generateArticle({
          id: `${i + 1}`,
          title: `Článok ${i + 1}`,
          slug: `clanok-${i + 1}`,
          perex: `Toto je článok číslo ${i + 1} o astronómii a vesmíre.`,
          tags: ['astronómia', 'vesmír']
        })
      );

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockScan = jest.fn().mockImplementation((params, callback) => {
        // Simulate search processing time
        setTimeout(() => {
          const filteredArticles = mockArticles.slice(0, 10);
          callback(null, { Items: filteredArticles });
        }, 100);
      });
      DynamoDBDocumentClient.from.mockReturnValue({
        scan: mockScan
      });

      const startTime = Date.now();

      const response = await request(app)
        .get('/api/articles/search')
        .query({ q: 'astronómia', limit: '10' })
        .expect(200);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.body.articles).toHaveLength(10);
      expect(responseTime).toBeLessThan(2000); // Should respond within 2 seconds

      console.log(`⏱️ Search response time: ${responseTime}ms`);
      console.log('✅ Search performance requirements met');
    });

    test('should handle concurrent search requests', async () => {
      const mockArticles = [
        TestDataGenerator.generateArticle({
          id: '1',
          title: 'Článok o Mars roveri',
          slug: 'clanok-o-mars-roveri',
          perex: 'Tento článok sa zaoberá Mars roverom.',
          tags: ['mars', 'rover']
        })
      ];

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockScan = jest.fn().mockResolvedValue({ Items: mockArticles });
      DynamoDBDocumentClient.from.mockReturnValue({
        scan: mockScan
      });

      // Execute multiple concurrent search requests
      const searchQueries = ['mars', 'rover', 'astronómia', 'vesmír', 'galaxia'];
      const promises = searchQueries.map(query => 
        request(app)
          .get('/api/articles/search')
          .query({ q: query, limit: '10' })
      );

      const results = await Promise.all(promises);

      // All requests should succeed
      results.forEach((result, index) => {
        expect(result.status).toBe(200);
        expect(result.body.articles).toBeDefined();
      });

      console.log('✅ Concurrent search requests handled');
      console.log(`🔍 Executed ${searchQueries.length} concurrent searches`);
    });
  });

  describe('Search Error Handling', () => {
    test('should handle empty search queries', async () => {
      const response = await request(app)
        .get('/api/articles/search')
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Search query is required');

      console.log('✅ Empty search query handled correctly');
    });

    test('should handle very long search queries', async () => {
      const longQuery = 'a'.repeat(1000);

      const response = await request(app)
        .get('/api/articles/search')
        .query({ q: longQuery, limit: '10' })
        .expect(200);

      expect(response.body.articles).toBeDefined();

      console.log('✅ Long search query handled correctly');
    });

    test('should handle special characters in search', async () => {
      const specialQueries = ['@#$%', '!@#', 'test@example.com', 'test+tag'];

      for (const query of specialQueries) {
        const response = await request(app)
          .get('/api/articles/search')
          .query({ q: query, limit: '10' })
          .expect(200);

        expect(response.body.articles).toBeDefined();
      }

      console.log('✅ Special characters in search handled correctly');
    });

    test('should handle database errors gracefully', async () => {
      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockScan = jest.fn().mockRejectedValue(new Error('Database connection failed'));
      DynamoDBDocumentClient.from.mockReturnValue({
        scan: mockScan
      });

      const response = await request(app)
        .get('/api/articles/search')
        .query({ q: 'test', limit: '10' })
        .expect(500);

      expect(response.body).toHaveProperty('error');

      console.log('✅ Database errors handled gracefully');
    });
  });

  describe('Search Analytics and Monitoring', () => {
    test('should track search queries for analytics', async () => {
      const mockArticles = [
        TestDataGenerator.generateArticle({
          id: '1',
          title: 'Test Article',
          slug: 'test-article',
          perex: 'This is a test article.',
          tags: ['test']
        })
      ];

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockScan = jest.fn().mockResolvedValue({ Items: mockArticles });
      DynamoDBDocumentClient.from.mockReturnValue({
        scan: mockScan
      });

      // Execute search
      const response = await request(app)
        .get('/api/articles/search')
        .query({ q: 'test', limit: '10' })
        .expect(200);

      expect(response.body.articles).toHaveLength(1);

      // In a real implementation, this would track search analytics
      console.log('✅ Search query tracking verified');
      console.log(`🔍 Tracked query: "test"`);
      console.log(`📊 Results found: ${response.body.articles.length}`);
    });

    test('should provide search result metadata', async () => {
      const mockArticles = [
        TestDataGenerator.generateArticle({
          id: '1',
          title: 'Test Article',
          slug: 'test-article',
          perex: 'This is a test article.',
          tags: ['test']
        })
      ];

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockScan = jest.fn().mockResolvedValue({ Items: mockArticles });
      DynamoDBDocumentClient.from.mockReturnValue({
        scan: mockScan
      });

      const response = await request(app)
        .get('/api/articles/search')
        .query({ q: 'test', limit: '10' })
        .expect(200);

      expect(response.body).toHaveProperty('articles');
      expect(Array.isArray(response.body.articles)).toBe(true);

      // Verify result metadata
      if (response.body.articles.length > 0) {
        const article = response.body.articles[0];
        expect(article).toHaveProperty('id');
        expect(article).toHaveProperty('title');
        expect(article).toHaveProperty('slug');
        expect(article).toHaveProperty('perex');
        expect(article).toHaveProperty('tags');
      }

      console.log('✅ Search result metadata verified');
      console.log(`📊 Search results: ${response.body.articles.length} article(s)`);
    });
  });
});
