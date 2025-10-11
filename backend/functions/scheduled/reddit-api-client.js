const axios = require('axios');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

// Initialize AWS services
const secretsManager = new SecretsManagerClient({ region: process.env.REGION || 'eu-central-1' });

// Reddit API configuration
const REDDIT_API_BASE = 'https://oauth.reddit.com';
const REDDIT_AUTH_URL = 'https://www.reddit.com/api/v1/access_token';

// Cache for access token
let accessToken = null;
let tokenExpiry = null;

/**
 * Get Reddit API credentials from AWS Secrets Manager
 */
async function getRedditCredentials() {
    try {
        const secretName = `infinite-reddit-api-credentials-${process.env.ENVIRONMENT || 'dev'}`;
        console.log(`Getting Reddit credentials from secret: ${secretName}`);
        
        const command = new GetSecretValueCommand({ SecretId: secretName });
        const response = await secretsManager.send(command);
        
        if (!response.SecretString) {
            throw new Error('No secret string found in Reddit credentials');
        }
        
        const credentials = JSON.parse(response.SecretString);
        
        if (!credentials.REDDIT_CLIENT_ID || !credentials.REDDIT_CLIENT_SECRET || !credentials.REDDIT_USER_AGENT) {
            throw new Error('Missing required Reddit credentials: REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, or REDDIT_USER_AGENT');
        }
        
        return credentials;
    } catch (error) {
        console.error('Error getting Reddit credentials:', error);
        throw new Error(`Failed to get Reddit credentials: ${error.message}`);
    }
}

/**
 * Authenticate with Reddit API and get access token
 */
async function authenticateReddit() {
    try {
        // Check if we have a valid cached token
        if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
            console.log('Using cached Reddit access token');
            return accessToken;
        }
        
        console.log('Authenticating with Reddit API...');
        const credentials = await getRedditCredentials();
        
        const authData = new URLSearchParams({
            grant_type: 'client_credentials',
            device_id: 'infinite-community-fetcher'
        });
        
        const response = await axios.post(REDDIT_AUTH_URL, authData, {
            headers: {
                'Authorization': `Basic ${Buffer.from(`${credentials.REDDIT_CLIENT_ID}:${credentials.REDDIT_CLIENT_SECRET}`).toString('base64')}`,
                'User-Agent': credentials.REDDIT_USER_AGENT,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            timeout: 10000
        });
        
        if (response.data && response.data.access_token) {
            accessToken = response.data.access_token;
            // Cache token for 50 minutes (tokens expire in 1 hour)
            tokenExpiry = Date.now() + (50 * 60 * 1000);
            console.log('Successfully authenticated with Reddit API');
            return accessToken;
        } else {
            throw new Error('No access token received from Reddit API');
        }
    } catch (error) {
        console.error('Reddit authentication error:', error.response?.data || error.message);
        throw new Error(`Reddit authentication failed: ${error.message}`);
    }
}

/**
 * Get top posts from a subreddit
 */
async function getSubredditPosts(subreddit, limit = 25, timeFilter = 'day') {
    try {
        const token = await authenticateReddit();
        const credentials = await getRedditCredentials();
        
        console.log(`Fetching top posts from r/${subreddit} (limit: ${limit}, time: ${timeFilter})`);
        
        const url = `${REDDIT_API_BASE}/r/${subreddit}/top.json`;
        const params = {
            limit: limit,
            t: timeFilter, // hour, day, week, month, year, all
            raw_json: 1
        };
        
        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'User-Agent': credentials.REDDIT_USER_AGENT
            },
            params: params,
            timeout: 15000
        });
        
        if (response.data && response.data.data && response.data.data.children) {
            const posts = response.data.data.children.map(child => child.data);
            console.log(`Retrieved ${posts.length} posts from r/${subreddit}`);
            return posts;
        } else {
            throw new Error('Invalid response format from Reddit API');
        }
    } catch (error) {
        console.error(`Error fetching posts from r/${subreddit}:`, error.response?.data || error.message);
        throw new Error(`Failed to fetch posts from r/${subreddit}: ${error.message}`);
    }
}

/**
 * Get comments for a specific post
 */
