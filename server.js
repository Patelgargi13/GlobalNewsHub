const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
require('dotenv').config();

const { fetchNews } = require('./src/fetchNews');
const generateBlog = require('./src/generateBlog');
const publishBlog  = require('./src/publishBlog');

// loadPosts reads blog/posts.json — matches publishBlog.js path
function loadPosts() {
  var fp = require('path').join(__dirname, 'blog/posts.json');
  if (!fs.existsSync(fp)) return {};
  try { return JSON.parse(fs.readFileSync(fp, 'utf-8')); } catch(e) { return {}; }
}

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const CATEGORIES = ['ai', 'technology', 'business', 'science', 'politics', 'world'];

const REGION_COUNTRIES = {
  worldwide: '', us: 'us', uk: 'gb', india: 'in', europe: 'de',
  china: 'cn', japan: 'jp', australia: 'au', canada: 'ca', brazil: 'br'
};


// ── BACKGROUND PRE-FETCH ─────────────────────────────────
// Warms the cache every 5 min so page loads are instant.
// Fetches all regions × categories silently in background.
const ALL_PREFETCH_REGIONS   = ['worldwide','us','uk','india','europe','china','japan','australia','canada','brazil'];
const ALL_PREFETCH_CATEGORIES = ['ai','technology','business','science','politics','world'];

var prefetchStatus = {
  lastRun: null,
  running: false,
  warmed: false,       // true after first full prefetch completes
  errors: 0
};

async function prefetchOne(region, category) {
  try {
    await fetchNews(category, region, 1, 10);
  } catch(e) {
    prefetchStatus.errors++;
  }
}

async function runPrefetch() {
  if (prefetchStatus.running) return;
  prefetchStatus.running = true;
  prefetchStatus.lastRun = new Date();
  console.log('[Prefetch] Warming cache for all regions × categories...');
  var start = Date.now();

  // Batch into groups of 6 to avoid hammering APIs simultaneously
  var tasks = [];
  for (var ri = 0; ri < ALL_PREFETCH_REGIONS.length; ri++) {
    for (var ci = 0; ci < ALL_PREFETCH_CATEGORIES.length; ci++) {
      tasks.push({ region: ALL_PREFETCH_REGIONS[ri], category: ALL_PREFETCH_CATEGORIES[ci] });
    }
  }

  // Process in batches of 6 with 800ms gap between batches
  var BATCH_SIZE = 6;
  for (var i = 0; i < tasks.length; i += BATCH_SIZE) {
    var batch = tasks.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(batch.map(function(t) { return prefetchOne(t.region, t.category); }));
    if (i + BATCH_SIZE < tasks.length) {
      await new Promise(function(r) { setTimeout(r, 800); });
    }
  }

  prefetchStatus.running = false;
  prefetchStatus.warmed  = true;
  console.log('[Prefetch] Done in ' + ((Date.now()-start)/1000).toFixed(1) + 's — ' + tasks.length + ' region/category combos warmed');
}

// ── SENTIMENT CACHE ──────────────────────────────────────
var sentimentCache = {};

async function analyzeSentiment(text) {
  if (!text || text.length < 10) return 'neutral';
  var key = text.substring(0, 80);
  if (sentimentCache[key]) return sentimentCache[key];
  try {
    var r = await axios.post(
      'https://api.ai21.com/studio/v1/chat/completions',
      {
        model: 'jamba-mini-2-2026-01',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Classify the sentiment of this news headline as exactly one word: positive, negative, or neutral. Headline: "' + text.substring(0, 200) + '". Reply with only the single word.' }]
      },
      { headers: { 'Authorization': 'Bearer ' + process.env.AI21_API_KEY, 'Content-Type': 'application/json' }, timeout: 8000 }
    );
    var raw = '';
    if (r.data && r.data.choices && r.data.choices[0]) {
      raw = (r.data.choices[0].message.content || '').toLowerCase().trim();
    }
    var result = raw.includes('positive') ? 'positive' : raw.includes('negative') ? 'negative' : 'neutral';
    sentimentCache[key] = result;
    return result;
  } catch (e) {
    return 'neutral';
  }
}

// ── TRENDING TOPICS ──────────────────────────────────────
var STOP_WORDS = new Set(['the','a','an','and','or','but','in','on','at','to','for','of','with','is','are','was','were','be','been','has','have','had','will','would','could','should','may','might','this','that','these','those','it','its','by','from','as','up','about','into','than','after','before','over','new','says','said','say','he','she','they','we','you','i','his','her','their','our','my','your','not','no','so','if','do','does','did','can','all','more','also','out','get','how','what','when','where','who','which','why','us','uk','eu','one','two','per','vs','via']);

