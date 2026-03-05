const axios = require('axios');
const Parser = require('rss-parser');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const rssParser = new Parser({
  timeout: 15000, // increased for slow networks — don't hang for 12s
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NewsAI/1.0)' },
  customFields: {
    item: [
      ['media:content',   'media:content'  ],
      ['media:thumbnail', 'media:thumbnail']
    ]
  }
});

// ── CATEGORY KEYWORDS ────────────────────────────────────
var CATEGORY_KEYWORDS = {
  ai:         ['artificial intelligence','machine learning',' ai ','chatgpt','openai','neural','deepmind','llm','generative','gpt','robot'],
  technology: ['technology','tech','software','startup','innovation','gadget','apple','google','microsoft','cybersecurity','semiconductor','chip','app'],
  business:   ['business','economy','finance','market','stock','trade','gdp','inflation','investment','revenue','profit','earnings','bank'],
  science:    ['science','research','discovery','space','nasa','climate','biology','physics','medicine','study','experiment','species','asteroid'],
  politics:   ['politics','government','election','president','minister','parliament','senate','policy','vote','congress','treaty','diplomat','law'],
  world:      ['world','international','global','war','conflict','crisis','united nations','diplomacy','sanction','protest','summit','attack']
};

var CATEGORY_QUERIES = {
  ai:         'artificial intelligence OR machine learning OR ChatGPT OR OpenAI',
  business:   'business OR finance OR economy OR market',
  science:    'science OR discovery OR research OR space',
  politics:   'politics OR government OR election OR policy',
  technology: 'technology OR innovation OR startup OR cybersecurity',
  world:      'world news OR international OR global'
};

// NewsData.io category mapping
var NEWSDATA_CAT = {
  ai: 'technology', technology: 'technology', business: 'business',
  science: 'science', politics: 'politics', world: 'world'
};

// NewsData.io country codes
var NEWSDATA_COUNTRY = {
  us:'us', gb:'gb', in:'in', de:'de', cn:'cn',
  jp:'jp', au:'au', ca:'ca', br:'br'
};

var ALL_REGION_CODES = ['us','gb','in','de','cn','jp','au','ca','br'];

var COUNTRY_MAP = {
  worldwide:'', us:'us', uk:'gb', india:'in', europe:'de',
  china:'cn', japan:'jp', australia:'au', canada:'ca', brazil:'br'
};

var REGION_INFO = {
  us: { name:'United States', flag:'🇺🇸' },
  gb: { name:'United Kingdom', flag:'🇬🇧' },
  in: { name:'India',          flag:'🇮🇳' },
  de: { name:'Europe',         flag:'🇪🇺' },
  cn: { name:'China',          flag:'🇨🇳' },
  jp: { name:'Japan',          flag:'🇯🇵' },
  au: { name:'Australia',      flag:'🇦🇺' },
  ca: { name:'Canada',         flag:'🇨🇦' },
  br: { name:'Brazil',         flag:'🇧🇷' }
};

