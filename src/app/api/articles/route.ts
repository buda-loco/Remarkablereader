import { NextRequest, NextResponse } from 'next/server';
import { addArticle, getAllArticles, deleteAllArticles } from '@/lib/db';
import { parseArticle } from '@/lib/parser';

export async function POST(request: NextRequest) {
    try {
        const { url } = await request.json();
        if (!url) {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 });
        }

        const parsedArticle = await parseArticle(url);
        const id = addArticle({
            ...parsedArticle,
            title: parsedArticle.title || 'Untitled',
            textContent: parsedArticle.textContent || '',
            excerpt: parsedArticle.excerpt || '',
            byline: parsedArticle.byline || '',
            siteName: parsedArticle.siteName || '',
            publishedTime: parsedArticle.publishedTime || '',
        });

        return NextResponse.json({ id, ...parsedArticle }, { status: 201 });
    } catch (error) {
        console.error('Error adding article:', error);
        return NextResponse.json({ error: 'Failed to add article' }, { status: 500 });
    }
}

export async function GET() {
    try {
        const articles = getAllArticles();
        return NextResponse.json(articles);
    } catch (error) {
        console.error('Error fetching articles:', error);
        return NextResponse.json({ error: 'Failed to fetch articles' }, { status: 500 });
    }
}

export async function DELETE() {
    try {
        deleteAllArticles();
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        console.error('Error clearing articles:', error);
        return NextResponse.json({ error: 'Failed to clear articles' }, { status: 500 });
    }
}
