import React, { useEffect, useState } from 'react';
import { ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react';
import { fetchRating, submitRating, hasRatedLocally, markRatedLocally, RatingCounts } from '../lib/social';
import { openPopunder } from '../lib/ads';

interface BookRatingProps {
  bookPath: string;
}

export default function BookRating({ bookPath }: BookRatingProps) {
  const [counts, setCounts] = useState<RatingCounts>({ up: 0, down: 0 });
  const [loading, setLoading] = useState(true);
  const [voted, setVoted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setVoted(hasRatedLocally(bookPath));
    fetchRating(bookPath)
      .then(setCounts)
      .finally(() => setLoading(false));
  }, [bookPath]);

  const handleVote = async (vote: 'up' | 'down') => {
    if (voted || submitting) return;
    setSubmitting(true);
    openPopunder();
    try {
      const updated = await submitRating(bookPath, vote);
      setCounts(updated);
      markRatedLocally(bookPath);
      setVoted(true);
    } catch {
      // ignore — rating is best-effort
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <Loader2 className="w-3.5 h-3.5 animate-spin text-muted" />;
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted">Helpful?</span>
      <button
        onClick={() => handleVote('up')}
        disabled={voted || submitting}
        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
          voted ? 'text-muted' : 'text-shelf hover:bg-shelf-soft'
        }`}
      >
        <ThumbsUp className="w-3.5 h-3.5" />
        {counts.up}
      </button>
      <button
        onClick={() => handleVote('down')}
        disabled={voted || submitting}
        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
          voted ? 'text-muted' : 'text-muted hover:bg-red-50 hover:text-red-500'
        }`}
      >
        <ThumbsDown className="w-3.5 h-3.5" />
        {counts.down}
      </button>
    </div>
  );
}
