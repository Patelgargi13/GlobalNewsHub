const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { fetchNews } = require('./src/fetchNews');
const { generateBlog } = require('./src/generateBlog');
const { loadPosts, publishPost } = require('./src/publishBlog');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const CATEGORIES = ['ai', 'technology', 'business', 'science', 'politics', 'world'];

const REGION_COUNTRIES = {
  worldwide: '',
  us: 'us',
  uk: 'gb',
  india: 'in',
  europe: 'de',
  china: 'cn',
  japan: 'jp',
  australia: 'au',
  canada: 'ca',
  brazil: 'br'
};

function sleep(ms) {
  return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

async function runAgent() {
  console.log('Agent running at ' + new Date().toLocaleTimeString());

  for (var i = 0; i < CATEGORIES.length; i++) {
    var category = CATEGORIES[i];
    console.log('Processing category: ' + category);

    var articles = await fetchNews(category, '');

    if (!articles.length) {
      console.log('No articles for: ' + category);
      continue;
    }

    var article = articles[0];
    console.log('Generating blog for: ' + article.title);

    var blogContent = await generateBlog(
      article.title,
      article.description || '',
      category
    );

    if (!blogContent) {
      console.log('Blog generation failed for: ' + category);
      continue;
    }

    publishPost(category, article, blogContent);
    await sleep(2000);
  }

  console.log('Agent finished.');
}

// Get all saved posts
app.get('/api/posts', function(req, res) {
  res.json(loadPosts());
});

// Get saved posts by category
app.get('/api/posts/:category', function(req, res) {
  var posts = loadPosts();
  res.json(posts[req.params.category] || []);
});

// LIVE region + category filtered news — THIS is what powers the region buttons
app.get('/api/news/:region/:category', async function(req, res) {
  var region = req.params.region;
  var category = req.params.category;
  var country = REGION_COUNTRIES[region];
  if (country === undefined) country = '';

  console.log('Live fetch: region=' + region + ' category=' + category + ' country=' + country);

  try {
    var articles = await fetchNews(category, country);
    res.json(articles);
  } catch (err) {
    console.error('Route error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Category summary
app.get('/api/categories', function(req, res) {
  var posts = loadPosts();
  var summary = {};
  var keys = Object.keys(posts);
  for (var i = 0; i < keys.length; i++) {
    var cat = keys[i];
    summary[cat] = { count: posts[cat].length, latest: posts[cat][0] || null };
  }
  res.json(summary);
});

// Manual refresh
app.post('/api/refresh', async function(req, res) {
  res.json({ message: 'Agent refresh started!' });
  runAgent().catch(console.error);
});

cron.schedule('*/10 * * * *', function() {
  console.log('Cron triggered');
  runAgent().catch(console.error);
});

var PORT = process.env.PORT || 3000;
app.listen(PORT, async function() {
  console.log('Server: http://localhost:' + PORT);
  console.log('API:    http://localhost:' + PORT + '/api/posts');
  await runAgent();
});