// ── RSS FEEDS — 2 reliable feeds per region ──────────────
// Only feeds verified to be fast and accessible.
// China/Brazil/Japan use English international feeds
// that specifically cover those regions.
var RSS_FEEDS = {
  us: [
    { url:'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml', name:'New York Times' },
    { url:'https://feeds.npr.org/1001/rss.xml',                        name:'NPR' },
  ],
  gb: [
    { url:'https://feeds.bbci.co.uk/news/rss.xml',                    name:'BBC News' },
    { url:'https://www.theguardian.com/world/rss',                    name:'The Guardian' },
  ],
  in: [
    { url:'https://feeds.feedburner.com/ndtvnews-top-stories',        name:'NDTV' },
    { url:'https://www.thehindu.com/news/feeder/default.rss',         name:'The Hindu' },
  ],
  de: [
    { url:'https://rss.dw.com/rdf/rss-en-all',                        name:'DW News' },
    { url:'https://www.france24.com/en/rss',                          name:'France 24' },
  ],
  cn: [
    // China blocks most foreign RSS; use BBC Asia + Al Jazeera for China coverage
    { url:'https://feeds.bbci.co.uk/news/world/asia/rss.xml',         name:'BBC Asia', forceRegion:true },
    { url:'https://www.aljazeera.com/xml/rss/all.xml',                name:'Al Jazeera', forceRegion:true },
  ],
  jp: [
    { url:'https://www3.nhk.or.jp/rss/news/cat0.xml',                 name:'NHK' },
    { url:'https://feeds.bbci.co.uk/news/world/asia/rss.xml',         name:'BBC Asia' },
  ],
  au: [
    { url:'https://www.abc.net.au/news/feed/51120/rss.xml',           name:'ABC Australia' },
    { url:'https://feeds.bbci.co.uk/news/world/australia/rss.xml',   name:'BBC Australia' },
  ],
  ca: [
    { url:'https://www.cbc.ca/cmlink/rss-topstories',                 name:'CBC News' },
    { url:'https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml',name:'BBC Canada' },
  ],
  br: [
    { url:'https://www.france24.com/en/americas/rss',                 name:'France 24 Americas' },
    { url:'https://feeds.bbci.co.uk/news/world/latin_america/rss.xml',name:'BBC Latin America', forceRegion:true },
  ],
  global: [
    { url:'https://feeds.bbci.co.uk/news/world/rss.xml',             name:'BBC World' },
    { url:'https://www.aljazeera.com/xml/rss/all.xml',               name:'Al Jazeera' },
    { url:'https://rss.dw.com/rdf/rss-en-world',                     name:'DW World' },
    { url:'https://www.france24.com/en/rss',                         name:'France 24' },
    { url:'https://feeds.bbci.co.uk/news/technology/rss.xml',        name:'BBC Technology' },
    { url:'https://feeds.bbci.co.uk/news/business/rss.xml',          name:'BBC Business' },
    { url:'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml', name:'BBC Science' },
  ]
};

// ── SOURCE → COUNTRY ─────────────────────────────────────
var SCM = {
  'new york times':    { name:'United States',  flag:'🇺🇸' },
  'npr':               { name:'United States',  flag:'🇺🇸' },
  'bbc news':          { name:'United Kingdom', flag:'🇬🇧' },
  'bbc world':         { name:'United Kingdom', flag:'🇬🇧' },
  'bbc technology':    { name:'United Kingdom', flag:'🇬🇧' },
  'bbc business':      { name:'United Kingdom', flag:'🇬🇧' },
  'bbc science':       { name:'United Kingdom', flag:'🇬🇧' },
  'bbc asia':          { name:'United Kingdom', flag:'🇬🇧' },
  'bbc australia':     { name:'United Kingdom', flag:'🇬🇧' },
  'bbc canada':        { name:'United Kingdom', flag:'🇬🇧' },
  'bbc latin america': { name:'United Kingdom', flag:'🇬🇧' },
  'the guardian':      { name:'United Kingdom', flag:'🇬🇧' },
  'ndtv':              { name:'India',          flag:'🇮🇳' },
  'the hindu':         { name:'India',          flag:'🇮🇳' },
  'dw news':           { name:'Germany',        flag:'🇩🇪' },
  'dw world':          { name:'Germany',        flag:'🇩🇪' },
  'france 24':         { name:'France',         flag:'🇫🇷' },
  'france 24 americas':{ name:'France',         flag:'🇫🇷' },
  'al jazeera':        { name:'Qatar',          flag:'🇶🇦' },
  'nhk':               { name:'Japan',          flag:'🇯🇵' },
  'abc australia':     { name:'Australia',      flag:'🇦🇺' },
  'cbc news':          { name:'Canada',         flag:'🇨🇦' },
};

function getSourceCountry(name) {
  if (!name) return null;
  var k = name.toLowerCase().trim();
  if (SCM[k]) return SCM[k];
  for (var key in SCM) { if (k.includes(key) || key.includes(k)) return SCM[key]; }
  return null;
}

function matchesCategory(article, category) {
  if (category === 'world') return true;
  var kws = CATEGORY_KEYWORDS[category] || [];
  var text = ((article.title || '') + ' ' + (article.description || '')).toLowerCase();
  return kws.some(function(kw) { return text.includes(kw); });
}

function dedupe(arr) {
  var seen = new Set();
  return arr.filter(function(a) {
    if (!a.url || seen.has(a.url)) return false;
    seen.add(a.url); return true;
  });
}

function sortByDate(arr) {
  return arr.sort(function(a, b) {
    return new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0);
  });
}

