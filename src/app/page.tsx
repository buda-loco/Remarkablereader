'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Inter, Merriweather } from 'next/font/google';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const merriweather = Merriweather({ weight: ['300', '400', '700', '900'], subsets: ['latin'], variable: '--font-merriweather' });

interface Tag {
    id: string;
    name: string;
}

interface Article {
    id: string;
    title: string;
    excerpt: string;
    siteName: string;
    createdAt: number;
    list_id?: string;
    tags?: Tag[];
}

interface List {
    id: string;
    name: string;
    position: number;
}

export default function Home() {
    const [url, setUrl] = useState('');
    const [articles, setArticles] = useState<Article[]>([]);
    const [lists, setLists] = useState<List[]>([]);
    const [activeListId, setActiveListId] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showClearModal, setShowClearModal] = useState(false);
    const [articleToDelete, setArticleToDelete] = useState<string | null>(null);
    const [newListName, setNewListName] = useState('');
    const [importFile, setImportFile] = useState<File | null>(null);

    useEffect(() => {
        require('bootstrap/dist/js/bootstrap.bundle.min.js');
        fetchData();
    }, []);

    const fetchData = async () => {
        await Promise.all([fetchLists(), fetchArticles()]);
    };

    const fetchLists = async () => {
        try {
            const res = await fetch('/api/lists');
            const data = await res.json();
            setLists(data);
            if (data.length > 0 && !activeListId) {
                setActiveListId(data[0].id);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const fetchArticles = async () => {
        try {
            const res = await fetch('/api/articles');
            const data = await res.json();
            setArticles(data);
        } catch (err) {
            console.error(err);
        }
    };

    const filteredArticles = articles.filter(article => {
        const matchesSearch = searchQuery.trim() === '' ||
            article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (article.siteName && article.siteName.toLowerCase().includes(searchQuery.toLowerCase()));

        // If searching, show all matches regardless of list. If not, filter by active list.
        const matchesList = searchQuery.trim() !== '' || article.list_id === activeListId || (!article.list_id && lists.length > 0 && activeListId === lists[0].id);

        return matchesSearch && matchesList;
    });

    const handleAddArticle = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/articles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, list_id: activeListId }),
            });

            if (!res.ok) throw new Error('Failed to add article');

            setUrl('');
            fetchArticles();
        } catch (err) {
            setError('Failed to add article. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateList = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newListName.trim()) return;

        try {
            const res = await fetch('/api/lists', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newListName }),
            });
            if (res.ok) {
                setNewListName('');
                fetchLists();
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleDeleteArticle = async () => {
        if (!articleToDelete) return;
        try {
            await fetch(`/api/articles/${articleToDelete}`, { method: 'DELETE' });
            setArticleToDelete(null);
            fetchArticles();
        } catch (err) {
            console.error(err);
        }
    };

    const handleClearAll = async () => {
        try {
            await fetch('/api/articles', { method: 'DELETE' });
            setShowClearModal(false);
            fetchArticles();
        } catch (err) {
            console.error(err);
        }
    };

    const handleDragEnd = async (result: DropResult) => {
        if (!result.destination) return;

        const sourceListId = activeListId; // Assuming we only drag within current view or to tabs?
        // Actually, dragging between tabs is tricky without visible drop zones.
        // For now, let's assume reordering within list (if we had position) or just ignore if dropped in same place.
        // Requirement said "move articles from tab a simple drag and drop". 
        // Usually this means dragging to the tab header.

        // If dropped on a tab (we need to implement droppable tabs)
        // Let's keep it simple: Dragging reorders? Or dragging to a "Move to" zone?
        // The prompt said "move articles from tab a simple drag and drop".
        // Let's implement dragging to the list tabs.

        const draggableId = result.draggableId;
        const destinationId = result.destination.droppableId;

        if (destinationId.startsWith('list-tab-')) {
            const newListId = destinationId.replace('list-tab-', '');
            if (newListId !== activeListId) {
                // Move to new list
                const updatedArticles = articles.map(a =>
                    a.id === draggableId ? { ...a, list_id: newListId } : a
                );
                setArticles(updatedArticles); // Optimistic update

                await fetch(`/api/articles/${draggableId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ list_id: newListId }),
                });

                // Don't refetch immediately to avoid jump, but maybe needed.
                // fetchArticles(); 
            }
        }
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const text = await file.text();
            try {
                const json = JSON.parse(text);
                await fetch('/api/library/import', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(json),
                });
                fetchData();
                alert('Library imported successfully!');
            } catch (err) {
                alert('Failed to import library.');
            }
        }
    };

    return (
        <DragDropContext onDragEnd={handleDragEnd}>
            <main className={`min-h-screen ${inter.variable} ${merriweather.variable}`}>
                {/* Mobile Header */}
                <header className="navbar navbar-dark sticky-top bg-dark flex-md-nowrap p-0 shadow d-md-none">
                    <a className="navbar-brand col-md-3 col-lg-2 me-0 px-3 fs-6 font-serif" href="#">Reader</a>
                    <button className="navbar-toggler position-absolute d-md-none collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#sidebarMenu" aria-controls="sidebarMenu" aria-expanded="false" aria-label="Toggle navigation">
                        <span className="navbar-toggler-icon"></span>
                    </button>
                </header>

                <div className="container-fluid">
                    <div className="row">
                        {/* Sidebar */}
                        <nav id="sidebarMenu" className="col-md-3 col-lg-2 d-md-block bg-light sidebar collapse min-vh-100 border-end border-secondary-subtle p-4">
                            <h1 className="h4 font-serif fw-bold mb-4 d-none d-md-block">Reader</h1>

                            <div className="mb-4">
                                <h6 className="sidebar-heading d-flex justify-content-between align-items-center px-3 mt-4 mb-1 text-muted">
                                    <span>Lists</span>
                                </h6>
                                <ul className="nav flex-column mb-2">
                                    {lists.map(list => (
                                        <Droppable key={list.id} droppableId={`list-tab-${list.id}`}>
                                            {(provided, snapshot) => (
                                                <li
                                                    className="nav-item"
                                                    ref={provided.innerRef}
                                                    {...provided.droppableProps}
                                                >
                                                    <button
                                                        className={`nav-link btn btn-link text-start w-100 ${activeListId === list.id ? 'active fw-bold text-primary' : 'text-dark'}`}
                                                        onClick={() => setActiveListId(list.id)}
                                                        style={{ background: snapshot.isDraggingOver ? '#e9ecef' : 'transparent' }}
                                                    >
                                                        <i className="bi bi-folder me-2"></i> {list.name}
                                                    </button>
                                                    {provided.placeholder}
                                                </li>
                                            )}
                                        </Droppable>
                                    ))}
                                </ul>
                                <form onSubmit={handleCreateList} className="px-3 mt-2">
                                    <input
                                        type="text"
                                        className="form-control form-control-sm"
                                        placeholder="+ New List"
                                        value={newListName}
                                        onChange={(e) => setNewListName(e.target.value)}
                                    />
                                </form>
                            </div>

                            <hr className="my-4" />

                            <div className="d-grid gap-2">
                                <a href="/api/library/export" className="btn btn-outline-secondary btn-sm text-start">
                                    <i className="bi bi-download me-2"></i> Export Library
                                </a>
                                <label className="btn btn-outline-secondary btn-sm text-start cursor-pointer">
                                    <i className="bi bi-upload me-2"></i> Import Library
                                    <input type="file" accept=".json" hidden onChange={handleImport} />
                                </label>
                                <button onClick={() => setShowClearModal(true)} className="btn btn-outline-danger btn-sm text-start">
                                    <i className="bi bi-trash me-2"></i> Clear All Articles
                                </button>
                            </div>
                        </nav>

                        {/* Main Content */}
                        <main className="col-md-9 ms-sm-auto col-lg-10 px-md-5 py-5">
                            <div className="d-flex justify-content-between flex-wrap flex-md-nowrap align-items-center pt-3 pb-2 mb-4 border-bottom border-secondary-subtle">
                                <h2 className="h2 font-serif">
                                    {lists.find(l => l.id === activeListId)?.name || 'Library'}
                                </h2>
                                <div className="col-md-4">
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="Search articles..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Add Article Form */}
                            <div className="card mb-5 p-4 bg-white">
                                <form onSubmit={handleAddArticle} className="row g-3 align-items-center">
                                    <div className="col-12 col-md-9">
                                        <label htmlFor="urlInput" className="visually-hidden">Article URL</label>
                                        <input
                                            type="url"
                                            className="form-control form-control-lg"
                                            id="urlInput"
                                            value={url}
                                            onChange={(e) => setUrl(e.target.value)}
                                            placeholder="Paste article URL to add to library..."
                                            required
                                        />
                                    </div>
                                    <div className="col-12 col-md-3 d-grid">
                                        <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
                                            {loading ? 'Adding...' : 'Add Article'}
                                        </button>
                                    </div>
                                    {error && <div className="col-12 text-danger mt-2">{error}</div>}
                                </form>
                            </div>

                            {/* Article List */}
                            <Droppable droppableId="article-list">
                                {(provided) => (
                                    <div className="table-responsive" ref={provided.innerRef} {...provided.droppableProps}>
                                        <table className="table table-hover align-middle">
                                            <thead className="table-light">
                                                <tr>
                                                    <th scope="col" className="w-50">Title</th>
                                                    <th scope="col">Source</th>
                                                    <th scope="col">Added</th>
                                                    <th scope="col" className="text-end">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredArticles.map((article, index) => (
                                                    <Draggable key={article.id} draggableId={article.id} index={index}>
                                                        {(provided, snapshot) => (
                                                            <tr
                                                                ref={provided.innerRef}
                                                                {...provided.draggableProps}
                                                                {...provided.dragHandleProps}
                                                                style={{ ...provided.draggableProps.style, background: snapshot.isDragging ? '#f8f9fa' : 'transparent' }}
                                                            >
                                                                <td>
                                                                    <div className="d-flex align-items-start">
                                                                        <button
                                                                            className="btn btn-link p-0 me-2 text-danger"
                                                                            onClick={async (e) => {
                                                                                e.stopPropagation();
                                                                                const isFavorite = article.tags?.some(t => t.name === 'Favorites');
                                                                                const method = 'PATCH';
                                                                                const body = isFavorite
                                                                                    ? { removeTag: article.tags?.find(t => t.name === 'Favorites')?.id }
                                                                                    : { addTag: 'Favorites' };

                                                                                // Optimistic update
                                                                                const newTags = isFavorite
                                                                                    ? article.tags?.filter(t => t.name !== 'Favorites')
                                                                                    : [...(article.tags || []), { id: 'temp', name: 'Favorites' }];

                                                                                const updatedArticles = articles.map(a =>
                                                                                    a.id === article.id ? { ...a, tags: newTags } : a
                                                                                );
                                                                                setArticles(updatedArticles);

                                                                                await fetch(`/api/articles/${article.id}`, {
                                                                                    method,
                                                                                    headers: { 'Content-Type': 'application/json' },
                                                                                    body: JSON.stringify(body),
                                                                                });
                                                                                fetchArticles();
                                                                            }}
                                                                        >
                                                                            <i className={`bi ${article.tags?.some(t => t.name === 'Favorites') ? 'bi-heart-fill' : 'bi-heart'}`}></i>
                                                                        </button>
                                                                        <div>
                                                                            <Link href={`/articles/${article.id}`} className="text-decoration-none text-dark fw-bold font-serif d-block">
                                                                                {article.title}
                                                                            </Link>
                                                                            <small className="text-muted d-block text-truncate" style={{ maxWidth: '400px' }}>
                                                                                {article.excerpt}
                                                                            </small>
                                                                            {article.tags && article.tags.length > 0 && (
                                                                                <div className="mt-1">
                                                                                    {article.tags.filter(t => t.name !== 'Favorites').map(tag => (
                                                                                        <span key={tag.id} className="badge bg-secondary me-1">{tag.name}</span>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td>{article.siteName || 'Unknown'}</td>
                                                                <td>{new Date(article.createdAt * 1000).toLocaleDateString()}</td>
                                                                <td className="text-end">
                                                                    <div className="btn-group">
                                                                        <Link href={`/articles/${article.id}`} className="btn btn-sm btn-outline-primary">
                                                                            Read
                                                                        </Link>
                                                                        <button type="button" className="btn btn-sm btn-outline-secondary dropdown-toggle dropdown-toggle-split" data-bs-toggle="dropdown" aria-expanded="false" data-bs-popper-config='{"strategy":"fixed"}'>
                                                                            <span className="visually-hidden">Toggle Dropdown</span>
                                                                        </button>
                                                                        <ul className="dropdown-menu">
                                                                            <li><a className="dropdown-item" href={`/api/articles/${article.id}/export/pdf`}>Download PDF</a></li>
                                                                            <li><a className="dropdown-item" href={`/api/articles/${article.id}/export/epub`}>Download EPUB</a></li>
                                                                            <li><hr className="dropdown-divider" /></li>
                                                                            <li><h6 className="dropdown-header">Move to List</h6></li>
                                                                            {lists.filter(l => l.id !== article.list_id).map(list => (
                                                                                <li key={list.id}>
                                                                                    <button
                                                                                        className="dropdown-item"
                                                                                        onClick={async () => {
                                                                                            await fetch(`/api/articles/${article.id}`, {
                                                                                                method: 'PATCH',
                                                                                                headers: { 'Content-Type': 'application/json' },
                                                                                                body: JSON.stringify({ list_id: list.id }),
                                                                                            });
                                                                                            fetchArticles();
                                                                                        }}
                                                                                    >
                                                                                        {list.name}
                                                                                    </button>
                                                                                </li>
                                                                            ))}
                                                                            <li><hr className="dropdown-divider" /></li>
                                                                            <li><button className="dropdown-item text-danger" onClick={() => setArticleToDelete(article.id)}>Delete</button></li>
                                                                        </ul>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </Draggable>
                                                ))}
                                                {provided.placeholder}
                                                {filteredArticles.length === 0 && !loading && (
                                                    <tr>
                                                        <td colSpan={4} className="text-center py-5 text-muted">
                                                            {articles.length === 0 ? 'No articles found. Add one above.' : 'No matching articles found.'}
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </Droppable>
                        </main>
                    </div>
                </div>

                {/* Clear All Modal */}
                {showClearModal && (
                    <div className="modal fade show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                        <div className="modal-dialog">
                            <div className="modal-content">
                                <div className="modal-header">
                                    <h5 className="modal-title">Clear All Articles</h5>
                                    <button type="button" className="btn-close" onClick={() => setShowClearModal(false)}></button>
                                </div>
                                <div className="modal-body">
                                    <p>Are you sure you want to delete ALL articles? This action cannot be undone.</p>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowClearModal(false)}>Cancel</button>
                                    <button type="button" className="btn btn-danger" onClick={handleClearAll}>Clear All</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Delete Article Modal */}
                {articleToDelete && (
                    <div className="modal fade show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                        <div className="modal-dialog">
                            <div className="modal-content">
                                <div className="modal-header">
                                    <h5 className="modal-title">Delete Article</h5>
                                    <button type="button" className="btn-close" onClick={() => setArticleToDelete(null)}></button>
                                </div>
                                <div className="modal-body">
                                    <p>Are you sure you want to delete this article?</p>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-secondary" onClick={() => setArticleToDelete(null)}>Cancel</button>
                                    <button type="button" className="btn btn-danger" onClick={handleDeleteArticle}>Delete</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </DragDropContext>
    );
}
