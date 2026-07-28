import React, { useState, useEffect, useCallback } from 'react';
import {
  Lock,
  Unlock,
  KeyRound,
  Upload,
  BookOpen,
  Trash2,
  Code2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  FileText,
  LogOut,
  Copy,
  Check,
  Download,
  ImagePlus,
  HelpCircle,
  Plus,
  X,
} from 'lucide-react';
import { fetchLibrary, humanizeTitle, formatSize, colorForSubject, LibraryData, fetchQuizIndex, QuizIndex } from './lib/github';
import { getAllSourceFiles, SourceFile } from './data/sourceCode';

type Tab = 'upload' | 'cover' | 'quiz' | 'manage' | 'code';

const MAX_RECOMMENDED_SIZE = 4 * 1024 * 1024; // 4MB — Netlify function payload limits apply above this; use manual GitHub upload for bigger files

export default function Admin() {
  const [password, setPassword] = useState('');
  const [isAuthed, setIsAuthed] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    const saved = sessionStorage.getItem('admin_pw');
    if (saved) {
      setIsAuthed(true);
      setPassword(saved);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        sessionStorage.setItem('admin_pw', password);
        setIsAuthed(true);
      } else {
        setAuthError(data.error || 'Incorrect password.');
      }
    } catch {
      setAuthError('Network error — try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('admin_pw');
    setIsAuthed(false);
    setPassword('');
  };

  if (!isAuthed) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center px-5">
        <div className="w-full max-w-xs">
          <div className="w-12 h-12 rounded-xl bg-shelf-soft flex items-center justify-center mx-auto mb-5 text-shelf">
            <KeyRound className="w-6 h-6" />
          </div>
          <h1 className="font-display font-semibold text-xl text-center mb-1">Admin Access</h1>
          <p className="text-muted text-sm text-center mb-6">Enter the admin password to continue.</p>

          <form onSubmit={handleLogin} className="space-y-3">
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setAuthError('');
              }}
              placeholder="Password"
              className="w-full px-4 py-3 rounded-xl border border-line text-sm text-center font-mono focus:outline-none focus:border-shelf focus:ring-1 focus:ring-shelf transition-colors"
              autoFocus
            />
            {authError && (
              <p className="text-xs text-red-600 text-center font-medium">{authError}</p>
            )}
            <button
              type="submit"
              disabled={authLoading || !password}
              className="w-full py-3 rounded-xl bg-shelf hover:bg-shelf/90 disabled:opacity-40 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
            >
              {authLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
              <span>Unlock</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <AdminDashboard password={password} onLogout={handleLogout} />;
}