function extractRSSImage(item) {
  try {
    if (item.enclosure && item.enclosure.url) return item.enclosure.url;
    var mc = item['media:content'];
    if (mc) {
      if (Array.isArray(mc) && mc[0] && mc[0]['$']) return mc[0]['$'].url || '';
      if (mc['$']) return mc['$'].url || '';
    }
    var mt = item['media:thumbnail'];
    if (mt) {
      if (Array.isArray(mt) && mt[0] && mt[0]['$']) return mt[0]['$'].url || '';
      if (mt['$']) return mt['$'].url || '';
    }
    if (item.content) {
      var m = item.content.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (m) return m[1];
    }
  } catch(e) {}
  return '';
}

// ── RSS FETCHER ───────────────────────────────────────────
async function fetchRSS(feedInfo, regionInfo) {
  try {
    var feed = await rssParser.parseURL(feedInfo.url);
    var country = feedInfo.forceRegion ? regionInfo : (getSourceCountry(feedInfo.name) || regionInfo);
    return (feed.items || [])
      .filter(function(item) { return item.title && item.link; })
      .slice(0, 15)
      .map(function(item) {
        return {
          title:             (item.title || '').trim(),
          description:       (item.contentSnippet || item.summary || '').replace(/<[^>]+>/g, '').substring(0, 300),
          url:               item.link,
          image:             extractRSSImage(item),
          publishedAt:       item.pubDate || item.isoDate || new Date().toISOString(),
          source:            { name: feedInfo.name },
          sourceCountryName: country.name,
          sourceCountryFlag: country.flag
        };
      });
  } catch(e) {
    console.log('[RSS] ' + feedInfo.name + ' failed: ' + e.message.substring(0, 60));
    return [];
  }
}

// ── NEWSDATA.IO FETCHER (backup) ──────────────────────────
var newsdataLastCall = 0;
var newsdataFailCount = 0;
var NEWSDATA_GAP = 4000; // 4s min between calls

async function fetchNewsData(category, countryCode, pageSize) {
  if (!process.env.NEWSDATA_API_KEY) return [];
  if (newsdataFailCount >= 5) return []; // quota exhausted
  var now = Date.now();
  // Only enforce gap if called too rapidly (within 1 second)
  if (now - newsdataLastCall < 1000) return [];
  newsdataLastCall = now;

  try {
    var params = {
      apikey:   process.env.NEWSDATA_API_KEY,
      language: 'en',
      category: NEWSDATA_CAT[category] || 'top',
    };
    if (countryCode && NEWSDATA_COUNTRY[countryCode]) {
      params.country = NEWSDATA_COUNTRY[countryCode];
    }
    var r = await axios.get('https://newsdata.io/api/1/news', {
      params: params, timeout: 8000
    });
    var results = r.data.results || [];
    return results.map(function(a) {
      var ri = countryCode ? (REGION_INFO[countryCode] || { name: countryCode.toUpperCase(), flag: '' }) : null;
      var det = getSourceCountry(a.source_id || '');
      var c = ri || det || { name: 'Worldwide', flag: '🌐' };
      return {
        title:             a.title || '',
        description:       a.description || '',
        url:               a.link,
        image:             a.image_url || '',
        publishedAt:       a.pubDate || new Date().toISOString(),
        source:            { name: a.source_id || '' },
        sourceCountryName: c.name,
        sourceCountryFlag: c.flag
      };
    }).filter(function(a) { return a.title && a.url; });
  } catch(e) {
    newsdataFailCount++;
    console.log('[NewsData] ' + e.message.substring(0, 60));
    return [];
  }
}

// ── CACHE ─────────────────────────────────────────────────
var cache = {};
var REGION_TTL    =  5 * 60 * 1000;
var WORLDWIDE_TTL =  8 * 60 * 1000;

