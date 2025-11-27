import { getArticle } from '@/lib/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Inter, Merriweather } from 'next/font/google';
import createDOMPurify from 'isomorphic-dompurify';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const merriweather = Merriweather({ weight: ['300', '400', '700', '900'], subsets: ['latin'], variable: '--font-merriweather' });

export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const article = getArticle(id);

    if (!article) {
        notFound();
    }

    const cleanContent = createDOMPurify.sanitize(article.content);

    return (
        <main className={`min-h-screen bg-white ${inter.variable} ${merriweather.variable}`}>
            {/* Top Navigation Bar */}
            <nav className="navbar navbar-expand-lg navbar-light bg-white border-bottom border-secondary-subtle sticky-top">
                <div className="container-fluid px-4">
                    <Link href="/" className="btn btn-outline-secondary border-0">
                        ← Back to Library
                    </Link>

                    <div className="d-flex gap-2">
                        <a href={`/api/articles/${article.id}/export/epub`} className="btn btn-outline-primary">
                            Download EPUB
                        </a>
                        <a href={`/api/articles/${article.id}/export/pdf`} className="btn btn-primary">
                            Download PDF
                        </a>
                    </div>
                </div>
            </nav>

            <div className="container py-5">
                <div className="row justify-content-center">
                    <div className="col-lg-8 col-xl-7">
                        <article>
                            <header className="mb-5 text-center">
                                <h1 className="display-4 fw-bold font-serif mb-3">{article.title}</h1>
                                <div className="text-muted font-sans d-flex justify-content-center gap-3 align-items-center">
                                    {article.byline && <span className="fw-medium">{article.byline}</span>}
                                    {article.siteName && (
                                        <>
                                            <span>•</span>
                                            <span>{article.siteName}</span>
                                        </>
                                    )}
                                    <span>•</span>
                                    <time>{new Date(article.createdAt * 1000).toLocaleDateString()}</time>
                                </div>
                            </header>

                            <div
                                className="article-content font-serif fs-5 lh-lg text-dark"
                                dangerouslySetInnerHTML={{ __html: cleanContent }}
                            />
                        </article>
                    </div>
                </div>
            </div>


        </main>
    );
}
