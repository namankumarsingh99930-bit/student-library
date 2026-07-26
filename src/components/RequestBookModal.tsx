import React, { useState } from 'react';
import { X, Send, BookMarked } from 'lucide-react';

interface RequestBookModalProps {
  onClose: () => void;
}

export default function RequestBookModal({ onClose }: RequestBookModalProps) {
  const [bookName, setBookName] = useState('');
  const [subject, setSubject] = useState('');
  const [notes, setNotes] = useState('');

  const handleSend = () => {
    if (!bookName.trim()) return;
    const subjectLine = encodeURIComponent(`Book request: ${bookName}`);
    const body = encodeURIComponent(
      `Book name: ${bookName}\nSubject: ${subject || 'Not specified'}\nNotes: ${notes || '—'}`
    );
    window.location.href = `mailto:namankumarsingh99@gmail.com?subject=${subjectLine}&body=${body}`;
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white border border-line rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <div className="flex items-center gap-2">
            <BookMarked className="w-4 h-4 text-shelf" />
            <span className="font-display font-semibold text-sm">Request a Book</span>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <p className="text-xs text-muted">
            Can't find a book you need? Tell us and we'll try to add it.
          </p>

          <input
            type="text"
            value={bookName}
            onChange={(e) => setBookName(e.target.value)}
            placeholder="Book name *"
            className="w-full px-3.5 py-2.5 rounded-xl border border-line text-sm focus:outline-none focus:border-shelf focus:ring-1 focus:ring-shelf"
          />
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject (optional)"
            className="w-full px-3.5 py-2.5 rounded-xl border border-line text-sm focus:outline-none focus:border-shelf focus:ring-1 focus:ring-shelf"
          />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any extra details (optional)"
            rows={3}
            className="w-full px-3.5 py-2.5 rounded-xl border border-line text-sm focus:outline-none focus:border-shelf focus:ring-1 focus:ring-shelf resize-none"
          />

          <button
            onClick={handleSend}
            disabled={!bookName.trim()}
            className="w-full py-2.5 rounded-xl bg-shelf hover:bg-shelf/90 disabled:opacity-40 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            Send Request
          </button>
        </div>
      </div>
    </div>
  );
}