function AdminDashboard({ password, onLogout }: { password: string; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('upload');

  return (
    <div className="min-h-screen bg-paper text-ink font-body">
      <header className="max-w-4xl mx-auto px-5 sm:px-8 py-6 flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-lg bg-shelf flex items-center justify-center shrink-0">
          <BookOpen className="w-4.5 h-4.5 text-white" strokeWidth={2.2} />
        </div>
        <div>
          <div className="font-display font-semibold text-lg leading-none">StudyShelf Admin</div>
        </div>
        <button
          onClick={onLogout}
          className="ml-auto flex items-center gap-1.5 text-xs text-muted hover:text-ink transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Log out
        </button>
      </header>

      <nav className="max-w-4xl mx-auto px-5 sm:px-8 flex gap-2 mb-6">
        {[
          { id: 'upload' as Tab, label: 'Upload Book', icon: Upload },
          { id: 'cover' as Tab, label: 'Add Cover', icon: ImagePlus },
          { id: 'quiz' as Tab, label: 'Add Quiz', icon: HelpCircle },
          { id: 'manage' as Tab, label: 'Manage Library', icon: BookOpen },
          { id: 'code' as Tab, label: 'Source Code', icon: Code2 },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
              tab === id ? 'bg-shelf text-white' : 'bg-stone-50 text-muted hover:bg-stone-100'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </nav>

      <main className="max-w-4xl mx-auto px-5 sm:px-8 pb-24">
        {tab === 'upload' && <UploadTab password={password} />}
        {tab === 'cover' && <CoverTab password={password} />}
        {tab === 'quiz' && <QuizTab password={password} />}
        {tab === 'manage' && <ManageTab password={password} />}
        {tab === 'code' && <CodeTab />}
      </main>
    </div>
  );
}

function UploadTab({ password }: { password: string }) {
  const [library, setLibrary] = useState<LibraryData | null>(null);
  const [subjectMode, setSubjectMode] = useState<'existing' | 'new'>('existing');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const loadLibrary = useCallback(() => {
    fetchLibrary().then(setLibrary).catch(() => {});
  }, []);

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  const subject = subjectMode === 'existing' ? selectedSubject : newSubject.trim();

  const handleUpload = async () => {
    if (!file || !subject) return;
    setStatus('uploading');
    setMessage('');

    try {
      const base64Content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = () => reject(new Error('Could not read file.'));
        reader.readAsDataURL(file);
      });

      const res = await fetch('/api/admin/upload-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, subject, filename: file.name, base64Content }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setStatus('error');
        setMessage(data.error || 'Upload failed.');
        return;
      }

      setStatus('success');
      setMessage(`"${file.name}" uploaded to ${subject}.`);
      setFile(null);
      loadLibrary();
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message || 'Upload failed.');
    }
  };

  return (
    <div className="max-w-md space-y-5">
      <div>
        <label className="text-xs font-semibold text-muted uppercase tracking-wide">Subject</label>
        <div className="flex gap-2 mt-2 mb-2">
          <button
            onClick={() => setSubjectMode('existing')}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
              subjectMode === 'existing' ? 'bg-shelf text-white' : 'bg-stone-50 text-muted'
            }`}
          >
            Existing folder
          </button>
          <button
            onClick={() => setSubjectMode('new')}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
              subjectMode === 'new' ? 'bg-shelf text-white' : 'bg-stone-50 text-muted'
            }`}
          >
            + New folder
          </button>
        </div>

        {subjectMode === 'existing' ? (
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-line text-sm focus:outline-none focus:border-shelf"
          >
            <option value="">Select a subject…</option>
            {library?.subjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
            placeholder="e.g. Mathematics"
            className="w-full px-3.5 py-2.5 rounded-xl border border-line text-sm focus:outline-none focus:border-shelf"
          />
        )}
      </div>

      <div>
        <label className="text-xs font-semibold text-muted uppercase tracking-wide">PDF file</label>
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="mt-2 w-full text-xs file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-shelf-soft file:text-shelf file:font-semibold file:text-xs"
        />
        {file && file.size > MAX_RECOMMENDED_SIZE && (
          <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 flex items-start gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              This file is {formatSize(file.size)}. Files over ~4 MB may fail here — for bigger books, upload them
              directly on GitHub instead (they'll still show up in the library automatically).
            </span>
          </p>
        )}
      </div>

      <button
        onClick={handleUpload}
        disabled={!file || !subject || status === 'uploading'}
        className="w-full py-3 rounded-xl bg-shelf hover:bg-shelf/90 disabled:opacity-40 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
      >
        {status === 'uploading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        <span>{status === 'uploading' ? 'Uploading…' : 'Upload Book'}</span>
      </button>

      {status === 'success' && (
        <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2.5 flex items-start gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{message}</span>
        </p>
      )}
      {status === 'error' && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{message}</span>
        </p>
      )}
    </div>
  );
}

