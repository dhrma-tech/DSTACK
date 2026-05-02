import React, { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '64px 24px', textAlign: 'center',
    }}>
      <div style={{ color: 'var(--color-text-muted)', marginBottom: 16 }}>
        {icon || <Inbox size={48} strokeWidth={1} />}
      </div>
      <h3 style={{ fontSize: 18, fontWeight: 600, fontFamily: 'var(--font-sans)', marginBottom: 8 }}>{title}</h3>
      {description && <p style={{ fontSize: 14, color: 'var(--color-text-tertiary)', maxWidth: 400, marginBottom: 20 }}>{description}</p>}
      {actionLabel && onAction && (
        <button className="btn btn-primary" onClick={onAction}>{actionLabel}</button>
      )}
    </div>
  );
}
