'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';

export interface PreviewFeedback {
  x: number;
  y: number;
  viewport: { width: number; height: number };
  userText: string;
  screenshotCrop?: string | null;
}

interface LivePreviewOverlayProps {
  enabled: boolean;
  onFeedback: (feedback: PreviewFeedback) => void;
}

export default function LivePreviewOverlay({ enabled, onFeedback }: LivePreviewOverlayProps) {
  const [box, setBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [text, setText] = useState('');

  if (!enabled) return null;

  return (
    <div
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        setBox({ x: Math.max(0, x - 48), y: Math.max(0, y - 32), width: 96, height: 64 });
      }}
      style={{ position: 'absolute', inset: 0, zIndex: 5, cursor: 'crosshair', background: 'rgba(79,191,168,0.04)' }}
    >
      {box && (
        <>
          <motion.div
            layout
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              position: 'absolute',
              left: box.x,
              top: box.y,
              width: box.width,
              height: box.height,
              border: '2px solid var(--color-accent-teal)',
              borderRadius: 8,
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.08)'
            }}
          />
          <div
            onClick={(event) => event.stopPropagation()}
            style={{ position: 'absolute', left: box.x, top: box.y + box.height + 8, width: 280, padding: 10, border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-surface)', boxShadow: 'var(--shadow-md)' }}
          >
            <input
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="What should I change about this?"
              style={{ width: '100%', border: '1px solid var(--color-border)', borderRadius: 6, padding: '8px 10px', fontSize: 13, marginBottom: 8 }}
            />
            <button
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={() => {
                onFeedback({
                  x: box.x + box.width / 2,
                  y: box.y + box.height / 2,
                  viewport: { width: window.innerWidth, height: window.innerHeight },
                  userText: text,
                  screenshotCrop: null
                });
                setText('');
                setBox(null);
              }}
            >
              Send to Designer
            </button>
          </div>
        </>
      )}
    </div>
  );
}
