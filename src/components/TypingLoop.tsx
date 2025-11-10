'use client';

import { useEffect, useMemo, useState } from 'react';

type Props = {
  texts: string[] | string;
  className?: string;
  typingMs?: number;     // delay between typed characters
  deletingMs?: number;   // delay between deleted characters
  holdFullMs?: number;   // pause when fully typed
  holdEmptyMs?: number;  // pause when fully deleted
};

export default function TypingLoop({
  texts,
  className,
  typingMs = 120,     // was 70 → slower typing
  deletingMs = 70,    // was 45 → slower deleting
  holdFullMs = 1800,  // was 1000 → longer before backspace
  holdEmptyMs = 900,  // was 600 → longer at empty
}: Props) {
  const phrases = useMemo(() => (Array.isArray(texts) ? texts : [texts]), [texts]);

  const [index, setIndex] = useState(0);
  const [len, setLen] = useState(0);
  const [deleting, setDeleting] = useState(false);

  const full = phrases[index] ?? "";
  const doneTyping = len === full.length;
  const doneDeleting = len === 0;

  useEffect(() => {
    let t: number;

    if (!deleting && !doneTyping) {
      t = window.setTimeout(() => setLen((n) => n + 1), typingMs);
    } else if (!deleting && doneTyping) {
      t = window.setTimeout(() => setDeleting(true), holdFullMs);
    } else if (deleting && !doneDeleting) {
      t = window.setTimeout(() => setLen((n) => n - 1), deletingMs);
    } else if (deleting && doneDeleting) {
      t = window.setTimeout(() => {
        setDeleting(false);
        setIndex((n) => (n + 1) % phrases.length);
      }, holdEmptyMs);
    }

    return () => clearTimeout(t);
  }, [
    len,
    index,
    deleting,
    doneTyping,
    doneDeleting,
    typingMs,
    deletingMs,
    holdFullMs,
    holdEmptyMs,
    phrases.length,
  ]);

  useEffect(() => {
    if (len > full.length) setLen(full.length);
  }, [full.length, len]);

  return (
    <span className={`typing-loop ${className ?? ''}`} aria-label={full} role="text">
      {full.slice(0, len)}
      <span className="typing-caret" aria-hidden="true" />
    </span>
  );
}