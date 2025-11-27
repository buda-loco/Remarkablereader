import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import axios from 'axios';
import createDOMPurify from 'isomorphic-dompurify';

export async function parseArticle(url: string) {
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36'
            }
        });
        const html = response.data;
        const doc = new JSDOM(html, { url });
        const reader = new Readability(doc.window.document);
        const article = reader.parse();

        if (!article) {
            throw new Error('Failed to parse article');
        }

        // Sanitize content
        const cleanContent = createDOMPurify.sanitize(article.content || '');

        return {
            title: article.title,
            content: cleanContent,
            textContent: article.textContent,
            excerpt: article.excerpt,
            byline: article.byline,
            siteName: article.siteName,
            publishedTime: article.publishedTime,
            url: url
        };
    } catch (error) {
        console.error('Error parsing article:', error);
        throw error;
    }
}