function extractTrending(articlesMap) {
  var freq = {};
  Object.keys(articlesMap).forEach(function(cat) {
    (articlesMap[cat] || []).forEach(function(a) {
      var text = ((a.title || '') + ' ' + (a.description || '')).toLowerCase();
      var words = text.match(/\b[a-z]{4,}\b/g) || [];
      words.forEach(function(w) { if (!STOP_WORDS.has(w)) freq[w] = (freq[w] || 0) + 1; });
    });
  });
  return Object.keys(freq)
    .filter(function(w) { return freq[w] >= 2; })
    .sort(function(a, b) { return freq[b] - freq[a]; })
    .slice(0, 15)
    .map(function(w) { return { word: w[0].toUpperCase() + w.slice(1), count: freq[w] }; });
}

// ── RELATED ARTICLES ─────────────────────────────────────
function findRelated(targetTitle, pool, limit) {
  if (!targetTitle || !pool || !pool.length) return [];
  limit = limit || 3;
  var targetWords = new Set((targetTitle.toLowerCase().match(/\b[a-z]{4,}\b/g) || []).filter(function(w) { return !STOP_WORDS.has(w); }));
  return pool
    .filter(function(a) { return a.title !== targetTitle; })
    .map(function(a) {
      var words = (a.title || '').toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
      var score = words.filter(function(w) { return targetWords.has(w); }).length;
      return { a: a, score: score };
    })
    .filter(function(x) { return x.score > 0; })
    .sort(function(a, b) { return b.score - a.score; })
    .slice(0, limit)
    .map(function(x) { return x.a; });
}

// ── TRANSLATION CACHE ────────────────────────────────────
var translationCache = {};

// Free public LibreTranslate instances — tried in order until one works
var LIBRE_ENDPOINTS = [
  process.env.LIBRETRANSLATE_URL,          // custom self-hosted (highest priority)
  'https://libretranslate.de',             // German public mirror
  'https://translate.argosopentech.com',   // Argos OpenTech public
  'https://lt.vern.cc',                    // Community mirror
].filter(Boolean);

async function tryLibreTranslate(endpoint, text, lang) {
  var r = await axios.post(
    endpoint + '/translate',
    { q: text, source: 'en', target: lang, format: 'text' },
    { headers: { 'Content-Type': 'application/json' }, timeout: 8000 }
  );
  if (r.data && r.data.translatedText) return r.data.translatedText;
  throw new Error('No translation returned');
}

async function translateText(text, lang) {
  if (!text || lang === 'en') return text;
  var key = lang + ':' + text.substring(0, 60);
  if (translationCache[key]) return translationCache[key];

  for (var i = 0; i < LIBRE_ENDPOINTS.length; i++) {
    try {
      var result = await tryLibreTranslate(LIBRE_ENDPOINTS[i], text, lang);
      translationCache[key] = result;
      console.log('[Translate] Success via ' + LIBRE_ENDPOINTS[i]);
      return result;
    } catch (e) {
      console.log('[Translate] ' + LIBRE_ENDPOINTS[i] + ' failed: ' + e.message.substring(0,50));
    }
  }

  // All endpoints failed — return original
  return text;
}

// ── SLEEP ────────────────────────────────────────────────
function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

// ── AGENT ────────────────────────────────────────────────
async function runAgent() {
  console.log('Agent running at ' + new Date().toLocaleTimeString());
  for (var i = 0; i < CATEGORIES.length; i++) {
    var category = CATEGORIES[i];
    var articles = await fetchNews(category, '');
    if (!articles.length) continue;
    var blogContent = await generateBlog(articles[0], category);
    if (blogContent) publishBlog(articles[0].title, blogContent, articles[0].url || '', category);
    await sleep(2000);
  }
  console.log('Agent finished.');
}

// ═══════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════

app.get('/api/posts', function(req, res) { res.json(loadPosts()); });
app.get('/api/posts/:category', function(req, res) { var p = loadPosts(); res.json(p[req.params.category] || []); });

