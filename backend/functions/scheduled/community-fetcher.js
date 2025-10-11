const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { v4: uuidv4 } = require('uuid');
const redditClient = require('./reddit-api-client');

// Initialize AWS services
const dynamodbClient = new DynamoDBClient({ region: process.env.REGION || 'eu-central-1' });
const dynamodb = DynamoDBDocumentClient.from(dynamodbClient);

// Configuration
const REGION = process.env.REGION || 'eu-central-1';
const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const RAW_CONTENT_TABLE = process.env.DYNAMODB_RAW_CONTENT_TABLE || 'InfiniteRawContent-dev';

// Subreddits to monitor
const SUBREDDITS = ['space', 'astronomy', 'spaceporn', 'astrophotography'];
const POSTS_PER_SUBREDDIT = 10;
const MAX_AGE_HOURS = 24;
const MIN_UPVOTES = 100;

/**
 * Main Lambda handler for community content fetching
 */
exports.handler = async (event) => {
    console.log('Community Fetcher Lambda invoked:', JSON.stringify(event, null, 2));
    
    try {
        console.log('Starting community content fetching process...');
        
        // Get topics for article generation
        const selectedTopics = await selectTopicsForGeneration();
        
        if (selectedTopics.length === 0) {
            console.log('No suitable topics found for community article generation');
            return {
                statusCode: 200,
                body: JSON.stringify({
                    message: 'No suitable topics found',
                    topicsProcessed: 0
                })
            };
        }
        
        console.log(`Found ${selectedTopics.length} topics for processing`);
        
        // Process each selected topic
        const processedTopics = [];
        for (const topic of selectedTopics) {
            try {
                const processedTopic = await processTopic(topic);
                if (processedTopic) {
                    processedTopics.push(processedTopic);
                    console.log(`Successfully processed topic: ${topic.title}`);
                }
            } catch (error) {
                console.error(`Error processing topic ${topic.title}:`, error);
                // Continue with other topics even if one fails
            }
        }
        
        console.log(`Successfully processed ${processedTopics.length} topics`);
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Community content fetching completed',
                topicsProcessed: processedTopics.length,
                topics: processedTopics.map(t => ({
                    title: t.title,
                    source: t.source,
                    engagementScore: t.communityEngagement?.engagementScore
                }))
            })
        };
        
    } catch (error) {
        console.error('Community fetcher error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Community content fetching failed',
                message: error.message
            })
        };
    }
};

/**
 * Select topics for article generation from Reddit posts
 */
async function selectTopicsForGeneration() {
    try {
        console.log('Selecting topics for community article generation...');
        
        const allPosts = [];
        
        // Fetch posts from each subreddit
        for (const subreddit of SUBREDDITS) {
            try {
                console.log(`Fetching posts from r/${subreddit}...`);
                const posts = await redditClient.getSubredditPosts(subreddit, POSTS_PER_SUBREDDIT, 'day');
                
                // Add subreddit info to each post
                const postsWithSource = posts.map(post => ({
                    ...post,
                    subreddit: subreddit,
                    source: `reddit.com/r/${subreddit}`
                }));
                
                allPosts.push(...postsWithSource);
                console.log(`Retrieved ${posts.length} posts from r/${subreddit}`);
                
                // Add delay to respect rate limits
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.error(`Error fetching posts from r/${subreddit}:`, error);
                // Continue with other subreddits
            }
        }
        
        console.log(`Total posts retrieved: ${allPosts.length}`);
        
        // Filter posts for astronomy content
        const astronomyPosts = redditClient.filterAstronomyPosts(allPosts, MIN_UPVOTES, MAX_AGE_HOURS);
        
        // Calculate engagement scores and sort
        const postsWithEngagement = astronomyPosts.map(post => {
            const engagement = redditClient.calculateEngagementScore(post);
            return {
                ...post,
                communityEngagement: engagement
            };
        });
        
        // Sort by engagement score (highest first)
        const sortedPosts = postsWithEngagement.sort((a, b) => 
            (b.communityEngagement?.engagementScore || 0) - (a.communityEngagement?.engagementScore || 0)
        );
        
        // Select top 3 posts for article generation
        const selectedTopics = sortedPosts.slice(0, 3);
        
        console.log(`Selected ${selectedTopics.length} topics for article generation:`);
        selectedTopics.forEach((topic, index) => {
            console.log(`${index + 1}. ${topic.title} (Score: ${topic.communityEngagement?.engagementScore})`);
        });
        
        return selectedTopics;
        
    } catch (error) {
        console.error('Error selecting topics:', error);
        return [];
    }
}

