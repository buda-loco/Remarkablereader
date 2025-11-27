import Database from 'better-sqlite3';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const dbPath = path.join(process.cwd(), 'articles.db');
const db = new Database(dbPath);

// Initialize database
// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS lists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    position INTEGER DEFAULT 0,
    createdAt INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    createdAt INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS articles (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    title TEXT,
    content TEXT,
    textContent TEXT,
    excerpt TEXT,
    byline TEXT,
    siteName TEXT,
    publishedTime TEXT,
    list_id TEXT,
    createdAt INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY(list_id) REFERENCES lists(id)
  );

  CREATE TABLE IF NOT EXISTS article_tags (
    article_id TEXT,
    tag_id TEXT,
    PRIMARY KEY (article_id, tag_id),
    FOREIGN KEY(article_id) REFERENCES articles(id) ON DELETE CASCADE,
    FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE
  );
`);

// Migration: Add list_id to articles if it doesn't exist
try {
  db.exec('ALTER TABLE articles ADD COLUMN list_id TEXT REFERENCES lists(id)');
} catch (e) {
  // Column likely already exists
}

// Seed default list
const defaultList = db.prepare('SELECT * FROM lists WHERE name = ?').get('Reading List');
if (!defaultList) {
  const id = uuidv4();
  db.prepare('INSERT INTO lists (id, name, position) VALUES (?, ?, ?)').run(id, 'Reading List', 0);
}

export interface Article {
  id: string;
  url: string;
  title: string;
  content: string;
  textContent: string;
  excerpt: string;
  byline: string;
  siteName: string;
  publishedTime: string;
  list_id?: string;
  createdAt: number;
  tags?: Tag[];
}

export interface List {
  id: string;
  name: string;
  position: number;
  createdAt: number;
}

export interface Tag {
  id: string;
  name: string;
}

// --- Articles ---

export function addArticle(article: Omit<Article, 'id' | 'createdAt' | 'tags'>) {
  const id = uuidv4();
  // Default to first list if not specified
  let listId = article.list_id;
  if (!listId) {
    const firstList = db.prepare('SELECT id FROM lists ORDER BY position ASC LIMIT 1').get() as { id: string };
    listId = firstList?.id;
  }

  const stmt = db.prepare(`
    INSERT INTO articles (id, url, title, content, textContent, excerpt, byline, siteName, publishedTime, list_id)
    VALUES (@id, @url, @title, @content, @textContent, @excerpt, @byline, @siteName, @publishedTime, @list_id)
  `);
  stmt.run({ ...article, id, list_id: listId });
  return id;
}

export function getArticle(id: string): Article | undefined {
  const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(id) as Article | undefined;
  if (article) {
    article.tags = getArticleTags(id);
  }
  return article;
}

export function getAllArticles(): Article[] {
  const articles = db.prepare('SELECT * FROM articles ORDER BY createdAt DESC').all() as Article[];
  return articles.map(a => ({ ...a, tags: getArticleTags(a.id) }));
}

export function deleteArticle(id: string) {
  const stmt = db.prepare('DELETE FROM articles WHERE id = ?');
  stmt.run(id);
}

export function deleteAllArticles() {
  const stmt = db.prepare('DELETE FROM articles');
  stmt.run();
}

export function updateArticleList(articleId: string, listId: string) {
  db.prepare('UPDATE articles SET list_id = ? WHERE id = ?').run(listId, articleId);
}

// --- Lists ---

export function getLists(): List[] {
  return db.prepare('SELECT * FROM lists ORDER BY position ASC').all() as List[];
}

export function createList(name: string) {
  const id = uuidv4();
  const maxPos = db.prepare('SELECT MAX(position) as maxPos FROM lists').get() as { maxPos: number };
  const position = (maxPos.maxPos || 0) + 1;
  db.prepare('INSERT INTO lists (id, name, position) VALUES (?, ?, ?)').run(id, name, position);
  return { id, name, position };
}

export function deleteList(id: string) {
  // Move articles to default list or delete? Let's delete for now, or maybe move to first available.
  // Requirement doesn't specify. Let's just delete the list.
  // SQLite foreign key might restrict if we enforced it strictly, but we didn't enable PRAGMA foreign_keys.
  db.prepare('DELETE FROM lists WHERE id = ?').run(id);
}

// --- Tags ---

export function getTags(): Tag[] {
  return db.prepare('SELECT * FROM tags ORDER BY name ASC').all() as Tag[];
}

export function createTag(name: string) {
  const existing = db.prepare('SELECT * FROM tags WHERE name = ?').get(name) as Tag;
  if (existing) return existing;

  const id = uuidv4();
  db.prepare('INSERT INTO tags (id, name) VALUES (?, ?)').run(id, name);
  return { id, name };
}

export function getArticleTags(articleId: string): Tag[] {
  return db.prepare(`
    SELECT t.* FROM tags t
    JOIN article_tags at ON t.id = at.tag_id
    WHERE at.article_id = ?
  `).all(articleId) as Tag[];
}

export function addTagToArticle(articleId: string, tagName: string) {
  const tag = createTag(tagName);
  try {
    db.prepare('INSERT INTO article_tags (article_id, tag_id) VALUES (?, ?)').run(articleId, tag.id);
  } catch (e) {
    // Already exists
  }
  return tag;
}

export function removeTagFromArticle(articleId: string, tagId: string) {
  db.prepare('DELETE FROM article_tags WHERE article_id = ? AND tag_id = ?').run(articleId, tagId);
}

// --- Import/Export ---

export function exportLibrary() {
  const lists = getLists();
  const articles = getAllArticles();
  const tags = getTags();
  const articleTags = db.prepare('SELECT * FROM article_tags').all();
  return { lists, articles, tags, articleTags };
}

export function importLibrary(data: any) {
  const insertList = db.prepare('INSERT OR REPLACE INTO lists (id, name, position, createdAt) VALUES (@id, @name, @position, @createdAt)');
  const insertTag = db.prepare('INSERT OR REPLACE INTO tags (id, name, createdAt) VALUES (@id, @name, @createdAt)');
  const insertArticle = db.prepare('INSERT OR REPLACE INTO articles (id, url, title, content, textContent, excerpt, byline, siteName, publishedTime, list_id, createdAt) VALUES (@id, @url, @title, @content, @textContent, @excerpt, @byline, @siteName, @publishedTime, @list_id, @createdAt)');
  const insertArticleTag = db.prepare('INSERT OR REPLACE INTO article_tags (article_id, tag_id) VALUES (@article_id, @tag_id)');

  const transaction = db.transaction((library) => {
    if (library.lists) library.lists.forEach((l: any) => insertList.run(l));
    if (library.tags) library.tags.forEach((t: any) => insertTag.run(t));
    if (library.articles) library.articles.forEach((a: any) => insertArticle.run(a));
    if (library.articleTags) library.articleTags.forEach((at: any) => insertArticleTag.run(at));
  });

  transaction(data);
}
