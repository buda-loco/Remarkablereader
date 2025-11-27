import { NextRequest, NextResponse } from 'next/server';
import { getArticle } from '@/lib/db';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { JSDOM } from 'jsdom';

// Use require for archiver to ensure compatibility
const archiver = require('archiver');

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const article = getArticle(id);

    if (!article) {
        return new NextResponse('Article not found', { status: 404 });
    }

    const tempFilePath = path.join(os.tmpdir(), `temp-${uuidv4()}.epub`);
    const output = fs.createWriteStream(tempFilePath);
    const archive = archiver('zip', {
        zlib: { level: 9 } // Sets the compression level.
    });

    // Promise to handle the archive generation
    const generateArchive = new Promise<void>((resolve, reject) => {
        output.on('close', () => resolve());
        archive.on('error', (err: any) => reject(err));
        archive.pipe(output);

        // 1. mimetype (must be first, uncompressed)
        archive.append('application/epub+zip', { name: 'mimetype', store: true });

        // 2. META-INF/container.xml
        const containerXml = `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
   <rootfiles>
      <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
   </rootfiles>
</container>`;
        archive.append(containerXml, { name: 'META-INF/container.xml', store: true });

        // 3. OEBPS/article.xhtml
        // Strip images for safety, though manual generation handles them better if we wanted to download them.
        const contentWithoutImages = article.content.replace(/<img[^>]*>/g, '');

        // Use JSDOM to ensure valid XHTML
        // We construct the full body content here to ensure everything is properly serialized
        const dom = new JSDOM(`<!DOCTYPE html><body>
            <h1>${article.title}</h1>
            <div class="meta">
                ${article.byline ? `By ${article.byline} • ` : ''}
                ${article.siteName ? `${article.siteName} • ` : ''}
                ${new Date(article.createdAt * 1000).toLocaleDateString()}
            </div>
            ${contentWithoutImages}
        </body>`);

        const serializer = new dom.window.XMLSerializer();
        const bodyContent = serializer.serializeToString(dom.window.document.body);

        const xhtmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en">
<head>
    <title>${article.title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</title>
    <style>
        body { 
            font-family: Georgia, Cambria, "Times New Roman", Times, serif;
            line-height: 1.8;
            color: #111;
            text-align: left;
            margin: 0;
            padding: 5% 8%;
            max-width: 800px;
            margin-left: auto;
            margin-right: auto;
        }
        h1 { 
            font-family: Georgia, Cambria, "Times New Roman", Times, serif;
            font-size: 2.2em; 
            line-height: 1.3;
            margin-bottom: 0.5em;
            text-align: left;
            font-weight: bold;
        }
        .meta { 
            font-family: Georgia, Cambria, "Times New Roman", Times, serif;
            color: #555; 
            font-size: 0.9em; 
            margin-bottom: 3em;
            text-align: left;
            border-bottom: 1px solid #eee;
            padding-bottom: 1em;
        }
        img { max-width: 100%; height: auto; display: block; margin: 1em auto; }
        p { 
            margin-bottom: 1.5em;
            text-align: left;
            text-indent: 0;
        }
        a { color: #000; text-decoration: underline; }
    </style>
</head>
${bodyContent}
</html>`;
        archive.append(xhtmlContent, { name: 'OEBPS/article.xhtml', store: true });

        // 4. OEBPS/content.opf
        const contentOpf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="2.0">
    <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
        <dc:title>${article.title}</dc:title>
        <dc:creator opf:role="aut">${article.byline || article.siteName || 'Unknown'}</dc:creator>
        <dc:language>en</dc:language>
        <dc:identifier id="BookId">urn:uuid:${article.id}</dc:identifier>
    </metadata>
    <manifest>
        <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
        <item id="article" href="article.xhtml" media-type="application/xhtml+xml"/>
    </manifest>
    <spine toc="ncx">
        <itemref idref="article"/>
    </spine>
</package>`;
        archive.append(contentOpf, { name: 'OEBPS/content.opf', store: true });

        // 5. OEBPS/toc.ncx
        const tocNcx = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
    <head>
        <meta name="dtb:uid" content="urn:uuid:${article.id}"/>
        <meta name="dtb:depth" content="1"/>
        <meta name="dtb:totalPageCount" content="0"/>
        <meta name="dtb:maxPageNumber" content="0"/>
    </head>
    <docTitle>
        <text>${article.title}</text>
    </docTitle>
    <navMap>
        <navPoint id="navPoint-1" playOrder="1">
            <navLabel>
                <text>${article.title}</text>
            </navLabel>
            <content src="article.xhtml"/>
        </navPoint>
    </navMap>
</ncx>`;
        archive.append(tocNcx, { name: 'OEBPS/toc.ncx', store: true });

        archive.finalize();
    });

    try {
        await generateArchive;

        const fileBuffer = fs.readFileSync(tempFilePath);
        fs.unlinkSync(tempFilePath);

        const filename = article.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'article';

        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': 'application/epub+zip',
                'Content-Disposition': `attachment; filename="${filename}.epub"`,
            },
        });
    } catch (error: any) {
        console.error('Error generating EPUB:', error);
        if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
        }
        return new NextResponse(`Failed to generate EPUB. Error: ${error.message || error}`, { status: 500 });
    }
}
