import { NextRequest, NextResponse } from 'next/server';
import { getArticle } from '@/lib/db';
import puppeteer from 'puppeteer';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const article = getArticle(id);

  if (!article) {
    return new NextResponse('Article not found', { status: 404 });
  }

  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();

    // Construct HTML for PDF
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Merriweather:wght@300;400;700&display=swap');
            body {
              font-family: 'Merriweather', serif;
              line-height: 1.6;
              color: #333;
              max-width: 800px;
              margin: 0 auto;
              padding: 40px;
            }
            h1 { font-size: 32px; margin-bottom: 10px; }
            .meta { color: #666; font-size: 14px; margin-bottom: 40px; }
            img { max-width: 100%; height: auto; }
            p { margin-bottom: 1.5em; }
          </style>
        </head>
        <body>
          <h1>${article.title}</h1>
          <div class="meta">
            ${article.byline ? `By ${article.byline} • ` : ''}
            ${article.siteName ? `${article.siteName} • ` : ''}
            ${new Date(article.createdAt * 1000).toLocaleDateString()}
          </div>
          ${article.content}
        </body>
      </html>
    `;

    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', margin: { top: '2cm', bottom: '2cm', left: '2cm', right: '2cm' } });

    await browser.close();

    const filename = article.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'article';
    return new NextResponse(Buffer.from(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    return new NextResponse('Failed to generate PDF', { status: 500 });
  }
}