/**
 * Process a single topic and save to DynamoDB
 */
async function processTopic(topic) {
    try {
        console.log(`Processing topic: ${topic.title}`);
        
        // Get comments for the post
        let comments = [];
        let discussionHighlights = [];
        
        try {
            comments = await redditClient.getPostComments(topic.id);
            const bestComments = redditClient.selectBestComments(comments, 5);
            discussionHighlights = bestComments.map(comment => 
                `"${comment.body}" - u/${comment.author} (${comment.score} upvotes)`
            );
            console.log(`Retrieved ${comments.length} comments, selected ${bestComments.length} highlights`);
        } catch (error) {
            console.error(`Error getting comments for post ${topic.id}:`, error);
            // Continue without comments
        }
        
        // Create content ID
        const contentId = `reddit-${topic.id}-${Date.now()}`;
        
        // Prepare content for AI processing
        const rawContent = {
            contentId: contentId,
            title: topic.title,
            content: topic.selftext || topic.title, // Use selftext if available, otherwise title
            excerpt: topic.selftext ? topic.selftext.substring(0, 500) + '...' : topic.title,
            score: topic.communityEngagement?.engagementScore || 0,
            comments: comments.length,
            source: topic.source,
            category: 'komunita',
            status: 'raw',
            url: `https://reddit.com${topic.permalink}`,
            date: new Date(topic.created_utc * 1000).toISOString().split('T')[0],
            
            // Community-specific fields
            communityEngagement: {
                upvotes: topic.communityEngagement?.upvotes || 0,
                comments: topic.communityEngagement?.comments || 0,
                awards: topic.communityEngagement?.awards || 0,
                engagementScore: topic.communityEngagement?.engagementScore || 0
            },
            
            selectedExcerpt: discussionHighlights.length > 0 ? discussionHighlights[0] : null,
            discussionHighlights: discussionHighlights,
            
            // Additional metadata
            subreddit: topic.subreddit,
            postId: topic.id,
            author: topic.author,
            created_utc: topic.created_utc,
            permalink: topic.permalink,
            
            // Processing metadata
            processedAt: new Date().toISOString(),
            processingVersion: '1.0'
        };
        
        // Save to DynamoDB
        await saveRawContent(rawContent);
        
        console.log(`Successfully saved raw content: ${contentId}`);
        return rawContent;
        
    } catch (error) {
        console.error(`Error processing topic ${topic.title}:`, error);
        throw error;
    }
}

/**
 * Save raw content to DynamoDB
 */
async function saveRawContent(rawContent) {
    try {
        const command = new PutCommand({
            TableName: RAW_CONTENT_TABLE,
            Item: {
                ...rawContent,
                id: rawContent.contentId, // Use contentId as primary key
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        });
        
        await dynamodb.send(command);
        console.log(`Raw content saved to DynamoDB: ${rawContent.contentId}`);
        
    } catch (error) {
        console.error('Error saving raw content to DynamoDB:', error);
        throw error;
    }
}

/**
 * Test function for local development
 */
async function testCommunityFetcher() {
    console.log('Testing Community Fetcher...');
    
    try {
        const result = await exports.handler({});
        console.log('Test result:', JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Test error:', error);
    }
}

// Export for testing
module.exports.testCommunityFetcher = testCommunityFetcher;