function CoverTab({ password }: { password: string }) {
  const [library, setLibrary] = useState<LibraryData | null>(null);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedBook, setSelectedBook] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const loadLibrary = useCallback(() => {
    fetchLibrary().then(setLibrary).catch(() => {});
  }, []);

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  const booksInSubject = library ? library.books.filter((b) => b.subject === selectedSubject) : [];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const handleUpload = async () => {
    if (!file || !selectedSubject || !selectedBook) return;
    setStatus('uploading');
    setMessage('');

    try {
      const base64Content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = () => reject(new Error('Could not read image.'));
        reader.readAsDataURL(file);
      });

      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();

      const res = await fetch('/api/admin/upload-cover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          subject: selectedSubject,
          bookFilename: selectedBook,
          ext,
          base64Content,
        }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setStatus('error');
        setMessage(data.error || 'Cover upload failed.');
        return;
      }

      setStatus('success');
      setMessage('Cover added! It may take a minute to show on the site.');
      setFile(null);
      setPreview(null);
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message || 'Cover upload failed.');
    }
  };

  return (
    <div className="max-w-md space-y-5">
      <p className="text-xs text-muted">
        Attach a cover picture to an existing book — students will see the picture and title together instead of a
        plain file icon. This never affects downloads or ads.
      </p>

      <div>
        <label className="text-xs font-semibold text-muted uppercase tracking-wide">Subject</label>
        <select
          value={selectedSubject}
          onChange={(e) => {
            setSelectedSubject(e.target.value);
            setSelectedBook('');
          }}
          className="mt-2 w-full px-3.5 py-2.5 rounded-xl border border-line text-sm focus:outline-none focus:border-shelf"
        >
          <option value="">Select a subject…</option>
          {library?.subjects.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {selectedSubject && (
        <div>
          <label className="text-xs font-semibold text-muted uppercase tracking-wide">Book</label>
          <select
            value={selectedBook}
            onChange={(e) => setSelectedBook(e.target.value)}
            className="mt-2 w-full px-3.5 py-2.5 rounded-xl border border-line text-sm focus:outline-none focus:border-shelf"
          >
            <option value="">Select a book…</option>
            {booksInSubject.map((b) => (
              <option key={b.path} value={b.name}>
                {humanizeTitle(b.name)}
                {b.coverPath ? ' (has cover)' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {selectedBook && (
        <div>
          <label className="text-xs font-semibold text-muted uppercase tracking-wide">Cover image</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="mt-2 w-full text-xs file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-shelf-soft file:text-shelf file:font-semibold file:text-xs"
          />
          {preview && (
            <img src={preview} alt="Preview" className="mt-3 w-32 h-40 object-cover rounded-lg border border-line" />
          )}
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={!file || !selectedSubject || !selectedBook || status === 'uploading'}
        className="w-full py-3 rounded-xl bg-shelf hover:bg-shelf/90 disabled:opacity-40 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
      >
        {status === 'uploading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
        <span>{status === 'uploading' ? 'Uploading…' : 'Add Cover'}</span>
      </button>

      {status === 'success' && (
        <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2.5 flex items-start gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{message}</span>
        </p>
      )}
      {status === 'error' && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{message}</span>
        </p>
      )}
    </div>
  );
}

interface QuizQuestionDraft {
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
}

function emptyQuestion(): QuizQuestionDraft {
  return { question: '', options: ['', '', '', ''], correctIndex: 0 };
}

function QuizTab({ password }: { password: string }) {
  const [quizIndex, setQuizIndex] = useState<QuizIndex | null>(null);
  const [subjectMode, setSubjectMode] = useState<'existing' | 'new'>('existing');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [quizTitle, setQuizTitle] = useState('');
  const [questions, setQuestions] = useState<QuizQuestionDraft[]>([emptyQuestion()]);
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [entryMode, setEntryMode] = useState<'oneByOne' | 'bulk'>('oneByOne');
  const [bulkText, setBulkText] = useState('');
  const [bulkError, setBulkError] = useState('');

  const loadQuizIndex = useCallback(() => {
    fetchQuizIndex().then(setQuizIndex).catch(() => {});
  }, []);

  useEffect(() => {
    loadQuizIndex();
  }, [loadQuizIndex]);

  const subject = subjectMode === 'existing' ? selectedSubject : newSubject.trim();

  const parseBulkText = (text: string): QuizQuestionDraft[] => {
    const blocks = text
      .split(/\n\s*\n/)
      .map((b) => b.trim())
      .filter(Boolean);

    const parsed: QuizQuestionDraft[] = [];
    for (const block of blocks) {
      const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
      if (lines.length < 5) continue;

      const qLine = lines[0].replace(/^Q[:.)]\s*/i, '').trim();
      const optionLines = lines.slice(1, 5);
      const options: string[] = [];
      let correctIndex = 0;

      optionLines.forEach((line, i) => {
        let text = line.replace(/^[A-D][:.)]\s*/i, '').trim();
        if (text.endsWith('*')) {
          correctIndex = i;
          text = text.slice(0, -1).trim();
        }
        options.push(text);
      });

      if (qLine && options.length === 4 && options.every((o) => o)) {
        parsed.push({ question: qLine, options: options as [string, string, string, string], correctIndex });
      }
    }
    return parsed;
  };

  const handleLoadBulk = () => {
    setBulkError('');
    const parsed = parseBulkText(bulkText);
    if (parsed.length === 0) {
      setBulkError('Could not find any valid questions. Check the format and try again.');
      return;
    }
    setQuestions(parsed);
    setEntryMode('oneByOne');
  };

  const updateQuestion = (idx: number, patch: Partial<QuizQuestionDraft>) => {
    setQuestions((qs) => qs.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  };

  const updateOption = (qIdx: number, oIdx: number, value: string) => {
    setQuestions((qs) =>
      qs.map((q, i) => {
        if (i !== qIdx) return q;
        const options = [...q.options] as [string, string, string, string];
        options[oIdx] = value;
        return { ...q, options };
      })
    );
  };

  const addQuestion = () => setQuestions((qs) => [...qs, emptyQuestion()]);
  const removeQuestion = (idx: number) => setQuestions((qs) => qs.filter((_, i) => i !== idx));

  const isValid =
    subject &&
    quizTitle.trim() &&
    questions.length > 0 &&
    questions.every((q) => q.question.trim() && q.options.every((o) => o.trim()));

  const handlePublish = async () => {
    if (!isValid) return;
    setStatus('saving');
    setMessage('');
    try {
      const res = await fetch('/api/admin/upload-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          subject,
          quizTitle: quizTitle.trim(),
          questions,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setStatus('error');
        setMessage(data.error || 'Could not publish quiz.');
        return;
      }
      setStatus('success');
      setMessage(`Quiz "${quizTitle}" published to ${subject}.`);
      setQuizTitle('');
      setQuestions([emptyQuestion()]);
      loadQuizIndex();
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message || 'Could not publish quiz.');
    }
  };

  return (
    <div className="max-w-lg space-y-5">
      <div>
        <label className="text-xs font-semibold text-muted uppercase tracking-wide">Subject</label>
        <div className="flex gap-2 mt-2 mb-2">
          <button
            onClick={() => setSubjectMode('existing')}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
              subjectMode === 'existing' ? 'bg-shelf text-white' : 'bg-stone-50 text-muted'
            }`}
          >
            Existing folder
          </button>
          <button
            onClick={() => setSubjectMode('new')}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
              subjectMode === 'new' ? 'bg-shelf text-white' : 'bg-stone-50 text-muted'
            }`}
          >
            + New folder
          </button>
        </div>
        {subjectMode === 'existing' ? (
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-line text-sm focus:outline-none focus:border-shelf"
          >
            <option value="">Select a subject…</option>
            {quizIndex?.subjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
            placeholder="e.g. Mathematics"
            className="w-full px-3.5 py-2.5 rounded-xl border border-line text-sm focus:outline-none focus:border-shelf"
          />
        )}
      </div>

      <div>
        <label className="text-xs font-semibold text-muted uppercase tracking-wide">Quiz title</label>
        <input
          type="text"
          value={quizTitle}
          onChange={(e) => setQuizTitle(e.target.value)}
          placeholder="e.g. Algebra Basics"
          className="mt-2 w-full px-3.5 py-2.5 rounded-xl border border-line text-sm focus:outline-none focus:border-shelf"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setEntryMode('oneByOne')}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
            entryMode === 'oneByOne' ? 'bg-shelf text-white' : 'bg-stone-50 text-muted'
          }`}
        >
          One by one
        </button>
        <button
          onClick={() => setEntryMode('bulk')}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
            entryMode === 'bulk' ? 'bg-shelf text-white' : 'bg-stone-50 text-muted'
          }`}
        >
          Bulk paste
        </button>
      </div>

      {entryMode === 'bulk' && (
        <div className="space-y-2.5">
          <p className="text-xs text-muted leading-relaxed bg-stone-50 border border-line rounded-lg px-3 py-2.5">
            Paste questions in this format — put a <strong>*</strong> right after the correct option, and leave one
            blank line between questions:
            <br />
            <span className="font-mono text-[11px] block mt-1.5 whitespace-pre-line">
              {'Q: Question text?\nA) Option 1\nB) Option 2 *\nC) Option 3\nD) Option 4'}
            </span>
          </p>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            rows={10}
            placeholder={'Q: Question text?\nA) Option 1\nB) Option 2 *\nC) Option 3\nD) Option 4\n\nQ: Next question?\nA) ...\nB) ...\nC) ...\nD) ...'}
            className="w-full px-3.5 py-2.5 rounded-xl border border-line text-xs font-mono focus:outline-none focus:border-shelf resize-none"
          />
          {bulkError && <p className="text-xs text-red-600">{bulkError}</p>}
          <button
            onClick={handleLoadBulk}
            disabled={!bulkText.trim()}
            className="w-full py-2.5 rounded-xl bg-shelf hover:bg-shelf/90 disabled:opacity-40 text-white font-semibold text-xs transition-colors"
          >
            Load Questions
          </button>
        </div>
      )}

      {entryMode === 'oneByOne' && (
      <div className="space-y-4">
        <label className="text-xs font-semibold text-muted uppercase tracking-wide">Questions</label>
        {questions.map((q, qIdx) => (
          <div key={qIdx} className="border border-line rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted">Question {qIdx + 1}</span>
              {questions.length > 1 && (
                <button onClick={() => removeQuestion(qIdx)} className="text-red-500 hover:text-red-700">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <input
              type="text"
              value={q.question}
              onChange={(e) => updateQuestion(qIdx, { question: e.target.value })}
              placeholder="Question text"
              className="w-full px-3 py-2 rounded-lg border border-line text-sm focus:outline-none focus:border-shelf"
            />
            {q.options.map((opt, oIdx) => (
              <div key={oIdx} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`correct-${qIdx}`}
                  checked={q.correctIndex === oIdx}
                  onChange={() => updateQuestion(qIdx, { correctIndex: oIdx })}
                  className="shrink-0"
                />
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => updateOption(qIdx, oIdx, e.target.value)}
                  placeholder={`Option ${oIdx + 1}`}
                  className="flex-1 px-3 py-1.5 rounded-lg border border-line text-xs focus:outline-none focus:border-shelf"
                />
              </div>
            ))}
            <p className="text-[10px] text-muted">Select the radio button next to the correct option.</p>
          </div>
        ))}

        <button
          onClick={addQuestion}
          className="w-full py-2.5 rounded-xl border border-dashed border-line text-muted hover:border-shelf hover:text-shelf transition-colors text-xs font-semibold flex items-center justify-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Question
        </button>
      </div>
      )}

      <button
        onClick={handlePublish}
        disabled={!isValid || status === 'saving'}
        className="w-full py-3 rounded-xl bg-shelf hover:bg-shelf/90 disabled:opacity-40 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
      >
        {status === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : <HelpCircle className="w-4 h-4" />}
        <span>{status === 'saving' ? 'Publishing…' : 'Publish Quiz'}</span>
      </button>

      {status === 'success' && (
        <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2.5 flex items-start gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{message}</span>
        </p>
      )}
      {status === 'error' && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{message}</span>
        </p>
      )}
    </div>
  );
}

function ManageTab({ password }: { password: string }) {
  const [library, setLibrary] = useState<LibraryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchLibrary()
      .then(setLibrary)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (path: string) => {
    setDeletingPath(path);
    try {
      const res = await fetch('/api/admin/delete-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, path }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        load();
      }
    } finally {
      setDeletingPath(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted text-sm py-10">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading library…
      </div>
    );
  }

  if (!library || library.books.length === 0) {
    return <p className="text-muted text-sm">No books uploaded yet.</p>;
  }

  return (
    <div className="space-y-6">
      {library.subjects.map((subject) => {
        const subjectBooks = library.books.filter((b) => b.subject === subject);
        if (subjectBooks.length === 0) return null;
        return (
          <div key={subject}>
            <div className="flex items-center gap-2 mb-2.5">
              <span className="w-2 h-5 rounded-sm" style={{ backgroundColor: colorForSubject(subject) }} />
              <h3 className="font-display font-semibold text-sm">{subject}</h3>
              <span className="text-[11px] text-muted font-mono">{subjectBooks.length}</span>
            </div>
            <div className="space-y-2">
              {subjectBooks.map((book) => (
                <div
                  key={book.path}
                  className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border border-line"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText className="w-4 h-4 text-index shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate">{humanizeTitle(book.name)}</div>
                      <div className="text-[10px] font-mono text-muted">{formatSize(book.size)}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(book.path)}
                    disabled={deletingPath === book.path}
                    className="shrink-0 p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                  >
                    {deletingPath === book.path ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CodeTab() {
  const files: SourceFile[] = getAllSourceFiles();
  const [activeFile, setActiveFile] = useState<SourceFile | null>(null);
  const [copied, setCopied] = useState(false);

  const categories = Array.from(new Set(files.map((f) => f.category)));

  const handleCopy = () => {
    if (!activeFile) return;
    navigator.clipboard.writeText(activeFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!activeFile) return;
    const blob = new Blob([activeFile.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFile.path.split('/').pop() || 'file.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (activeFile) {
    return (
      <div>
        <button
          onClick={() => setActiveFile(null)}
          className="text-xs text-muted hover:text-ink mb-3 font-mono"
        >
          ← Back to files
        </button>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-mono font-semibold">{activeFile.path}</span>
          <div className="flex items-center gap-2">
            <button onClick={handleCopy} className="p-1.5 rounded bg-stone-100 hover:bg-stone-200 text-ink">
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <button onClick={handleDownload} className="p-1.5 rounded bg-shelf-soft hover:bg-shelf/20 text-shelf">
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="bg-stone-950 rounded-xl p-4 max-h-[60vh] overflow-auto">
          <pre className="whitespace-pre-wrap break-all text-[11px] text-stone-200 font-mono">
            <code>{activeFile.content}</code>
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {categories.map((cat) => (
        <div key={cat}>
          <h3 className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">{cat}</h3>
          <div className="space-y-1">
            {files
              .filter((f) => f.category === cat)
              .map((f) => (
                <button
                  key={f.path}
                  onClick={() => setActiveFile(f)}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs font-mono flex items-center gap-2 text-ink hover:bg-stone-50 border border-transparent hover:border-line transition-all"
                >
                  <FileText className="w-3.5 h-3.5 text-shelf shrink-0" />
                  <span className="truncate">{f.path}</span>
                </button>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
