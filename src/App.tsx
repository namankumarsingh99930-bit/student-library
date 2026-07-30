import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { BookOpen, Download, Search, FileText, Loader2, AlertCircle, ChevronLeft, Library, Info, Share2, BookMarked, Sparkles, HelpCircle, Star, ThumbsUp, ThumbsDown, X } from 'lucide-react';
import {
  fetchLibrary,
  fetchRecentBookPaths,
  fetchQuizIndex,
  rawUrl,
  humanizeTitle,
  formatSize,
  colorForSubject,
  slugify,
  LibraryData,
  BookEntry,
  QuizEntry,
  QuizIndex,
} from './lib/github';
import SideAdBanner from './components/SideAdBanner';
import RequestBookModal from './components/RequestBookModal';
import QuizPlayer from './components/QuizPlayer';
import BookRating from './components/BookRating';
import {
  isBookmarked,
  toggleBookmark,
  getBookmarks,
  fetchRating,
  submitRating,
  hasRatedLocally,
  markRatedLocally,
  RatingCounts,
} from './lib/social';

import { openPopunder } from './lib/ads';

type Route =
  | { view: 'home' }
  | { view: 'subject'; subject: string }
  | { view: 'book'; subject: string; bookSlug: string }
  | { view: 'quizzes' }
  | { view: 'quizSubject'; subject: string }
  | { view: 'quiz'; path: string }
  | { view: 'bookmarks' };

function parsePathToRoute(pathname: string): Route {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] === 'subject' && parts[1]) {
    const subject = decodeURIComponent(parts[1]);
    if (parts[2]) return { view: 'book', subject, bookSlug: decodeURIComponent(parts[2]) };
    return { view: 'subject', subject };
  }
  if (parts[0] === 'quiz') {
    if (parts[1] && parts[2]) {
      return { view: 'quiz', path: `quizzes/${decodeURIComponent(parts[1])}/${decodeURIComponent(parts[2])}.json` };
    }
    if (parts[1]) return { view: 'quizSubject', subject: decodeURIComponent(parts[1]) };
    return { view: 'quizzes' };
  }
  if (parts[0] === 'bookmarks') return { view: 'bookmarks' };
  return { view: 'home' };
}

function subjectPath(subject: string): string {
  return `/subject/${encodeURIComponent(subject)}`;
}

function bookPath(subject: string, book: BookEntry): string {
  return `/subject/${encodeURIComponent(subject)}/${encodeURIComponent(slugify(humanizeTitle(book.name)))}`;
}

function quizSubjectPath(subject: string): string {
  return `/quiz/${encodeURIComponent(subject)}`;
}

function quizPlayPath(quiz: QuizEntry): string {
  const parts = quiz.path.replace(/\.json$/i, '').split('/');
  return `/quiz/${encodeURIComponent(parts[1])}/${encodeURIComponent(parts[2])}`;
}

