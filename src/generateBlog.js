const axios = require('axios');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

async function generateBlog(title, description, category) {
  const prompt = `You are a professional news blogger. Write a detailed, engaging blog post about the following news story.

Structure:
- Compelling introduction (2-3 sentences)
- 3 paragraphs with full context, background, and implications
- Conclusion with key takeaways

Category: ${category.toUpperCase()}
News Title: ${title}
News Summary: ${description || 'No additional summary provided.'}

Write the full blog post now:`;

  try {
    const response = await axios.post(
      'https://api.ai21.com/studio/v1/chat/completions',
      {
        model: 'jamba-large',
        messages: [
          {
            role: 'system',
            content: 'You are a professional news blogger who writes clear, engaging, well-structured blog posts.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1024,
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.AI21_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const content = response.data?.choices?.[0]?.message?.content;

    if (!content || content.trim() === '') {
      throw new Error('AI21 returned empty content');
    }

    console.log(`✅ Blog generated for: ${title.substring(0, 50)}...`);
    return content.trim();

  } catch (err) {
    console.error('❌ AI21 Error:', err.response?.data || err.message);
    return `${title}\n\n${description || 'This is a developing story.'}\n\nThis story is part of our ongoing coverage in the ${category} category. Check back for more updates.`;
  }
}

module.exports = { generateBlog };