async function getPostComments(postId) {
    try {
        const token = await authenticateReddit();
        const credentials = await getRedditCredentials();
        
        console.log(`Fetching comments for post: ${postId}`);
        
        const url = `${REDDIT_API_BASE}/comments/${postId}.json`;
        const params = {
            limit: 100,
            depth: 2,
            raw_json: 1
        };
        
        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'User-Agent': credentials.REDDIT_USER_AGENT
            },
            params: params,
            timeout: 15000
        });
        
        if (response.data && Array.isArray(response.data) && response.data.length > 1) {
            // Reddit returns [post, comments] array
            const commentsData = response.data[1];
            if (commentsData && commentsData.data && commentsData.data.children) {
                const comments = commentsData.data.children.map(child => child.data);
                console.log(`Retrieved ${comments.length} comments for post ${postId}`);
                return comments;
            }
        }
        
        console.log(`No comments found for post ${postId}`);
        return [];
    } catch (error) {
        console.error(`Error fetching comments for post ${postId}:`, error.response?.data || error.message);
        // Don't throw error for comments - posts can exist without comments
        return [];
    }
}

/**
 * Select best comments based on score and quality
 */
function selectBestComments(comments, count = 5) {
    try {
        // Filter out deleted/removed comments and low-quality ones
        const validComments = comments.filter(comment => 
            comment && 
            comment.body && 
            comment.body !== '[deleted]' && 
            comment.body !== '[removed]' &&
            comment.body.length > 20 && // Minimum length
            comment.score > 0 && // Positive score
            !comment.body.includes('http') // Avoid spam links
        );
        
        // Sort by score (upvotes) and select top comments
        const sortedComments = validComments
            .sort((a, b) => (b.score || 0) - (a.score || 0))
            .slice(0, count);
        
        // Format comments for display
        const formattedComments = sortedComments.map(comment => ({
            body: comment.body,
            score: comment.score || 0,
            author: comment.author || 'Anonymous',
            created_utc: comment.created_utc,
            permalink: comment.permalink ? `https://reddit.com${comment.permalink}` : null
        }));
        
        console.log(`Selected ${formattedComments.length} best comments from ${comments.length} total`);
        return formattedComments;
    } catch (error) {
        console.error('Error selecting best comments:', error);
        return [];
    }
}

/**
 * Calculate engagement score for a post
 */
function calculateEngagementScore(post) {
    try {
        const upvotes = post.ups || 0;
        const comments = post.num_comments || 0;
        const awards = post.total_awards_received || 0;
        
        // Weighted engagement score: upvotes (70%) + comments (30%)
        const engagementScore = (upvotes * 0.7) + (comments * 0.3);
        
        return {
            upvotes,
            comments,
            awards,
            engagementScore: Math.round(engagementScore)
        };
    } catch (error) {
        console.error('Error calculating engagement score:', error);
        return {
            upvotes: 0,
            comments: 0,
            awards: 0,
            engagementScore: 0
        };
    }
}

/**
 * Filter posts based on astronomy keywords and engagement
 */
function filterAstronomyPosts(posts, minUpvotes = 100, maxAgeHours = 24) {
    try {
        const astronomyKeywords = [
            'space', 'planet', 'star', 'galaxy', 'telescope', 'nasa', 'esa', 'mars', 'moon',
            'astronomy', 'astronaut', 'satellite', 'orbit', 'solar', 'cosmic', 'nebula',
            'supernova', 'black hole', 'asteroid', 'comet', 'meteor', 'constellation',
            'hubble', 'james webb', 'iss', 'spacex', 'rocket', 'launch', 'mission'
        ];
        
        const now = Date.now() / 1000; // Current time in seconds
        const maxAge = maxAgeHours * 3600; // Convert hours to seconds
        
        const filteredPosts = posts.filter(post => {
            // Check age (must be within maxAgeHours)
            const postAge = now - post.created_utc;
            if (postAge > maxAge) {
                return false;
            }
            
            // Check minimum upvotes
            if ((post.ups || 0) < minUpvotes) {
                return false;
            }
            
            // Check for astronomy keywords in title or selftext
            const text = `${post.title || ''} ${post.selftext || ''}`.toLowerCase();
            const hasAstronomyKeyword = astronomyKeywords.some(keyword => 
                text.includes(keyword.toLowerCase())
            );
            
            return hasAstronomyKeyword;
        });
        
        console.log(`Filtered ${filteredPosts.length} astronomy posts from ${posts.length} total posts`);
        return filteredPosts;
    } catch (error) {
        console.error('Error filtering astronomy posts:', error);
        return [];
    }
}

module.exports = {
    authenticateReddit,
    getSubredditPosts,
    getPostComments,
    selectBestComments,
    calculateEngagementScore,
    filterAstronomyPosts
};
