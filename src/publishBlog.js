const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../blog/posts.json');

function loadPosts() {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.log('posts.json corrupted, resetting...');
  }
  return { ai: [], technology: [], business: [], science: [], politics: [], world: [] };
}

function publishPost(category, article, blogContent) {
  const posts = loadPosts();

  if (!posts[category]) posts[category] = [];

  const alreadyExists = posts[category].some(post => post.url === article.url);
  if (alreadyExists) {
    console.log('Duplicate skipped: ' + article.title);
    return;
  }

  posts[category].unshift({
    id: Date.now(),
    title: article.title,
    content: blogContent,
    url: article.url,
    image: article.image || '',
    source: article.source?.name || '',
    createdAt: new Date().toISOString()
  });

  if (posts[category].length > 20) {
    posts[category] = posts[category].slice(0, 20);
  }

  fs.writeFileSync(filePath, JSON.stringify(posts, null, 2));
  console.log('Saved [' + category + ']: ' + article.title.substring(0, 60));
}

module.exports = { loadPosts, publishPost };