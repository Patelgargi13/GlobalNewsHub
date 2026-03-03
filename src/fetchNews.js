const axios = require('axios');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const CATEGORY_QUERIES = {
  ai:         'artificial intelligence machine learning',
  business:   'business finance economy market',
  science:    'science discovery research breakthrough',
  politics:   'politics government election policy',
  technology: 'technology innovation startup gadgets',
  world:      'world news international global',
  nation:     'national news USA america'
};

async function fetchNews(category) {
  const query = CATEGORY_QUERIES[category] || category;

  try {
    const response = await axios.get('https://gnews.io/api/v4/search', {
      params: {
        q: query,
        lang: 'en',
        max: 5,
        sortby: 'publishedAt',
        apikey: process.env.GNEWS_API_KEY
      },
      timeout: 10000
    });

    const articles = response.data.articles || [];
    console.log(`✅ [${category}] Fetched ${articles.length} articles`);
    return articles;

  } catch (err) {
    console.error(`❌ [${category}] GNews Error:`, err.response?.data || err.message);
    return [];
  }
}

module.exports = { fetchNews };