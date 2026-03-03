const axios = require('axios');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const CATEGORY_QUERIES = {
  ai: 'artificial intelligence OR machine learning',
  business: 'business OR finance OR economy',
  science: 'science OR discovery OR research',
  politics: 'politics OR government OR election',
  technology: 'technology OR innovation OR startup',
  world: 'world news OR international OR global'
};

const COUNTRY_MAP = {
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

// Country-specific news sources for fallback search
const COUNTRY_SOURCES = {
  in: 'the-times-of-india,the-hindu,ndtv,india-today,the-economic-times',
  gb: 'bbc-news,the-guardian-uk,independent,sky-news,the-telegraph',
  de: 'der-spiegel,focus,handelsblatt,die-zeit',
  cn: 'south-china-morning-post',
  jp: 'the-japan-times',
  au: 'news-com-au,the-sydney-morning-herald,herald-sun',
  ca: 'cbc-news,the-globe-and-mail,national-post',
  br: 'globo'
};

// Country domain keywords for URL-based detection
const COUNTRY_DOMAINS = {
  in: ['.in/', 'india', 'ndtv', 'hindustantimes', 'timesofindia', 'thehindu', 'indianexpress', 'indiatoday'],
  gb: ['.co.uk/', 'bbc.com', 'theguardian', 'independent.co', 'skynews'],
  de: ['spiegel.de', 'focus.de', 'zeit.de', 'dw.com'],
  cn: ['scmp.com', 'xinhua', 'chinadaily'],
  jp: ['japantimes', 'nhk.or.jp', 'asahi.com'],
  au: ['news.com.au', 'smh.com.au', '.com.au/'],
  ca: ['cbc.ca', 'globeandmail', 'nationalpost'],
  br: ['globo.com', 'folha.uol', '.com.br/']
};

const REGION_INFO = {
  us: { name: 'United States', flag: '🇺🇸' },
  gb: { name: 'United Kingdom', flag: '🇬🇧' },
  in: { name: 'India', flag: '🇮🇳' },
  de: { name: 'Europe', flag: '🇪🇺' },
  cn: { name: 'China', flag: '🇨🇳' },
  jp: { name: 'Japan', flag: '🇯🇵' },
  au: { name: 'Australia', flag: '🇦🇺' },
  ca: { name: 'Canada', flag: '🇨🇦' },
  br: { name: 'Brazil', flag: '🇧🇷' }
};

const SOURCE_COUNTRY_MAP = {
  'bbc': { name: 'United Kingdom', flag: '🇬🇧' },
  'bbc news': { name: 'United Kingdom', flag: '🇬🇧' },
  'the guardian': { name: 'United Kingdom', flag: '🇬🇧' },
  'sky news': { name: 'United Kingdom', flag: '🇬🇧' },
  'the independent': { name: 'United Kingdom', flag: '🇬🇧' },
  'cnn': { name: 'United States', flag: '🇺🇸' },
  'fox news': { name: 'United States', flag: '🇺🇸' },
  'nbc news': { name: 'United States', flag: '🇺🇸' },
  'abc news': { name: 'United States', flag: '🇺🇸' },
  'the new york times': { name: 'United States', flag: '🇺🇸' },
  'washington post': { name: 'United States', flag: '🇺🇸' },
  'the washington post': { name: 'United States', flag: '🇺🇸' },
  'usa today': { name: 'United States', flag: '🇺🇸' },
  'npr': { name: 'United States', flag: '🇺🇸' },
  'the verge': { name: 'United States', flag: '🇺🇸' },
  'wired': { name: 'United States', flag: '🇺🇸' },
  'techcrunch': { name: 'United States', flag: '🇺🇸' },
  'bloomberg': { name: 'United States', flag: '🇺🇸' },
  'reuters': { name: 'United States', flag: '🇺🇸' },
  'associated press': { name: 'United States', flag: '🇺🇸' },
  'ap news': { name: 'United States', flag: '🇺🇸' },
  'globenewswire': { name: 'United States', flag: '🇺🇸' },
  'geeky gadgets': { name: 'United States', flag: '🇺🇸' },
  'lifesciencesworld.com': { name: 'United States', flag: '🇺🇸' },
  'c-sharpcorner.com': { name: 'United States', flag: '🇺🇸' },
  'the times of india': { name: 'India', flag: '🇮🇳' },
  'times of india': { name: 'India', flag: '🇮🇳' },
  'ndtv': { name: 'India', flag: '🇮🇳' },
  'the hindu': { name: 'India', flag: '🇮🇳' },
  'hindustan times': { name: 'India', flag: '🇮🇳' },
  'india today': { name: 'India', flag: '🇮🇳' },
  'the economic times': { name: 'India', flag: '🇮🇳' },
  'the indian express': { name: 'India', flag: '🇮🇳' },
  'cbc news': { name: 'Canada', flag: '🇨🇦' },
  'cbc': { name: 'Canada', flag: '🇨🇦' },
  'the globe and mail': { name: 'Canada', flag: '🇨🇦' },
  'toronto star': { name: 'Canada', flag: '🇨🇦' },
  'the sydney morning herald': { name: 'Australia', flag: '🇦🇺' },
  'the australian': { name: 'Australia', flag: '🇦🇺' },
  'spiegel': { name: 'Germany', flag: '🇩🇪' },
  'der spiegel': { name: 'Germany', flag: '🇩🇪' },
  'dw': { name: 'Germany', flag: '🇩🇪' },
  'dw news': { name: 'Germany', flag: '🇩🇪' },
  'le monde': { name: 'France', flag: '🇫🇷' },
  'france 24': { name: 'France', flag: '🇫🇷' },
  'al jazeera': { name: 'Qatar', flag: '🇶🇦' },
  'south china morning post': { name: 'Hong Kong', flag: '🇭🇰' },
  'xinhua': { name: 'China', flag: '🇨🇳' },
  'japan times': { name: 'Japan', flag: '🇯🇵' },
  'nhk': { name: 'Japan', flag: '🇯🇵' },
  'rt': { name: 'Russia', flag: '🇷🇺' },
  'haaretz': { name: 'Israel', flag: '🇮🇱' }
};

function getSourceCountry(sourceName) {
  if (!sourceName) return null;
  var key = sourceName.toLowerCase().trim();
  if (SOURCE_COUNTRY_MAP[key]) return SOURCE_COUNTRY_MAP[key];
  for (var mapKey in SOURCE_COUNTRY_MAP) {
    if (key.includes(mapKey) || mapKey.includes(key)) {
      return SOURCE_COUNTRY_MAP[mapKey];
    }
  }
  return null;
}

function isFromCountry(article, countryCode) {
  var domains = COUNTRY_DOMAINS[countryCode];
  if (!domains) return false;
  var url = (article.url || '').toLowerCase();
  for (var i = 0; i < domains.length; i++) {
    if (url.includes(domains[i])) return true;
  }
  return false;
}

function normalizeArticle(a, regionInfo) {
  var sourceName = a.source ? a.source.name : '';
  return {
    title: a.title,
    description: a.description || '',
    url: a.url,
    image: a.urlToImage || '',
    publishedAt: a.publishedAt,
    source: { name: sourceName },
    sourceCountryName: regionInfo.name,
    sourceCountryFlag: regionInfo.flag
  };
}

const cache = {};
const CACHE_TTL = 30 * 60 * 1000;

async function fetchNews(category, country) {
  if (country === undefined) country = '';
  var countryCode = COUNTRY_MAP[country] !== undefined ? COUNTRY_MAP[country] : country;
  var cacheKey = category + '_' + (countryCode || 'worldwide');
  var now = Date.now();

  if (cache[cacheKey] && (now - cache[cacheKey].timestamp) < CACHE_TTL) {
    console.log('[' + category + '/' + (countryCode || 'worldwide') + '] Serving from cache');
    return cache[cacheKey].data;
  }

  var query = CATEGORY_QUERIES[category] || category;
  var articles = [];

  try {
    if (countryCode) {
      var regionInfo = REGION_INFO[countryCode] || { name: countryCode.toUpperCase(), flag: '' };

      // Step 1: Try top-headlines with country + query
      var res1 = await axios.get('https://newsapi.org/v2/top-headlines', {
        params: {
          country: countryCode,
          q: query,
          pageSize: 5,
          apiKey: process.env.NEWS_API_KEY
        },
        timeout: 10000
      });

      articles = (res1.data.articles || [])
        .filter(function(a) { return a.title && a.title !== '[Removed]'; })
        .map(function(a) { return normalizeArticle(a, regionInfo); });

      // Step 2: If empty, try top-headlines with country only (no query)
      if (articles.length === 0) {
        console.log('[' + category + '/' + countryCode + '] Trying top-headlines without query...');
        var res2 = await axios.get('https://newsapi.org/v2/top-headlines', {
          params: {
            country: countryCode,
            pageSize: 5,
            apiKey: process.env.NEWS_API_KEY
          },
          timeout: 10000
        });

        articles = (res2.data.articles || [])
          .filter(function(a) { return a.title && a.title !== '[Removed]'; })
          .map(function(a) { return normalizeArticle(a, regionInfo); });
      }

      // Step 3: If still empty, try everything with country-specific sources
      if (articles.length === 0 && COUNTRY_SOURCES[countryCode]) {
        console.log('[' + category + '/' + countryCode + '] Trying everything with sources...');
        var res3 = await axios.get('https://newsapi.org/v2/everything', {
          params: {
            sources: COUNTRY_SOURCES[countryCode],
            q: query,
            pageSize: 5,
            apiKey: process.env.NEWS_API_KEY
          },
          timeout: 10000
        });

        articles = (res3.data.articles || [])
          .filter(function(a) { return a.title && a.title !== '[Removed]'; })
          .map(function(a) { return normalizeArticle(a, regionInfo); });
      }

      // Step 4: Last resort — everything with query + domain filter
      if (articles.length === 0) {
        console.log('[' + category + '/' + countryCode + '] Trying everything with domain filter...');
        var res4 = await axios.get('https://newsapi.org/v2/everything', {
          params: {
            q: query,
            language: 'en',
            sortBy: 'publishedAt',
            pageSize: 20,
            apiKey: process.env.NEWS_API_KEY
          },
          timeout: 10000
        });

        var filtered = (res4.data.articles || [])
          .filter(function(a) {
            return a.title && a.title !== '[Removed]' && isFromCountry(a, countryCode);
          })
          .slice(0, 5)
          .map(function(a) { return normalizeArticle(a, regionInfo); });

        articles = filtered;
      }

    } else {
      // WORLDWIDE
      var res = await axios.get('https://newsapi.org/v2/everything', {
        params: {
          q: query,
          language: 'en',
          sortBy: 'publishedAt',
          pageSize: 5,
          apiKey: process.env.NEWS_API_KEY
        },
        timeout: 10000
      });

      articles = (res.data.articles || [])
        .filter(function(a) { return a.title && a.title !== '[Removed]'; })
        .map(function(a) {
          var sourceName = a.source ? a.source.name : '';
          var detected = getSourceCountry(sourceName);
          return {
            title: a.title,
            description: a.description || '',
            url: a.url,
            image: a.urlToImage || '',
            publishedAt: a.publishedAt,
            source: { name: sourceName },
            sourceCountryName: detected ? detected.name : 'Worldwide',
            sourceCountryFlag: detected ? detected.flag : '🌐'
          };
        });
    }

    console.log('[' + category + '/' + (countryCode || 'worldwide') + '] Final count: ' + articles.length);
    cache[cacheKey] = { data: articles, timestamp: now };
    return articles;

  } catch (err) {
    console.error('[' + category + '] NewsAPI Error:', err.response ? err.response.data : err.message);
    if (cache[cacheKey]) {
      console.log('[' + category + '] Returning stale cache');
      return cache[cacheKey].data;
    }
    return [];
  }
}

module.exports = { fetchNews };