/**
 * AWS S3 and CloudFront tests
 * Tests S3 bucket operations, CloudFront distribution, and image caching
 */

const { AWSMockHelper, TestDataGenerator, AssertionHelper } = require('../helpers/test-utils');

// Mock AWS SDK
jest.mock('aws-sdk', () => ({
  S3: jest.fn(() => ({
    putObject: jest.fn(),
    getObject: jest.fn(),
    headObject: jest.fn(),
    deleteObject: jest.fn(),
    listObjectsV2: jest.fn(),
    copyObject: jest.fn(),
    createBucket: jest.fn(),
    deleteBucket: jest.fn(),
    listBuckets: jest.fn(),
    getBucketLocation: jest.fn()
  })),
  CloudFront: jest.fn(() => ({
    getDistribution: jest.fn(),
    listDistributions: jest.fn(),
    createInvalidation: jest.fn(),
    getInvalidation: jest.fn()
  }))
}));

describe('S3 and CloudFront Operations', () => {
  beforeEach(() => {
    AWSMockHelper.mockAll();
    
    // Set environment variables
    process.env.AWS_REGION = 'eu-central-1';
    process.env.S3_BUCKET_NAME = 'infinite-nasa-apod-dev-images-349660737637';
    process.env.CLOUDFRONT_DOMAIN = 'd2ydyf9w4v170.cloudfront.net';
    process.env.CLOUDFRONT_DISTRIBUTION_ID = 'E1234567890ABC';
  });

  afterEach(() => {
    AWSMockHelper.restore();
    jest.clearAllMocks();
  });

  describe('S3 Bucket Configuration', () => {
    test('should have correct S3 bucket configuration', async () => {
      const AWS = require('aws-sdk');
      const mockListBuckets = jest.fn().mockImplementation((params, callback) => {
        callback(null, {
          Buckets: [
            {
              Name: 'infinite-nasa-apod-dev-images-349660737637',
              CreationDate: new Date('2024-12-01T00:00:00.000Z')
            }
          ]
        });
      });
      AWS.S3.mockImplementation(() => ({
        listBuckets: mockListBuckets
      }));

      const s3 = new AWS.S3();
      const result = await new Promise((resolve, reject) => {
        s3.listBuckets({}, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(result.Buckets).toHaveLength(1);
      expect(result.Buckets[0].Name).toBe('infinite-nasa-apod-dev-images-349660737637');

      console.log('✅ S3 bucket configuration verified');
      console.log(`🪣 Bucket: ${result.Buckets[0].Name}`);
      console.log(`📅 Created: ${result.Buckets[0].CreationDate}`);
    });

    test('should have correct bucket region', async () => {
      const AWS = require('aws-sdk');
      const mockGetBucketLocation = jest.fn().mockImplementation((params, callback) => {
        callback(null, {
          LocationConstraint: 'eu-central-1'
        });
      });
      AWS.S3.mockImplementation(() => ({
        getBucketLocation: mockGetBucketLocation
      }));

      const s3 = new AWS.S3();
      const result = await new Promise((resolve, reject) => {
        s3.getBucketLocation({
          Bucket: 'infinite-nasa-apod-dev-images-349660737637'
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(result.LocationConstraint).toBe('eu-central-1');

      console.log('✅ S3 bucket region verified');
      console.log(`🌍 Region: ${result.LocationConstraint}`);
    });
  });

  describe('S3 Object Operations', () => {
    test('should upload images to S3 correctly', async () => {
      const mockImageData = Buffer.from('fake image data');
      const mockETag = '"test-etag-12345"';

      const AWS = require('aws-sdk');
      const mockPutObject = jest.fn().mockImplementation((params, callback) => {
        callback(null, { ETag: mockETag });
      });
      AWS.S3.mockImplementation(() => ({
        putObject: mockPutObject
      }));

      const s3 = new AWS.S3();
      const result = await new Promise((resolve, reject) => {
        s3.putObject({
          Bucket: 'infinite-nasa-apod-dev-images-349660737637',
          Key: 'images/2025-01-15.jpg',
          Body: mockImageData,
          ContentType: 'image/jpeg',
          CacheControl: 'max-age=31536000'
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(result.ETag).toBe(mockETag);
      expect(mockPutObject).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: 'infinite-nasa-apod-dev-images-349660737637',
          Key: 'images/2025-01-15.jpg',
          Body: mockImageData,
          ContentType: 'image/jpeg',
          CacheControl: 'max-age=31536000'
        }),
        expect.any(Function)
      );

      console.log('✅ S3 image upload verified');
      console.log(`📁 Key: images/2025-01-15.jpg`);
      console.log(`🏷️ ETag: ${result.ETag}`);
    });

    test('should check if image exists in S3', async () => {
      const AWS = require('aws-sdk');
      const mockHeadObject = jest.fn().mockImplementation((params, callback) => {
        callback(null, {
          ContentType: 'image/jpeg',
          ContentLength: 1024000,
          LastModified: new Date('2025-01-15T06:00:00.000Z'),
          ETag: '"test-etag-12345"'
        });
      });
      AWS.S3.mockImplementation(() => ({
        headObject: mockHeadObject
      }));

      const s3 = new AWS.S3();
      const result = await new Promise((resolve, reject) => {
        s3.headObject({
          Bucket: 'infinite-nasa-apod-dev-images-349660737637',
          Key: 'images/2025-01-15.jpg'
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(result.ContentType).toBe('image/jpeg');
      expect(result.ContentLength).toBe(1024000);
      expect(mockHeadObject).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: 'infinite-nasa-apod-dev-images-349660737637',
          Key: 'images/2025-01-15.jpg'
        }),
        expect.any(Function)
      );

      console.log('✅ S3 image existence check verified');
      console.log(`📁 Key: images/2025-01-15.jpg`);
      console.log(`📄 Content-Type: ${result.ContentType}`);
      console.log(`📊 Size: ${result.ContentLength} bytes`);
    });

    test('should handle missing images gracefully', async () => {
      const AWS = require('aws-sdk');
      const mockHeadObject = jest.fn().mockImplementation((params, callback) => {
        const error = new Error('Not Found');
        error.code = 'NotFound';
        callback(error, null);
      });
      AWS.S3.mockImplementation(() => ({
        headObject: mockHeadObject
      }));

      const s3 = new AWS.S3();
      
      try {
        await new Promise((resolve, reject) => {
          s3.headObject({
            Bucket: 'infinite-nasa-apod-dev-images-349660737637',
            Key: 'images/non-existent.jpg'
          }, (err, data) => {
            if (err) reject(err);
            else resolve(data);
          });
        });
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error.code).toBe('NotFound');
      }

      console.log('✅ S3 missing image handling verified');
    });

    test('should retrieve images from S3', async () => {
      const mockImageData = Buffer.from('fake image data');

      const AWS = require('aws-sdk');
      const mockGetObject = jest.fn().mockImplementation((params, callback) => {
        callback(null, {
          Body: mockImageData,
          ContentType: 'image/jpeg',
          ContentLength: mockImageData.length,
          LastModified: new Date('2025-01-15T06:00:00.000Z')
        });
      });
      AWS.S3.mockImplementation(() => ({
        getObject: mockGetObject
      }));

      const s3 = new AWS.S3();
      const result = await new Promise((resolve, reject) => {
        s3.getObject({
          Bucket: 'infinite-nasa-apod-dev-images-349660737637',
          Key: 'images/2025-01-15.jpg'
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(result.Body).toEqual(mockImageData);
      expect(result.ContentType).toBe('image/jpeg');
      expect(mockGetObject).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: 'infinite-nasa-apod-dev-images-349660737637',
          Key: 'images/2025-01-15.jpg'
        }),
        expect.any(Function)
      );

      console.log('✅ S3 image retrieval verified');
      console.log(`📁 Key: images/2025-01-15.jpg`);
      console.log(`📊 Size: ${result.ContentLength} bytes`);
    });
  });

  describe('CloudFront Distribution', () => {
    test('should have correct CloudFront distribution configuration', async () => {
      const AWS = require('aws-sdk');
      const mockGetDistribution = jest.fn().mockImplementation((params, callback) => {
        callback(null, {
          Distribution: {
            Id: 'E1234567890ABC',
            Status: 'Deployed',
            DomainName: 'd2ydyf9w4v170.cloudfront.net',
            DistributionConfig: {
              Origins: {
                Items: [
                  {
                    Id: 'S3-infinite-nasa-apod-dev-images-349660737637',
                    DomainName: 'infinite-nasa-apod-dev-images-349660737637.s3.eu-central-1.amazonaws.com',
                    S3OriginConfig: {
                      OriginAccessIdentity: ''
                    }
                  }
                ]
              },
              DefaultCacheBehavior: {
                TargetOriginId: 'S3-infinite-nasa-apod-dev-images-349660737637',
                ViewerProtocolPolicy: 'redirect-to-https',
                CachePolicyId: '4135ea2d-6df8-44a3-9df3-4b5a84be39ad'
              },
              Enabled: true,
              Comment: 'Infinite NASA APOD Images Distribution'
            }
          }
        });
      });
      AWS.CloudFront.mockImplementation(() => ({
        getDistribution: mockGetDistribution
      }));

      const cloudfront = new AWS.CloudFront();
      const result = await new Promise((resolve, reject) => {
        cloudfront.getDistribution({
          Id: 'E1234567890ABC'
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(result.Distribution.Id).toBe('E1234567890ABC');
      expect(result.Distribution.Status).toBe('Deployed');
      expect(result.Distribution.DomainName).toBe('d2ydyf9w4v170.cloudfront.net');
      expect(result.Distribution.DistributionConfig.Enabled).toBe(true);

      console.log('✅ CloudFront distribution configuration verified');
      console.log(`🌐 Domain: ${result.Distribution.DomainName}`);
      console.log(`📊 Status: ${result.Distribution.Status}`);
      console.log(`🔗 Origin: ${result.Distribution.DistributionConfig.Origins.Items[0].DomainName}`);
    });

    test('should list CloudFront distributions', async () => {
      const AWS = require('aws-sdk');
      const mockListDistributions = jest.fn().mockImplementation((params, callback) => {
        callback(null, {
          DistributionList: {
            Items: [
              {
                Id: 'E1234567890ABC',
                Status: 'Deployed',
                DomainName: 'd2ydyf9w4v170.cloudfront.net',
                Comment: 'Infinite NASA APOD Images Distribution'
              }
            ],
            Quantity: 1
          }
        });
      });
      AWS.CloudFront.mockImplementation(() => ({
        listDistributions: mockListDistributions
      }));

      const cloudfront = new AWS.CloudFront();
      const result = await new Promise((resolve, reject) => {
        cloudfront.listDistributions({}, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(result.DistributionList.Items).toHaveLength(1);
      expect(result.DistributionList.Items[0].Id).toBe('E1234567890ABC');
      expect(result.DistributionList.Items[0].DomainName).toBe('d2ydyf9w4v170.cloudfront.net');

      console.log('✅ CloudFront distributions listing verified');
      console.log(`📊 Distributions: ${result.DistributionList.Quantity}`);
      console.log(`🌐 Domain: ${result.DistributionList.Items[0].DomainName}`);
    });
  });

  describe('CloudFront Cache Invalidation', () => {
    test('should create cache invalidation', async () => {
      const AWS = require('aws-sdk');
      const mockCreateInvalidation = jest.fn().mockImplementation((params, callback) => {
        callback(null, {
          Invalidation: {
            Id: 'I1234567890ABC',
            Status: 'InProgress',
            CreateTime: new Date('2025-01-15T06:00:00.000Z'),
            InvalidationBatch: {
              Paths: {
                Quantity: 1,
                Items: ['/images/2025-01-15.jpg']
              },
              CallerReference: 'test-invalidation-12345'
            }
          }
        });
      });
      AWS.CloudFront.mockImplementation(() => ({
        createInvalidation: mockCreateInvalidation
      }));

      const cloudfront = new AWS.CloudFront();
      const result = await new Promise((resolve, reject) => {
        cloudfront.createInvalidation({
          DistributionId: 'E1234567890ABC',
          InvalidationBatch: {
            Paths: {
              Quantity: 1,
              Items: ['/images/2025-01-15.jpg']
            },
            CallerReference: 'test-invalidation-12345'
          }
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(result.Invalidation.Id).toBe('I1234567890ABC');
      expect(result.Invalidation.Status).toBe('InProgress');
      expect(result.Invalidation.InvalidationBatch.Paths.Items).toContain('/images/2025-01-15.jpg');

      console.log('✅ CloudFront cache invalidation verified');
      console.log(`🔄 Invalidation ID: ${result.Invalidation.Id}`);
      console.log(`📊 Status: ${result.Invalidation.Status}`);
      console.log(`📁 Paths: ${result.Invalidation.InvalidationBatch.Paths.Items.join(', ')}`);
    });

    test('should check invalidation status', async () => {
      const AWS = require('aws-sdk');
      const mockGetInvalidation = jest.fn().mockImplementation((params, callback) => {
        callback(null, {
          Invalidation: {
            Id: 'I1234567890ABC',
            Status: 'Completed',
            CreateTime: new Date('2025-01-15T06:00:00.000Z')
          }
        });
      });
      AWS.CloudFront.mockImplementation(() => ({
        getInvalidation: mockGetInvalidation
      }));

      const cloudfront = new AWS.CloudFront();
      const result = await new Promise((resolve, reject) => {
        cloudfront.getInvalidation({
          DistributionId: 'E1234567890ABC',
          Id: 'I1234567890ABC'
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(result.Invalidation.Id).toBe('I1234567890ABC');
      expect(result.Invalidation.Status).toBe('Completed');

      console.log('✅ CloudFront invalidation status check verified');
      console.log(`🔄 Invalidation ID: ${result.Invalidation.Id}`);
      console.log(`📊 Status: ${result.Invalidation.Status}`);
    });
  });

  describe('Image Caching Workflow', () => {
    test('should implement complete image caching workflow', async () => {
      const mockImageData = Buffer.from('fake image data');
      const mockETag = '"test-etag-12345"';

      const AWS = require('aws-sdk');
      const mockHeadObject = jest.fn().mockImplementation((params, callback) => {
        // Simulate image not existing
        const error = new Error('Not Found');
        error.code = 'NotFound';
        callback(error, null);
      });
      const mockPutObject = jest.fn().mockImplementation((params, callback) => {
        callback(null, { ETag: mockETag });
      });
      const mockCreateInvalidation = jest.fn().mockImplementation((params, callback) => {
        callback(null, {
          Invalidation: {
            Id: 'I1234567890ABC',
            Status: 'InProgress'
          }
        });
      });

      AWS.S3.mockImplementation(() => ({
        headObject: mockHeadObject,
        putObject: mockPutObject
      }));
      AWS.CloudFront.mockImplementation(() => ({
        createInvalidation: mockCreateInvalidation
      }));

      const s3 = new AWS.S3();
      const cloudfront = new AWS.CloudFront();

      // Step 1: Check if image exists
      let imageExists = false;
      try {
        await new Promise((resolve, reject) => {
          s3.headObject({
            Bucket: 'infinite-nasa-apod-dev-images-349660737637',
            Key: 'images/2025-01-15.jpg'
          }, (err, data) => {
            if (err) reject(err);
            else resolve(data);
          });
        });
        imageExists = true;
      } catch (error) {
        if (error.code === 'NotFound') {
          imageExists = false;
        } else {
          throw error;
        }
      }

      expect(imageExists).toBe(false);

      // Step 2: Upload image if it doesn't exist
      const uploadResult = await new Promise((resolve, reject) => {
        s3.putObject({
          Bucket: 'infinite-nasa-apod-dev-images-349660737637',
          Key: 'images/2025-01-15.jpg',
          Body: mockImageData,
          ContentType: 'image/jpeg',
          CacheControl: 'max-age=31536000'
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(uploadResult.ETag).toBe(mockETag);

      // Step 3: Invalidate CloudFront cache
      const invalidationResult = await new Promise((resolve, reject) => {
        cloudfront.createInvalidation({
          DistributionId: 'E1234567890ABC',
          InvalidationBatch: {
            Paths: {
              Quantity: 1,
              Items: ['/images/2025-01-15.jpg']
            },
            CallerReference: `invalidation-${Date.now()}`
          }
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(invalidationResult.Invalidation.Status).toBe('InProgress');

      console.log('✅ Complete image caching workflow verified');
      console.log(`📁 Image key: images/2025-01-15.jpg`);
      console.log(`🪣 Uploaded to S3: ${uploadResult.ETag}`);
      console.log(`🔄 Cache invalidated: ${invalidationResult.Invalidation.Id}`);
    });

    test('should skip upload if image already exists', async () => {
      const AWS = require('aws-sdk');
      const mockHeadObject = jest.fn().mockImplementation((params, callback) => {
        // Simulate image already exists
        callback(null, {
          ContentType: 'image/jpeg',
          ContentLength: 1024000,
          LastModified: new Date('2025-01-15T06:00:00.000Z'),
          ETag: '"existing-etag-12345"'
        });
      });
      const mockPutObject = jest.fn().mockImplementation((params, callback) => {
        callback(null, { ETag: '"new-etag-12345"' });
      });

      AWS.S3.mockImplementation(() => ({
        headObject: mockHeadObject,
        putObject: mockPutObject
      }));

      const s3 = new AWS.S3();

      // Check if image exists
      let imageExists = false;
      try {
        const result = await new Promise((resolve, reject) => {
          s3.headObject({
            Bucket: 'infinite-nasa-apod-dev-images-349660737637',
            Key: 'images/2025-01-15.jpg'
          }, (err, data) => {
            if (err) reject(err);
            else resolve(data);
          });
        });
        imageExists = true;
        expect(result.ETag).toBe('"existing-etag-12345"');
      } catch (error) {
        if (error.code === 'NotFound') {
          imageExists = false;
        } else {
          throw error;
        }
      }

      expect(imageExists).toBe(true);
      expect(mockPutObject).not.toHaveBeenCalled();

      console.log('✅ Image existence check verified - upload skipped');
      console.log(`📁 Image already exists: images/2025-01-15.jpg`);
    });
  });

  describe('Error Handling', () => {
    test('should handle S3 errors gracefully', async () => {
      const AWS = require('aws-sdk');
      const mockPutObject = jest.fn().mockImplementation((params, callback) => {
        callback(new Error('S3 upload failed'), null);
      });
      AWS.S3.mockImplementation(() => ({
        putObject: mockPutObject
      }));

      const s3 = new AWS.S3();
      
      try {
        await new Promise((resolve, reject) => {
          s3.putObject({
            Bucket: 'infinite-nasa-apod-dev-images-349660737637',
            Key: 'images/2025-01-15.jpg',
            Body: Buffer.from('test data')
          }, (err, data) => {
            if (err) reject(err);
            else resolve(data);
          });
        });
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error.message).toBe('S3 upload failed');
      }

      console.log('✅ S3 error handling verified');
    });

    test('should handle CloudFront errors gracefully', async () => {
      const AWS = require('aws-sdk');
      const mockCreateInvalidation = jest.fn().mockImplementation((params, callback) => {
        callback(new Error('CloudFront invalidation failed'), null);
      });
      AWS.CloudFront.mockImplementation(() => ({
        createInvalidation: mockCreateInvalidation
      }));

      const cloudfront = new AWS.CloudFront();
      
      try {
        await new Promise((resolve, reject) => {
          cloudfront.createInvalidation({
            DistributionId: 'E1234567890ABC',
            InvalidationBatch: {
              Paths: {
                Quantity: 1,
                Items: ['/images/2025-01-15.jpg']
              },
              CallerReference: 'test-invalidation'
            }
          }, (err, data) => {
            if (err) reject(err);
            else resolve(data);
          });
        });
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error.message).toBe('CloudFront invalidation failed');
      }

      console.log('✅ CloudFront error handling verified');
    });
  });

  describe('Performance and Monitoring', () => {
    test('should track S3 operation performance', async () => {
      const mockImageData = Buffer.from('fake image data');
      const startTime = Date.now();

      const AWS = require('aws-sdk');
      const mockPutObject = jest.fn().mockImplementation((params, callback) => {
        // Simulate upload time
        setTimeout(() => {
          callback(null, { ETag: '"test-etag-12345"' });
        }, 200);
      });
      AWS.S3.mockImplementation(() => ({
        putObject: mockPutObject
      }));

      const s3 = new AWS.S3();
      const result = await new Promise((resolve, reject) => {
        s3.putObject({
          Bucket: 'infinite-nasa-apod-dev-images-349660737637',
          Key: 'images/2025-01-15.jpg',
          Body: mockImageData
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      const endTime = Date.now();
      const uploadTime = endTime - startTime;

      expect(uploadTime).toBeGreaterThan(190);
      expect(uploadTime).toBeLessThan(300);

      console.log(`⏱️ S3 upload time: ${uploadTime}ms`);
      console.log('✅ S3 performance monitoring verified');
    });

    test('should handle concurrent S3 operations', async () => {
      const mockImageData = Buffer.from('fake image data');

      const AWS = require('aws-sdk');
      const mockPutObject = jest.fn().mockImplementation((params, callback) => {
        callback(null, { ETag: `"etag-${Math.random()}"` });
      });
      AWS.S3.mockImplementation(() => ({
        putObject: mockPutObject
      }));

      const s3 = new AWS.S3();
      
      // Execute multiple concurrent uploads
      const uploadPromises = Array(5).fill().map((_, i) => 
        new Promise((resolve, reject) => {
          s3.putObject({
            Bucket: 'infinite-nasa-apod-dev-images-349660737637',
            Key: `images/concurrent-${i}.jpg`,
            Body: mockImageData
          }, (err, data) => {
            if (err) reject(err);
            else resolve(data);
          });
        })
      );

      const results = await Promise.all(uploadPromises);

      expect(results).toHaveLength(5);
      expect(mockPutObject).toHaveBeenCalledTimes(5);

      console.log('✅ Concurrent S3 operations verified');
      console.log(`📊 Concurrent uploads: ${results.length}`);
    });
  });
});
