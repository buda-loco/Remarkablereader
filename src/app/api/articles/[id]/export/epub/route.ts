import { NextRequest, NextResponse } from 'next/server';
import { getArticle } from '@/lib/db';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { JSDOM } from 'jsdom';
import axios from 'axios';

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
    const generateArchive = new Promise<void>(async (resolve, reject) => {
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

        // Process Content and Images
        // We construct the full body content here to ensure everything is properly serialized as XHTML
        // IMPORTANT: Replace named entities with numeric entities or raw characters to prevent XML parsing errors
        // on devices that don't fully support the XHTML DTD (like reMarkable).
        // We do this BEFORE JSDOM parsing to ensure they are treated as the correct characters.
        const cleanContent = (article.content || '')
            .replace(/&nbsp;/g, '&#160;')
            .replace(/&mdash;/g, '&#8212;')
            .replace(/&ndash;/g, '&#8211;')
            .replace(/&ldquo;/g, '&#8220;')
            .replace(/&rdquo;/g, '&#8221;')
            .replace(/&lsquo;/g, '&#8216;')
            .replace(/&rsquo;/g, '&#8217;')
            .replace(/&copy;/g, '&#169;')
            .replace(/&trade;/g, '&#8482;')
            .replace(/&reg;/g, '&#174;')
            .replace(/&hellip;/g, '&#8230;')
            .replace(/&bull;/g, '&#8226;')
            .replace(/&middot;/g, '&#183;');

        const dom = new JSDOM(`<!DOCTYPE html><body>
            <h1 class="article-title">${article.title}</h1>
            <div class="meta">
                ${article.byline ? `By ${article.byline} • ` : ''}
                ${article.siteName ? `${article.siteName} • ` : ''}
                ${new Date(article.createdAt * 1000).toLocaleDateString()}
            </div>
            <div class="article-content">
                ${cleanContent}
            </div>
        </body>`);
        const document = dom.window.document;

        // SANITIZATION: Remove unsupported tags that crash e-readers
        const unsafeTags = ['script', 'iframe', 'object', 'embed', 'style', 'link', 'meta', 'form', 'input', 'button'];
        unsafeTags.forEach(tag => {
            const elements = document.querySelectorAll(tag);
            elements.forEach(el => el.remove());
        });

        // Clean up figures and captions
        const figures = Array.from(document.querySelectorAll('figure'));
        figures.forEach(figure => {
            figure.removeAttribute('style');
            figure.classList.add('article-figure');

            const caption = figure.querySelector('figcaption');
            if (caption) {
                caption.removeAttribute('style');
                caption.classList.add('article-caption');
            }

            const img = figure.querySelector('img');
            if (img) {
                img.removeAttribute('style');
                img.removeAttribute('srcset'); // Remove srcset as it can confuse older readers
                img.removeAttribute('loading');
                img.removeAttribute('decoding');
                img.classList.add('article-image');
            }
        });

        const images = Array.from(document.querySelectorAll('img'));
        const downloadedImages: { id: string, href: string, mediaType: string }[] = [];

        // Download and embed images
        for (let i = 0; i < images.length; i++) {
            const img = images[i];
            const src = img.getAttribute('src');

            // Clean up image attributes
            img.removeAttribute('srcset');
            img.removeAttribute('loading');
            img.removeAttribute('decoding');
            img.removeAttribute('style');
            img.removeAttribute('width'); // Let CSS handle sizing
            img.removeAttribute('height');

            if (src && src.startsWith('http')) {
                try {
                    const response = await axios.get(src, { responseType: 'arraybuffer', timeout: 5000 });
                    const contentType = response.headers['content-type'];
                    const extension = contentType?.split('/')[1] || 'jpg';
                    const filename = `image_${i}.${extension}`;
                    const imagePath = `OEBPS/images/${filename}`;

                    // Add to archive
                    archive.append(response.data, { name: imagePath });

                    // Update src in DOM
                    img.setAttribute('src', `images/${filename}`);

                    // Add to manifest list
                    downloadedImages.push({
                        id: `img_${i}`,
                        href: `images/${filename}`,
                        mediaType: contentType || 'image/jpeg'
                    });
                } catch (err) {
                    console.error(`Failed to download image: ${src}`, err);
                    // If download fails, remove the image to prevent broken icon
                    img.remove();
                }
            } else {
                // Remove images with invalid/local sources
                img.remove();
            }
        }

        const escapeXML = (str: string) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

        const serializer = new dom.window.XMLSerializer();
        // Serialize body content but remove the xmlns attribute that JSDOM/XMLSerializer might add to the root element
        // of the fragment if it thinks it's a standalone XML document.
        let bodyContent = serializer.serializeToString(document.body);
        bodyContent = bodyContent.replace(/ xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/g, '');

        const xhtmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en">
<head>
    <title>${escapeXML(article.title)}</title>
    <style>
        /* Base Reset and Typography */
        body { 
            font-family: Georgia, "Times New Roman", serif;
            font-size: 1em; /* Assumed base 16px */
            line-height: 1.4; /* 22.4px - Base rhythm */
            color: #111;
            text-align: left;
            margin: 0;
            padding: 0 10%; /* Generous margins */
            max-width: 100%;
            background-color: #fff;
        }

        /* Headings */
        h1.article-title { 
            font-family: Georgia, "Times New Roman", serif;
            font-size: 2em; /* 32px - Multiple of 8 */
            line-height: 1.25; /* 40px - Multiple of 8 */
            margin: 1.5em 0 0.5em 0; /* Vertical rhythm */
            text-align: left !important;
            font-weight: bold;
            page-break-after: avoid;
        }

        /* Metadata */
        .meta { 
            font-family: Georgia, "Times New Roman", serif;
            color: #555; 
            font-size: 0.875em; /* 14px */
            line-height: 1.6;
            margin-bottom: 2em; /* 32px */
            text-align: left;
            border-bottom: 1px solid #eee;
            padding-bottom: 1em;
        }
        
        /* Content Text */
        p { 
            margin-bottom: 1.5em; /* 24px - Matches base line-height roughly */
            text-align: left;
            text-indent: 0;
            widows: 2;
            orphans: 2;
        }

        /* Links */
        a { 
            color: #000; 
            text-decoration: underline;
            text-decoration-thickness: 1px;
            text-underline-offset: 2px;
        }

        /* Figures & Images */
        figure.article-figure { 
            display: block;
            margin: 2.5em 0; /* 40px */
            padding: 0;
            width: 100%;
            page-break-inside: avoid;
        }
        
        img.article-image { 
            display: block;
            max-width: 100%; 
            height: auto; 
            margin: 0 auto 1em auto; /* 16px bottom margin */
        }
        
        /* Captions - Small Serif */
        figcaption.article-caption { 
            display: block;
            font-family: Georgia, "Times New Roman", serif;
            font-size: 0.75em; /* 12px */
            line-height: 1.33; /* 16px */
            color: #444; 
            text-align: center; 
            font-style: italic;
            margin-top: 0;
            padding: 0 2em;
        }
        
        /* Lists */
        ul, ol {
            margin: 0 0 1.5em 2em;
            padding: 0;
        }
        li {
            margin-bottom: 0.5em;
        }
        
        /* Blockquotes */
        blockquote {
            margin: 1.5em 2em;
            padding-left: 1em;
            border-left: 4px solid #ddd;
            font-style: italic;
            color: #444;
        }
    </style>
</head>
${bodyContent}
</html>`;
        archive.append(xhtmlContent, { name: 'OEBPS/article.xhtml', store: true });

        // 4. OEBPS/content.opf
        const imageManifestItems = downloadedImages.map(img =>
            `<item id="${img.id}" href="${img.href}" media-type="${img.mediaType}"/>`
        ).join('\n        ');

        const contentOpf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="2.0">
    <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
        <dc:title>${escapeXML(article.title)}</dc:title>
        <dc:creator opf:role="aut">${escapeXML(article.byline || article.siteName || 'Unknown')}</dc:creator>
        <dc:language>en</dc:language>
        <dc:identifier id="BookId">urn:uuid:${escapeXML(article.id)}</dc:identifier>
    </metadata>
    <manifest>
        <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
        <item id="article" href="article.xhtml" media-type="application/xhtml+xml"/>
        ${imageManifestItems}
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
        <meta name="dtb:uid" content="urn:uuid:${escapeXML(article.id)}"/>
        <meta name="dtb:depth" content="1"/>
        <meta name="dtb:totalPageCount" content="0"/>
        <meta name="dtb:maxPageNumber" content="0"/>
    </head>
    <docTitle>
        <text>${escapeXML(article.title)}</text>
    </docTitle>
    <navMap>
        <navPoint id="navPoint-1" playOrder="1">
            <navLabel>
                <text>${escapeXML(article.title)}</text>
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