// ── LIVE NEWS with pagination ────────────────
app.get('/api/news/:region/:category', async function(req, res) {
  var region = req.params.region;
  var category = req.params.category;
  var page = parseInt(req.query.page) || 1;
  var pageSize = parseInt(req.query.pageSize) || 6;
  var country = REGION_COUNTRIES[region];
  if (country === undefined) country = '';

  console.log('Fetch: region=' + region + ' cat=' + category + ' page=' + page);

  try {
    var articles = await fetchNews(category, country, page, pageSize);
    res.json({ articles: articles, page: page, hasMore: articles.length === pageSize });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── TRENDING ─────────────────────────────────
app.get('/api/trending/:region', async function(req, res) {
  var country = REGION_COUNTRIES[req.params.region] || '';
  try {
    var allData = {};
    await Promise.all(CATEGORIES.map(async function(cat) {
      try { allData[cat] = await fetchNews(cat, country, 1, 5); } catch(e) { allData[cat] = []; }
    }));
    res.json(extractTrending(allData));
  } catch(e) { res.status(500).json([]); }
});

// ── RELATED ───────────────────────────────────
app.get('/api/related', async function(req, res) {
  var title = req.query.title || '';
  var category = req.query.category || 'ai';
  var region = req.query.region || 'worldwide';
  var country = REGION_COUNTRIES[region] || '';
  try {
    var pool = [];
    var cats = [category, 'world', 'technology'];
    var seen = {};
    await Promise.all(cats.map(async function(cat) {
      if (seen[cat]) return; seen[cat] = true;
      try { pool = pool.concat(await fetchNews(cat, country, 1, 10)); } catch(e) {}
    }));
    res.json(findRelated(title, pool, 3));
  } catch(e) { res.status(500).json([]); }
});

// ── SENTIMENT ─────────────────────────────────
app.post('/api/sentiment', async function(req, res) {
  try { res.json({ sentiment: await analyzeSentiment(req.body.text || '') }); }
  catch(e) { res.json({ sentiment: 'neutral' }); }
});

// ── TRANSLATE ────────────────────────────────
app.post('/api/translate', async function(req, res) {
  var texts = req.body.texts || [];
  var lang = req.body.lang || 'en';
  if (lang === 'en') return res.json({ translated: texts });
  try {
    var translated = await Promise.all(texts.map(function(t) { return translateText(t, lang); }));
    res.json({ translated: translated });
  } catch(e) { res.json({ translated: texts }); }
});

// ── CATEGORY SUMMARY ──────────────────────────
app.get('/api/categories', function(req, res) {
  var posts = loadPosts();
  var summary = {};
  Object.keys(posts).forEach(function(cat) {
    summary[cat] = { count: posts[cat].length, latest: posts[cat][0] || null };
  });
  res.json(summary);
});

// ── REFRESH ───────────────────────────────────
app.post('/api/refresh', async function(req, res) {
  res.json({ message: 'Agent refresh started!' });
  runAgent().catch(console.error);
  runPrefetch().catch(console.error);  // also re-warm cache immediately
});


// Debug: test fetchNews directly in browser
app.get('/api/test', async function(req, res) {
  try {
    var articles = await fetchNews('world', 'worldwide', 1, 5);
    res.json({ count: articles.length, first: articles[0] || null, ok: articles.length > 0 });
  } catch(e) {
    res.json({ error: e.message });
  }
});

// Cache status — useful for debugging
app.get('/api/status', function(req, res) {
  res.json({
    prefetch: {
      lastRun:  prefetchStatus.lastRun,
      warmed:   prefetchStatus.warmed,
      running:  prefetchStatus.running,
      errors:   prefetchStatus.errors
    },
    uptime: Math.round(process.uptime()) + 's'
  });
});

// ── CRON ─────────────────────────────────────
// Run agent (blog generation) every 10 min
cron.schedule('*/10 * * * *', function() { runAgent().catch(console.error); });

// Pre-fetch news cache every 5 min — keeps page load instant
cron.schedule('*/5 * * * *', function() {
  console.log('[Cron] Prefetch triggered');
  runPrefetch().catch(console.error);
});

// ── START ─────────────────────────────────────
var PORT = process.env.PORT || 3000;
app.listen(PORT, async function() {
  console.log('Server: http://localhost:' + PORT);

  // Warm cache immediately on startup so first page load is fast
  console.log('[Startup] Pre-warming news cache...');
  runPrefetch().catch(console.error);

  // Run blog agent after cache is warm (staggered to avoid API burst)
  setTimeout(function() { runAgent().catch(console.error); }, 15000);
});
