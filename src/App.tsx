import React, { useEffect, useState, useMemo } from 'react';
import { BookOpen, Download, Search, FileText, Loader2, AlertCircle, ChevronLeft, Library } from 'lucide-react';
import { fetchLibrary, rawUrl, humanizeTitle, formatSize, colorForSubject, LibraryData } from './lib/github';

export default function App() {
  const [library, setLibrary] = useState<LibraryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [activeSubject, setActiveSubject] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    fetchLibrary()
      .then(setLibrary)
      .catch((err) => setLoadError(err.message || 'Could not load the library.'))
      .finally(() => setLoading(false));
  }, []);

  const booksInSubject = useMemo(() => {
    if (!library || !activeSubject) return [];
    const list = library.books.filter((b) => b.subject === activeSubject);
    if (!query.trim()) return list;
    const q = query.toLowerCase();
    return list.filter((b) => humanizeTitle(b.name).toLowerCase().includes(q));
  }, [library, activeSubject, query]);

  return (
    <div className="min-h-screen bg-paper text-ink font-body flex flex-col">
      <header className="max-w-5xl mx-auto w-full px-5 sm:px-8 py-6 flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-lg bg-shelf flex items-center justify-center shrink-0">
          <BookOpen className="w-4.5 h-4.5 text-white" strokeWidth={2.2} />
        </div>
        <div>
          <div className="font-display font-semibold text-lg leading-none tracking-tight">StudyShelf</div>
          <div className="text-[11px] text-muted mt-0.5">book PDF library</div>
        </div>
        {library && (
          <span className="ml-auto text-xs font-mono text-muted hidden sm:flex items-center gap-1.5">
            <Library className="w-3.5 h-3.5" />
            {library.subjects.length} subjects · {library.books.length} books
          </span>
        )}
      </header>

      <main className="max-w-5xl mx-auto w-full px-5 sm:px-8 pb-16 flex-1">
        {loading && (
          <div className="flex items-center gap-2 text-muted text-sm py-16">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading library…
          </div>
        )}

        {loadError && !loading && (
          <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3 max-w-md">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{loadError}</span>
          </div>
        )}

        {!loading && !loadError && library && !activeSubject && (
          <>
            <h1 className="font-display font-semibold text-2xl sm:text-3xl mb-1">Pick a subject</h1>
            <p className="text-muted text-sm mb-8">Browse textbook PDFs organized by subject.</p>

            {library.subjects.length === 0 && (
              <p className="text-muted text-sm">No subjects yet — check back soon.</p>
            )}

            <div className="flex flex-wrap gap-3">
              {library.subjects.map((subject) => {
                const color = colorForSubject(subject);
                const count = library.books.filter((b) => b.subject === subject).length;
                return (
                  <button
                    key={subject}
                    onClick={() => {
                      setActiveSubject(subject);
                      setQuery('');
                    }}
                    className="group relative flex items-stretch overflow-hidden rounded-lg border border-line hover:border-transparent shadow-sm hover:shadow-md transition-all"
                    style={{ minWidth: '9.5rem' }}
                  >
                    <span className="w-2.5 shrink-0" style={{ backgroundColor: color }} />
                    <span className="flex-1 px-4 py-3.5 text-left bg-white group-hover:bg-stone-50 transition-colors">
                      <span className="block font-display font-semibold text-sm leading-tight">{subject}</span>
                      <span className="block text-[11px] text-muted mt-1 font-mono">{count} books</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {!loading && !loadError && library && activeSubject && (
          <>
            <button
              onClick={() => setActiveSubject(null)}
              className="flex items-center gap-1 text-sm text-muted hover:text-ink mb-5 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              All subjects
            </button>

            <div className="flex items-center gap-2.5 mb-6">
              <span className="w-2.5 h-8 rounded-sm" style={{ backgroundColor: colorForSubject(activeSubject) }} />
              <h1 className="font-display font-semibold text-2xl sm:text-3xl">{activeSubject}</h1>
            </div>

            <div className="relative mb-6 max-w-sm">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search books in this subject…"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-line text-sm focus:outline-none focus:border-shelf focus:ring-1 focus:ring-shelf transition-colors"
              />
            </div>

            {booksInSubject.length === 0 && (
              <p className="text-muted text-sm">No books match here yet.</p>
            )}

            <div className="space-y-2.5">
              {booksInSubject.map((book) => (
                <div
                  key={book.path}
                  className="flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl border border-line hover:border-shelf/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-index-soft flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-index" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{humanizeTitle(book.name)}</div>
                      <div className="text-[11px] font-mono text-muted mt-0.5">PDF · {formatSize(book.size)}</div>
                    </div>
                  </div>
                  <a
                    href={rawUrl(book.path)}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 px-4 py-2 rounded-lg bg-shelf-soft text-shelf font-semibold text-xs flex items-center gap-1.5 hover:bg-shelf hover:text-white transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </a>
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      <footer className="text-center pb-6">
        <a href="/admin" className="text-[11px] text-muted/60 hover:text-muted transition-colors">
          admin
        </a>
      </footer>
    </div>
  );
}
