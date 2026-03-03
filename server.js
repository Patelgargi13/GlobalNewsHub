const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const path = require('path');
require('dotenv').config();

const { loadPosts, publishPost } = require('./src/publishBlog');
const { fetchNews } = require('./src/fetchNews');
const { generateBlog } = require('./src/generateBlog');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const CATEGORIES = ['ai', 'business', 'science', 'politics', 'technology', 'world'];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runAgent() {
  console.log('\n Agent running at ' + new Date().toLocaleTimeString());

  for (const category of CATEGORIES) {
    console.log('\n Processing category: ' + category);

    const articles = await fetchNews(category);

    if (!articles.length) {
      console.log('No articles for: ' + category);
      continue;
    }

    const article = articles[0];
    console.log('Generating blog for: ' + article.title);

    const blogContent = await generateBlog(
      article.title,
      article.description || '',
      category
    );

    publishPost(category, article, blogContent);

    await sleep(2000);
  }

  console.log('\n Agent finished.\n');
}

app.get('/api/posts', (req, res) => {
  res.json(loadPosts());
});

app.get('/api/posts/:category', (req, res) => {
  const { category } = req.params;
  const posts = loadPosts();
  res.json(posts[category] || []);
});

app.get('/api/categories', (req, res) => {
  const posts = loadPosts();
  const summary = {};
  for (const [cat, catPosts] of Object.entries(posts)) {
    summary[cat] = {
      count: catPosts.length,
      latest: catPosts[0] || null
    };
  }
  res.json(summary);
});

app.post('/api/refresh', async (req, res) => {
  res.json({ message: 'Agent refresh started!' });
  runAgent().catch(console.error);
});

cron.schedule('*/10 * * * *', () => {
  console.log('Cron triggered');
  runAgent().catch(console.error);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log('\nServer: http://localhost:' + PORT);
  console.log('API: http://localhost:' + PORT + '/api/posts\n');
  await runAgent();
});