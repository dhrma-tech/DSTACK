'use client';

import React, { useState, useEffect } from 'react';
import { Bookmark, Trash2, Check, Download, Upload } from 'lucide-react';
import { api, type Template } from '@/lib/api';

interface TemplateManagerProps {
  skillName: string;
  currentInputs: Record<string, string>;
  currentFlags: Record<string, boolean | string>;
  onLoadTemplate: (inputs: Record<string, string>, flags: Record<string, boolean | string>) => void;
}

export default function TemplateManager({ skillName, currentInputs, currentFlags, onLoadTemplate }: TemplateManagerProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      api.getTemplates(skillName).then(data => setTemplates(data.templates)).catch(() => null);
    }
  }, [isOpen, skillName]);

  const handleSave = async () => {
    if (!newTemplateName.trim()) return;
    setIsSaving(true);
    try {
      const saved = await api.saveTemplate({
        name: newTemplateName.trim(),
        skillName,
        inputs: currentInputs,
        flags: currentFlags,
      });
      setTemplates(prev => [...prev, saved]);
      setNewTemplateName('');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await api.deleteTemplate(id).catch(() => null);
    setTemplates(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: isOpen ? 'var(--surface-card)' : 'transparent',
          border: '1px solid', borderColor: isOpen ? 'var(--hairline)' : 'transparent',
          borderRadius: 6, padding: '4px 8px', fontSize: 11, fontWeight: 500,
          color: 'var(--muted)', cursor: 'pointer', transition: 'all 0.2s',
        }}
      >
        <Bookmark size={12} /> Templates {templates.length > 0 && `(${templates.length})`}
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 4,
          width: 280, background: '#fff', border: '1px solid var(--hairline)',
          borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          zIndex: 10, overflow: 'hidden',
          animation: 'slideUp 0.15s ease-out'
        }}>
          {/* Save new template */}
          <div style={{ padding: 12, borderBottom: '1px solid var(--hairline)', background: 'var(--canvas)' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                value={newTemplateName}
                onChange={e => setNewTemplateName(e.target.value)}
                placeholder="Name current config..."
                style={{
                  flex: 1, padding: '6px 8px', borderRadius: 4, border: '1px solid var(--hairline)',
                  fontSize: 12, outline: 'none', minWidth: 0,
                }}
              />
              <button
                onClick={handleSave}
                disabled={!newTemplateName.trim() || isSaving}
                style={{
                  background: 'var(--coral)', color: '#fff', border: 'none',
                  borderRadius: 4, padding: '0 10px', fontSize: 11, fontWeight: 500,
                  cursor: newTemplateName.trim() ? 'pointer' : 'not-allowed',
                  opacity: newTemplateName.trim() ? 1 : 0.5,
                }}
              >
                Save
              </button>
            </div>
          </div>

          {/* List templates */}
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {templates.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--muted)' }}>
                No templates saved yet.
              </div>
            ) : (
              templates.map(t => (
                <div key={t.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', borderBottom: '1px solid var(--hairline)',
                }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.name}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                      {Object.keys(t.inputs).length} inputs, {Object.keys(t.flags).length} flags
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button
                      onClick={() => { onLoadTemplate(t.inputs, t.flags); setIsOpen(false); }}
                      style={{ padding: 4, background: 'var(--surface-card)', border: '1px solid var(--hairline)', borderRadius: 4, cursor: 'pointer', color: 'var(--ink)' }}
                      title="Load"
                    >
                      <Download size={12} />
                    </button>
                    <button
                      onClick={() => handleDelete(t.id)}
                      style={{ padding: 4, background: 'transparent', border: '1px solid transparent', borderRadius: 4, cursor: 'pointer', color: 'var(--error)' }}
                      title="Delete"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
