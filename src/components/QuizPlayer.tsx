import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Loader2, AlertCircle, RotateCcw, Megaphone } from 'lucide-react';
import { fetchQuizContent, QuizContent } from '../lib/github';
import { openPopunder } from '../lib/ads';

interface QuizPlayerProps {
  path: string;
  onExit: () => void;
}

type Stage = 'loading' | 'error' | 'intro' | 'playing' | 'adbreak' | 'result';

export default function QuizPlayer({ path, onExit }: QuizPlayerProps) {
  const [quiz, setQuiz] = useState<QuizContent | null>(null);
  const [stage, setStage] = useState<Stage>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);

  useEffect(() => {
    fetchQuizContent(path)
      .then((data) => {
        setQuiz(data);
        setStage('intro');
      })
      .catch((err) => {
        setErrorMsg(err.message || 'Could not load this quiz.');
        setStage('error');
      });
  }, [path]);

  const startQuiz = () => {
    openPopunder();
    setStage('playing');
  };

  const handleSelect = (optIndex: number) => {
    if (selected !== null) return;
    setSelected(optIndex);
    if (quiz && optIndex === quiz.questions[index].correctIndex) {
      setScore((s) => s + 1);
    }
  };

  const goNext = () => {
    if (!quiz) return;
    const nextIndex = index + 1;

    if (nextIndex >= quiz.questions.length) {
      openPopunder();
      setStage('result');
      return;
    }

    // Ad break every 10 questions
    if (nextIndex % 10 === 0) {
      setIndex(nextIndex);
      setSelected(null);
      openPopunder();
      setStage('adbreak');
      return;
    }

    setIndex(nextIndex);
    setSelected(null);
  };

  const restart = () => {
    setIndex(0);
    setSelected(null);
    setScore(0);
    setStage('intro');
  };

  if (stage === 'loading') {
    return (
      <div className="flex items-center gap-2 text-muted text-sm py-16">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading quiz…
      </div>
    );
  }

  if (stage === 'error') {
    return (
      <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3 max-w-md">
        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
        <span>{errorMsg}</span>
      </div>
    );
  }

  if (!quiz) return null;

  if (stage === 'intro') {
    return (
      <div className="max-w-md">
        <h1 className="font-display font-semibold text-2xl mb-2">{quiz.title}</h1>
        <p className="text-muted text-sm mb-6">
          {quiz.questions.length} questions · {quiz.subject}
        </p>
        <button
          onClick={startQuiz}
          className="px-6 py-3 rounded-xl bg-shelf hover:bg-shelf/90 text-white font-semibold text-sm transition-colors"
        >
          Start Quiz
        </button>
      </div>
    );
  }

  if (stage === 'adbreak') {
    return (
      <div className="max-w-md text-center py-10">
        <div className="w-14 h-14 rounded-xl bg-index-soft flex items-center justify-center mx-auto mb-4 text-index">
          <Megaphone className="w-6 h-6" />
        </div>
        <p className="text-sm text-muted mb-6">
          Quick break — an ad opened in a new tab. Come back here to continue your quiz.
        </p>
        <button
          onClick={() => setStage('playing')}
          className="px-6 py-2.5 rounded-xl bg-shelf hover:bg-shelf/90 text-white font-semibold text-sm transition-colors"
        >
          Continue Quiz
        </button>
      </div>
    );
  }

  if (stage === 'result') {
    return (
      <div className="max-w-md text-center py-10">
        <h2 className="font-display font-semibold text-2xl mb-2">Quiz Complete!</h2>
        <p className="text-4xl font-display font-semibold text-shelf mb-2">
          {score}/{quiz.questions.length}
        </p>
        <p className="text-muted text-sm mb-6">
          {score === quiz.questions.length ? 'Perfect score!' : 'Good effort — try again to improve.'}
        </p>
        <div className="flex items-center justify-center gap-2.5">
          <button
            onClick={restart}
            className="px-5 py-2.5 rounded-xl bg-shelf hover:bg-shelf/90 text-white font-semibold text-sm flex items-center gap-2 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Try Again
          </button>
          <button
            onClick={onExit}
            className="px-5 py-2.5 rounded-xl border border-line text-muted hover:text-ink transition-colors text-sm font-semibold"
          >
            Exit
          </button>
        </div>
      </div>
    );
  }

  // stage === 'playing'
  const q = quiz.questions[index];
  return (
    <div className="max-w-md">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-mono text-muted">
          Question {index + 1} of {quiz.questions.length}
        </span>
        <span className="text-xs font-mono text-muted">Score: {score}</span>
      </div>

      <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden mb-6">
        <div
          className="h-full bg-shelf transition-all duration-300"
          style={{ width: `${((index + 1) / quiz.questions.length) * 100}%` }}
        />
      </div>

      <h2 className="font-display font-semibold text-lg mb-5 leading-snug">{q.question}</h2>

      <div className="space-y-2.5 mb-6">
        {q.options.map((opt, i) => {
          const isCorrect = i === q.correctIndex;
          const isSelected = i === selected;
          let cls = 'border-line hover:border-shelf/40';
          if (selected !== null) {
            if (isCorrect) cls = 'border-emerald-400 bg-emerald-50';
            else if (isSelected) cls = 'border-red-300 bg-red-50';
          }
          return (
            <button
              key={i}
              onClick={() => handleSelect(i)}
              disabled={selected !== null}
              className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium flex items-center justify-between transition-colors ${cls}`}
            >
              <span>{opt}</span>
              {selected !== null && isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
              {selected !== null && isSelected && !isCorrect && <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
            </button>
          );
        })}
      </div>

      {selected !== null && (
        <button
          onClick={goNext}
          className="px-6 py-2.5 rounded-xl bg-shelf hover:bg-shelf/90 text-white font-semibold text-sm transition-colors"
        >
          {index + 1 >= quiz.questions.length ? 'See Result' : 'Next Question'}
        </button>
      )}
    </div>
  );
}