// ── FETCH SINGLE REGION ───────────────────────────────────
async function fetchRegion(category, countryCode, page, pageSize, rssOnly) {
  var regionInfo = REGION_INFO[countryCode] || { name: countryCode.toUpperCase(), flag: '' };
  var rssFeeds   = RSS_FEEDS[countryCode] || [];

  // Fire RSS + NewsData.io in PARALLEL — don't wait for RSS before calling API
  var rssFetches = rssFeeds.map(function(feed) { return fetchRSS(feed, regionInfo); });
  var ndFetch = (!rssOnly && process.env.NEWSDATA_API_KEY)
    ? fetchNewsData(category, countryCode, pageSize)
    : Promise.resolve([]);

  var allFetches = await Promise.allSettled(rssFetches.concat([ndFetch]));
  var pool = [];
  allFetches.forEach(function(r) { if (r.status === 'fulfilled' && r.value) pool = pool.concat(r.value); });

  // Try category-filtered results first
  var filtered = pool.filter(function(a) { return matchesCategory(a, category); });

  // Fall back to full pool if category filter too strict
  if (filtered.length < 4) {
    filtered = pool;
    console.log('[' + countryCode + '/' + category + '] Using full pool: ' + pool.length + ' articles');
  }

  filtered = dedupe(filtered);
  filtered = sortByDate(filtered);

  var start = (page - 1) * pageSize;
  var out   = filtered.slice(start, start + pageSize);
  console.log('[' + countryCode + '/' + category + '/p' + page + '] pool=' + pool.length + ' out=' + out.length);
  return out;
}

// ── MAIN EXPORT ───────────────────────────────────────────
async function fetchNews(category, country, page, pageSize) {
  if (country   === undefined) country  = '';
  if (page      === undefined) page     = 1;
  if (pageSize  === undefined) pageSize = 10;

  var countryCode = COUNTRY_MAP[country] !== undefined ? COUNTRY_MAP[country] : country;
  var isWorldwide = !countryCode;
  var cacheKey    = category + '_' + (countryCode || 'worldwide') + '_p' + page;
  var ttl         = isWorldwide ? WORLDWIDE_TTL : REGION_TTL;
  var now         = Date.now();

  if (cache[cacheKey] && (now - cache[cacheKey].timestamp) < ttl) {
    console.log('[CACHE HIT] ' + cacheKey);
    return cache[cacheKey].data;
  }

  var result = [];

  if (isWorldwide) {
    // Worldwide = global RSS feeds only (fast, no 9-region wait)
    console.log('[Worldwide/' + category + '/p' + page + '] Fetching global feeds...');
    var globalRSS = (RSS_FEEDS.global || []).map(function(feed) {
      return fetchRSS(feed, { name: 'Worldwide', flag: '🌐' });
    });
    // Also grab US + UK feeds since they have the most English content
    var usFeeds  = (RSS_FEEDS.us  || []).map(function(feed) { return fetchRSS(feed, REGION_INFO.us);  });
    var gbFeeds  = (RSS_FEEDS.gb  || []).map(function(feed) { return fetchRSS(feed, REGION_INFO.gb);  });
    var inFeeds  = (RSS_FEEDS.in  || []).map(function(feed) { return fetchRSS(feed, REGION_INFO.in);  });

    var allResults = await Promise.allSettled(globalRSS.concat(usFeeds).concat(gbFeeds).concat(inFeeds));
    var pool = [];
    allResults.forEach(function(r) { if (r.status === 'fulfilled' && r.value) pool = pool.concat(r.value); });

    // Try category filter first, fall back to all if too few
    var filtered = pool.filter(function(a) { return matchesCategory(a, category); });
    if (filtered.length < 6) {
      console.log('[Worldwide] Category filter too strict (' + filtered.length + '), using full pool of ' + pool.length);
      filtered = pool;
    }
    filtered = dedupe(filtered);
    filtered = sortByDate(filtered);

    // NewsData.io — always fire in parallel for worldwide (no country filter = broad results)
    if (process.env.NEWSDATA_API_KEY) {
      try {
        var nd = await fetchNewsData(category, null, pageSize * 2);
        if (nd.length) {
          pool = pool.concat(nd);
          filtered = pool.filter(function(a) { return matchesCategory(a, category); });
          if (filtered.length < 6) filtered = pool;
          filtered = dedupe(filtered);
          filtered = sortByDate(filtered);
        }
      } catch(e) {}
    }

    var start = (page - 1) * pageSize;
    result = filtered.slice(start, start + pageSize);
    console.log('[Worldwide/' + category + '/p' + page + '] pool=' + pool.length + ' out=' + result.length);
  } else {
    result = await fetchRegion(category, countryCode, page, pageSize, false);
  }

  cache[cacheKey] = { data: result, timestamp: now };
  return result;
}

module.exports = { fetchNews };