function setMetaDescription(content: string) {
  let tag = document.querySelector('meta[name="description"]');
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', 'description');
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

async function handleShare(bookTitle: string) {
  const shareUrl = window.location.href;
  const shareText = `Check out "${bookTitle}" — free PDF on StudyShelf`;

  if (navigator.share) {
    try {
      await navigator.share({ title: shareText, url: shareUrl });
      return;
    } catch {
      // user cancelled or share failed — fall through to WhatsApp link
    }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`, '_blank');
}

async function handleDownload(fileUrl: string, filename: string) {
  openPopunder();

  try {
    const proxyUrl = `/api/download-proxy?url=${encodeURIComponent(fileUrl)}&filename=${encodeURIComponent(filename)}`;
    const res = await fetch(proxyUrl);

    if (!res.ok) {
      throw new Error('Download failed — please try again.');
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('pdf')) {
      throw new Error('This file could not be downloaded right now — please try again.');
    }

    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
  } catch (err: any) {
    alert(err.message || 'Download failed — please try again.');
  }
}

export default function App() {
  const [library, setLibrary] = useState<LibraryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [route, setRoute] = useState<Route>(() => parsePathToRoute(window.location.pathname));
  const [query, setQuery] = useState('');
  const [recentBooks, setRecentBooks] = useState<BookEntry[]>([]);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [quizIndex, setQuizIndex] = useState<QuizIndex | null>(null);
  const [quizIndexLoading, setQuizIndexLoading] = useState(false);
  const [quizIndexError, setQuizIndexError] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [globalQuery, setGlobalQuery] = useState('');
  const [bookmarkVersion, setBookmarkVersion] = useState(0);

  useEffect(() => {
    fetchLibrary()
      .then(setLibrary)
      .catch((err) => setLoadError(err.message || 'Could not load the library.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!library) return;
    fetchRecentBookPaths(5).then((paths) => {
      const matched = paths
        .map((p) => library.books.find((b) => b.path === p))
        .filter((b): b is BookEntry => Boolean(b));
      setRecentBooks(matched);
    });
  }, [library]);

  useEffect(() => {
    const needsQuizIndex = route.view === 'quizzes' || route.view === 'quizSubject' || searchOpen;
    if (!needsQuizIndex || quizIndex) return;
    setQuizIndexLoading(true);
    fetchQuizIndex()
      .then(setQuizIndex)
      .catch((err) => setQuizIndexError(err.message || 'Could not load quizzes.'))
      .finally(() => setQuizIndexLoading(false));
  }, [route, quizIndex, searchOpen]);

  useEffect(() => {
    const onPopState = () => setRoute(parsePathToRoute(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((path: string) => {
    window.history.pushState(null, '', path);
    setRoute(parsePathToRoute(path));
    window.scrollTo(0, 0);
  }, []);

  // Keep the tab title + meta description in sync with the current page — helps SEO and link sharing
  useEffect(() => {
    if (route.view === 'home') {
      document.title = 'StudyShelf — Free Book PDF Download for Students | Notes, Textbooks & Study Material';
      setMetaDescription(
        'StudyShelf is a free student library to download book PDFs, textbooks, notes, and study material by subject.'
      );
    } else if (route.view === 'subject') {
      document.title = `${route.subject} PDFs — Free Download | StudyShelf`;
      setMetaDescription(`Download free ${route.subject} book PDFs, notes, and study material. No sign-up required.`);
    } else if (route.view === 'book' && library) {
      const book = library.books.find(
        (b) => b.subject === route.subject && slugify(humanizeTitle(b.name)) === route.bookSlug
      );
      if (book) {
        document.title = `${humanizeTitle(book.name)} — Free PDF Download | StudyShelf`;
        setMetaDescription(
          `Download "${humanizeTitle(book.name)}" free PDF — a ${route.subject} book available on StudyShelf, a free student library.`
        );
      }
    }
  }, [route, library]);

  const booksInSubject = useMemo(() => {
    if (!library || route.view === 'home') return [];
    const subject = route.subject;
    const list = library.books.filter((b) => b.subject === subject);
    if (!query.trim()) return list;
    const q = query.toLowerCase();
    return list.filter((b) => humanizeTitle(b.name).toLowerCase().includes(q));
  }, [library, route, query]);

  const activeBook = useMemo(() => {
    if (route.view !== 'book' || !library) return null;
    return (
      library.books.find(
        (b) => b.subject === route.subject && slugify(humanizeTitle(b.name)) === route.bookSlug
      ) || null
    );
  }, [route, library]);

  const searchResults = useMemo(() => {
    const q = globalQuery.trim().toLowerCase();
    if (!q) return { books: [] as BookEntry[], quizzes: [] as QuizEntry[] };
    const books = (library?.books || []).filter((b) => humanizeTitle(b.name).toLowerCase().includes(q)).slice(0, 8);
    const quizzes = (quizIndex?.quizzes || []).filter((qz) => qz.title.toLowerCase().includes(q)).slice(0, 5);
    return { books, quizzes };
  }, [globalQuery, library, quizIndex]);

  const bookmarkedBooks = useMemo(() => {
    if (!library) return [];
    const saved = getBookmarks();
    return library.books.filter((b) => saved.includes(b.path));
  }, [library, bookmarkVersion]);

  return (
    <div className="min-h-screen bg-paper text-ink font-body flex flex-col">
      <header className="max-w-5xl mx-auto w-full px-5 sm:px-8 py-6 flex items-center gap-2.5">
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate('/');
          }}
          className="flex items-center gap-2.5"
        >
          <div className="w-9 h-9 rounded-lg bg-shelf flex items-center justify-center shrink-0">
            <BookOpen className="w-4.5 h-4.5 text-white" strokeWidth={2.2} />
          </div>
          <div>
            <div className="font-display font-semibold text-lg leading-none tracking-tight">StudyShelf</div>
            <div className="text-[11px] text-muted mt-0.5">book PDF library</div>
          </div>
        </a>
        <button
          onClick={() => setSearchOpen((v) => !v)}
          className="ml-auto flex items-center justify-center w-8 h-8 rounded-full text-muted hover:bg-stone-100 hover:text-ink transition-colors shrink-0"
          aria-label="Search"
        >
          <Search className="w-4 h-4" />
        </button>
        <a
          href="/bookmarks"
          onClick={(e) => {
            e.preventDefault();
            navigate('/bookmarks');
          }}
          className="flex items-center justify-center w-8 h-8 rounded-full text-muted hover:bg-stone-100 hover:text-ink transition-colors shrink-0"
          aria-label="Bookmarks"
        >
          <Star className="w-4 h-4" />
        </a>
        <a
          href="/quiz"
          onClick={(e) => {
            e.preventDefault();
            navigate('/quiz');
          }}
          className="flex items-center gap-1.5 text-xs font-semibold text-index bg-index-soft px-3 py-1.5 rounded-full hover:bg-index hover:text-white transition-colors shrink-0"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Quizzes</span>
        </a>
        <button
          onClick={() => setShowRequestModal(true)}
          className="flex items-center gap-1.5 text-xs font-semibold text-shelf bg-shelf-soft px-3 py-1.5 rounded-full hover:bg-shelf hover:text-white transition-colors shrink-0"
        >
          <BookMarked className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Request a Book</span>
          <span className="sm:hidden">Request</span>
        </button>
        {library && (
          <span className="text-xs font-mono text-muted hidden lg:flex items-center gap-1.5 ml-3">
            <Library className="w-3.5 h-3.5" />
            {library.subjects.length} subjects · {library.books.length} books
          </span>
        )}
      </header>

      {searchOpen && (
        <div className="max-w-5xl mx-auto w-full px-5 sm:px-8 -mt-2 mb-4">
          <div className="bg-white border border-line rounded-xl shadow-md p-3">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-muted shrink-0" />
              <input
                autoFocus
                type="text"
                value={globalQuery}
                onChange={(e) => setGlobalQuery(e.target.value)}
                placeholder="Search all books and quizzes…"
                className="flex-1 text-sm focus:outline-none"
              />
              <button
                onClick={() => {
                  setSearchOpen(false);
                  setGlobalQuery('');
                }}
                className="text-muted hover:text-ink shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {globalQuery.trim() && (
              <div className="mt-3 border-t border-line pt-3 space-y-1 max-h-72 overflow-y-auto">
                {searchResults.books.length === 0 && searchResults.quizzes.length === 0 && (
                  <p className="text-xs text-muted px-1 py-2">No matches found.</p>
                )}
                {searchResults.books.map((b) => (
                  <a
                    key={b.path}
                    href={bookPath(b.subject, b)}
                    onClick={(e) => {
                      e.preventDefault();
                      setSearchOpen(false);
                      setGlobalQuery('');
                      navigate(bookPath(b.subject, b));
                    }}
                    className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-stone-50 text-sm"
                  >
                    <FileText className="w-3.5 h-3.5 text-index shrink-0" />
                    <span className="truncate">{humanizeTitle(b.name)}</span>
                    <span className="text-[10px] text-muted ml-auto shrink-0">{b.subject}</span>
                  </a>
                ))}
                {searchResults.quizzes.map((qz) => (
                  <a
                    key={qz.path}
                    href={quizPlayPath(qz)}
                    onClick={(e) => {
                      e.preventDefault();
                      setSearchOpen(false);
                      setGlobalQuery('');
                      navigate(quizPlayPath(qz));
                    }}
                    className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-stone-50 text-sm"
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-index shrink-0" />
                    <span className="truncate capitalize">{qz.title}</span>
                    <span className="text-[10px] text-muted ml-auto shrink-0">Quiz · {qz.subject}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showRequestModal && <RequestBookModal onClose={() => setShowRequestModal(false)} />}

      <div className="max-w-5xl mx-auto w-full px-5 sm:px-8 pb-16 flex-1 flex flex-col lg:flex-row gap-8">
        <main className="flex-1 min-w-0">
          <div className="flex items-start gap-2 bg-shelf-soft border border-shelf/20 rounded-xl px-4 py-3 mb-6 text-xs sm:text-sm text-shelf leading-relaxed">
            <Info className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              Tapping <strong>Download</strong> opens an ad in a new tab — just stay on this page, your file will
              start downloading automatically.
            </span>
          </div>

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

          {!loading && !loadError && library && route.view === 'home' && (
            <>
              <a
                href="/quiz"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/quiz');
                }}
                className="group flex items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-index to-amber-500 px-6 py-6 sm:py-7 mb-9 shadow-md hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                    <HelpCircle className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <div className="font-display font-bold text-xl sm:text-2xl text-white leading-tight">
                      Test yourself — Take a Quiz
                    </div>
                    <div className="text-white/90 text-sm mt-0.5">Pick a subject and see how you score</div>
                  </div>
                </div>
                <span className="hidden sm:flex items-center justify-center w-11 h-11 rounded-full bg-white/20 text-white text-xl shrink-0 group-hover:bg-white/30 transition-colors">
                  →
                </span>
              </a>

              {recentBooks.length > 0 && (
                <div className="mb-9">
                  <div className="flex items-center gap-1.5 mb-3">
                    <Sparkles className="w-4 h-4 text-index" />
                    <span className="text-xs font-semibold text-muted uppercase tracking-wide">Recently Added</span>
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
                    {recentBooks.map((book) => (
                      <a
                        key={book.path}
                        href={bookPath(book.subject, book)}
                        onClick={(e) => {
                          e.preventDefault();
                          navigate(bookPath(book.subject, book));
                        }}
                        className="shrink-0 w-32 group"
                      >
                        {book.coverPath ? (
                          <img
                            src={rawUrl(book.coverPath)}
                            alt=""
                            className="w-32 h-40 rounded-lg object-cover border border-line group-hover:border-shelf/40 transition-colors"
                          />
                        ) : (
                          <div className="w-32 h-40 rounded-lg bg-index-soft border border-line flex items-center justify-center group-hover:border-shelf/40 transition-colors">
                            <FileText className="w-6 h-6 text-index" />
                          </div>
                        )}
                        <div className="text-xs font-semibold mt-2 line-clamp-2 leading-snug">
                          {humanizeTitle(book.name)}
                        </div>
                        <div className="text-[10px] text-muted mt-0.5">{book.subject}</div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

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
                    <a
                      key={subject}
                      href={subjectPath(subject)}
                      onClick={(e) => {
                        e.preventDefault();
                        setQuery('');
                        navigate(subjectPath(subject));
                      }}
                      className="group relative flex items-stretch overflow-hidden rounded-lg border border-line hover:border-transparent shadow-sm hover:shadow-md transition-all"
                      style={{ minWidth: '9.5rem' }}
                    >
                      <span className="w-2.5 shrink-0" style={{ backgroundColor: color }} />
                      <span className="flex-1 px-4 py-3.5 text-left bg-white group-hover:bg-stone-50 transition-colors">
                        <span className="block font-display font-semibold text-sm leading-tight">{subject}</span>
                        <span className="block text-[11px] text-muted mt-1 font-mono">{count} books</span>
                      </span>
                    </a>
                  );
                })}
              </div>
            </>
          )}

          {!loading && !loadError && library && route.view === 'subject' && (
            <>
              <a
                href="/"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/');
                }}
                className="flex items-center gap-1 text-sm text-muted hover:text-ink mb-5 transition-colors w-fit"
              >
                <ChevronLeft className="w-4 h-4" />
                All subjects
              </a>

              <div className="flex items-center gap-2.5 mb-6">
                <span className="w-2.5 h-8 rounded-sm" style={{ backgroundColor: colorForSubject(route.subject) }} />
                <h1 className="font-display font-semibold text-2xl sm:text-3xl">{route.subject}</h1>
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

              {booksInSubject.length === 0 && <p className="text-muted text-sm">No books match here yet.</p>}

              <div className="space-y-2.5">
                {booksInSubject.map((book) => (
                  <div
                    key={book.path}
                    className="flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl border border-line hover:border-shelf/40 transition-colors"
                  >
                    <a
                      href={bookPath(route.subject, book)}
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(bookPath(route.subject, book));
                      }}
                      className="flex items-center gap-3 min-w-0 flex-1"
                    >
                      {book.coverPath ? (
                        <img
                          src={rawUrl(book.coverPath)}
                          alt=""
                          className="w-9 h-11 rounded-md object-cover border border-line shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-index-soft flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4 text-index" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate hover:underline">{humanizeTitle(book.name)}</div>
                        <div className="text-[11px] font-mono text-muted mt-0.5">PDF · {formatSize(book.size)}</div>
                      </div>
                    </a>
                    <button
                      onClick={() => {
                        toggleBookmark(book.path);
                        setBookmarkVersion((v) => v + 1);
                      }}
                      className="shrink-0 p-1.5 text-muted hover:text-index transition-colors"
                      aria-label="Bookmark"
                    >
                      <Star
                        className="w-4 h-4"
                        fill={isBookmarked(book.path) ? 'currentColor' : 'none'}
                        style={isBookmarked(book.path) ? { color: '#C08A2E' } : undefined}
                      />
                    </button>
                    <button
                      onClick={() => handleDownload(rawUrl(book.path), book.name)}
                      className="shrink-0 px-4 py-2 rounded-lg bg-shelf-soft text-shelf font-semibold text-xs flex items-center gap-1.5 hover:bg-shelf hover:text-white transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {!loading && !loadError && library && route.view === 'book' && (
            <>
              <a
                href={subjectPath(route.subject)}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(subjectPath(route.subject));
                }}
                className="flex items-center gap-1 text-sm text-muted hover:text-ink mb-5 transition-colors w-fit"
              >
                <ChevronLeft className="w-4 h-4" />
                {route.subject}
              </a>

              {!activeBook && (
                <p className="text-muted text-sm">This book couldn't be found — it may have been removed.</p>
              )}

              {activeBook && (
                <div className="max-w-lg">
                  <span
                    className="inline-block text-[11px] font-semibold px-2.5 py-1 rounded-full mb-4"
                    style={{ backgroundColor: `${colorForSubject(route.subject)}1A`, color: colorForSubject(route.subject) }}
                  >
                    {route.subject}
                  </span>

                  <div className="flex items-start gap-4 mb-6">
                    {activeBook.coverPath ? (
                      <img
                        src={rawUrl(activeBook.coverPath)}
                        alt=""
                        className="w-20 h-28 rounded-xl object-cover border border-line shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-index-soft flex items-center justify-center shrink-0">
                        <FileText className="w-6 h-6 text-index" />
                      </div>
                    )}
                    <div>
                      <h1 className="font-display font-semibold text-xl sm:text-2xl leading-snug">
                        {humanizeTitle(activeBook.name)}
                      </h1>
                      <div className="text-xs font-mono text-muted mt-1.5">PDF · {formatSize(activeBook.size)}</div>
                    </div>
                  </div>

                  <p className="text-sm text-muted leading-relaxed mb-6">
                    Download "{humanizeTitle(activeBook.name)}" free — part of the {route.subject} collection on
                    StudyShelf, a free student library. No sign-up required.
                  </p>

                  <div className="flex items-center gap-2.5 mb-6">
                    <button
                      onClick={() => handleDownload(rawUrl(activeBook.path), activeBook.name)}
                      className="px-6 py-3 rounded-xl bg-shelf hover:bg-shelf/90 text-white font-semibold text-sm flex items-center gap-2 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Download PDF
                    </button>
                    <button
                      onClick={() => handleShare(humanizeTitle(activeBook.name))}
                      className="p-3 rounded-xl border border-line hover:border-shelf/40 text-muted hover:text-shelf transition-colors"
                      aria-label="Share this book"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        toggleBookmark(activeBook.path);
                        setBookmarkVersion((v) => v + 1);
                      }}
                      className="p-3 rounded-xl border border-line hover:border-index/40 text-muted hover:text-index transition-colors"
                      aria-label="Bookmark this book"
                    >
                      <Star
                        className="w-4 h-4"
                        fill={isBookmarked(activeBook.path) ? 'currentColor' : 'none'}
                        style={isBookmarked(activeBook.path) ? { color: '#C08A2E' } : undefined}
                      />
                    </button>
                  </div>

                  <BookRating bookPath={activeBook.path} />
                </div>
              )}
            </>
          )}

          {route.view === 'quizzes' && (
            <>
              <h1 className="font-display font-semibold text-2xl sm:text-3xl mb-1">Quizzes</h1>
              <p className="text-muted text-sm mb-8">Pick a subject and test yourself.</p>

              {quizIndexLoading && (
                <div className="flex items-center gap-2 text-muted text-sm py-10">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading quizzes…
                </div>
              )}
              {quizIndexError && !quizIndexLoading && (
                <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3 max-w-md">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{quizIndexError}</span>
                </div>
              )}
              {quizIndex && quizIndex.subjects.length === 0 && (
                <p className="text-muted text-sm">No quizzes yet — check back soon.</p>
              )}

              <div className="flex flex-wrap gap-3">
                {quizIndex?.subjects.map((subject) => {
                  const color = colorForSubject(subject);
                  const count = quizIndex.quizzes.filter((q) => q.subject === subject).length;
                  return (
                    <a
                      key={subject}
                      href={quizSubjectPath(subject)}
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(quizSubjectPath(subject));
                      }}
                      className="group relative flex items-stretch overflow-hidden rounded-lg border border-line hover:border-transparent shadow-sm hover:shadow-md transition-all"
                      style={{ minWidth: '9.5rem' }}
                    >
                      <span className="w-2.5 shrink-0" style={{ backgroundColor: color }} />
                      <span className="flex-1 px-4 py-3.5 text-left bg-white group-hover:bg-stone-50 transition-colors">
                        <span className="block font-display font-semibold text-sm leading-tight">{subject}</span>
                        <span className="block text-[11px] text-muted mt-1 font-mono">{count} quizzes</span>
                      </span>
                    </a>
                  );
                })}
              </div>
            </>
          )}

          {route.view === 'quizSubject' && (
            <>
              <a
                href="/quiz"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/quiz');
                }}
                className="flex items-center gap-1 text-sm text-muted hover:text-ink mb-5 transition-colors w-fit"
              >
                <ChevronLeft className="w-4 h-4" />
                All quiz subjects
              </a>
              <h1 className="font-display font-semibold text-2xl sm:text-3xl mb-6">{route.subject}</h1>

              {quizIndexLoading && (
                <div className="flex items-center gap-2 text-muted text-sm py-10">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading quizzes…
                </div>
              )}

              <div className="space-y-2.5">
                {quizIndex?.quizzes
                  .filter((q) => q.subject === route.subject)
                  .map((quiz) => (
                    <a
                      key={quiz.path}
                      href={quizPlayPath(quiz)}
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(quizPlayPath(quiz));
                      }}
                      className="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-line hover:border-index/40 transition-colors"
                    >
                      <div className="w-9 h-9 rounded-lg bg-index-soft flex items-center justify-center shrink-0">
                        <HelpCircle className="w-4 h-4 text-index" />
                      </div>
                      <span className="text-sm font-semibold capitalize">{quiz.title}</span>
                    </a>
                  ))}
              </div>
            </>
          )}

          {route.view === 'quiz' && (
            <QuizPlayer path={route.path} onExit={() => navigate('/quiz')} />
          )}

          {route.view === 'bookmarks' && (
            <>
              <h1 className="font-display font-semibold text-2xl sm:text-3xl mb-1">My Bookmarks</h1>
              <p className="text-muted text-sm mb-8">Books you've saved for later.</p>

              {bookmarkedBooks.length === 0 && (
                <p className="text-muted text-sm">
                  No bookmarks yet — tap the star icon on any book to save it here.
                </p>
              )}

              <div className="space-y-2.5">
                {bookmarkedBooks.map((book) => (
                  <div
                    key={book.path}
                    className="flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl border border-line hover:border-shelf/40 transition-colors"
                  >
                    <a
                      href={bookPath(book.subject, book)}
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(bookPath(book.subject, book));
                      }}
                      className="flex items-center gap-3 min-w-0 flex-1"
                    >
                      {book.coverPath ? (
                        <img
                          src={rawUrl(book.coverPath)}
                          alt=""
                          className="w-9 h-11 rounded-md object-cover border border-line shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-index-soft flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4 text-index" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate hover:underline">{humanizeTitle(book.name)}</div>
                        <div className="text-[11px] font-mono text-muted mt-0.5">{book.subject}</div>
                      </div>
                    </a>
                    <button
                      onClick={() => {
                        toggleBookmark(book.path);
                        setBookmarkVersion((v) => v + 1);
                      }}
                      className="shrink-0 p-1.5 text-index"
                      aria-label="Remove bookmark"
                    >
                      <Star className="w-4 h-4" fill="currentColor" />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </main>

        <aside className="w-full lg:w-64 shrink-0 lg:sticky lg:top-6 lg:self-start">
          <span className="text-[10px] text-muted/60 uppercase tracking-wide block mb-2 text-center">Advertisement</span>
          <SideAdBanner />
        </aside>
      </div>

      <footer className="border-t border-line mt-10">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-10">
          <p className="text-sm text-muted leading-relaxed max-w-2xl">
            StudyShelf is a free student library for downloading book PDFs, textbooks, notes, and study material —
            organized by subject so you can find what you need without wasting time. Browse Math, Science, Physics,
            Chemistry, Biology, Computer Science, Engineering, and more, and download any PDF for free with no
            sign-up required.
          </p>

          <div className="mt-6">
            <span className="text-[11px] font-semibold text-muted uppercase tracking-wide">Popular searches</span>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {[
                'free pdf download', 'book pdf', 'textbook pdf free', 'ncert pdf', 'ncert solutions pdf',
                'class 6 pdf', 'class 7 pdf', 'class 8 pdf', 'class 9 pdf', 'class 10 pdf',
                'class 11 pdf', 'class 12 pdf', 'physics pdf', 'chemistry pdf', 'biology pdf',
                'mathematics pdf', 'maths notes pdf', 'computer science pdf', 'engineering notes pdf',
                'engineering ebooks free', 'first year engineering pdf', 'competitive exam books pdf',
                'upsc notes pdf', 'ssc notes pdf', 'jee notes pdf', 'neet notes pdf', 'free study material',
                'student notes download', 'exam preparation pdf', 'previous year question papers pdf',
                'reference books pdf', 'free ebooks download', 'college textbooks pdf', 'school textbooks pdf',
                'english literature pdf', 'history notes pdf', 'geography notes pdf', 'economics notes pdf',
                'accountancy notes pdf', 'business studies pdf', 'programming books pdf', 'python book pdf',
                'data structures pdf', 'algorithms book pdf', 'general knowledge pdf', 'gk notes pdf',
                'aptitude book pdf', 'reasoning book pdf', 'free notes for students', 'study material download',
                'pdf library free', 'download books online free', 'academic pdf resources',
              ].map((term) => (
                <span
                  key={term}
                  className="text-[11px] text-muted/80 bg-stone-50 border border-line rounded-full px-2.5 py-1"
                >
                  {term}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-line flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[11px] text-muted">
            <span>© {new Date().getFullYear()} StudyShelf. Free for students, everywhere.</span>
            <a href="mailto:namankumarsingh99@gmail.com" className="hover:text-ink transition-colors">
              namankumarsingh99@gmail.com
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
