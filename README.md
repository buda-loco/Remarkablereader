# Reader App

A self-contained, distraction-free reading application built with Next.js. This app allows you to curate your own personal library of articles, parsed for a clean reading experience, with robust export options.

![Reader App Dashboard](https://github.com/user-attachments/assets/placeholder-image)

## Features

- **Clean Reading Experience**: Articles are parsed using `@mozilla/readability` to strip ads and clutter.
- **Local Library**: All data is stored locally in a SQLite database (`articles.db`). No external servers required.
- **Organization**:
    - **Lists**: Organize articles into custom lists (e.g., "Favorites", "To Read").
    - **Tags**: Add tags for granular filtering.
    - **Favorites**: Quickly mark articles as favorites.
    - **Search**: Instant search by title or site name.
- **Export**:
    - **PDF**: High-quality PDF export.
    - **EPUB**: Robust EPUB export compatible with all e-readers (Kindle, Kobo, Apple Books).
- **Modern UI**:
    - Responsive design with a collapsible sidebar for mobile.
    - "Remarkable"-inspired aesthetic (Paper White & Charcoal).
    - Drag-and-drop organization.

## Prerequisites

- **Node.js**: Version 18.0.0 or higher.
- **npm** (usually comes with Node.js).

## Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/yourusername/reader-app.git
    cd reader-app
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

## Running the App

1.  **Start the development server**:
    ```bash
    npm run dev
    ```

2.  **Open your browser**:
    Navigate to [http://localhost:3000](http://localhost:3000).

The application will automatically create a local `articles.db` file in the project root upon first run.

## Building for Production

To run the optimized production build:

1.  **Build the application**:
    ```bash
    npm run build
    ```

2.  **Start the production server**:
    ```bash
    npm start
    ```

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Database**: [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
- **Styling**: [Bootstrap 5](https://getbootstrap.com/)
- **Parsing**: [@mozilla/readability](https://github.com/mozilla/readability), [jsdom](https://github.com/jsdom/jsdom)
- **Export**: [puppeteer](https://pptr.dev/) (PDF), [archiver](https://www.npmjs.com/package/archiver) (EPUB)

## License

MIT
