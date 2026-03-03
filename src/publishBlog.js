const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "../blog/posts.json");

function loadPosts() {
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  }
  return { ai: [], business: [], science: [], politics: [], technology: [], world: [] };
}

function publishPost(category, article, blogContent) {
  const posts = loadPosts();

  if (!posts[category]) posts[category] = [];

  const alreadyExists = posts[category].some(post => post.url === article.url);
  if (alreadyExists) {
    console.log(`⚠️  Duplicate skipped: ${article.title}`);
    return;
  }

  posts[category].unshift({
    id: Date.now(),
    title: article.title,
    content: blogContent,
    url: article.url,
    createdAt: new Date().toISOString()
  });

  fs.writeFileSync(filePath, JSON.stringify(posts, null, 2));
  console.log(`✅ Blog saved in [${category}]`);
}

module.exports = { loadPosts, publishPost };