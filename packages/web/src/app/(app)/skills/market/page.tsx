'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { api, type MarketSkill } from '@/lib/api';
import Badge from '@/components/ui/Badge';
import { ShoppingBag, Download, Star, Users, Search, Filter, Globe, Shield } from 'lucide-react';

export default function SkillMarketPage() {
  const [skills, setSkills] = useState<MarketSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.getMarketSkills().then(setSkills).catch(() => null).finally(() => setLoading(false));
  }, []);

  const filtered = skills.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    s.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell>
      <div style={{ height: '100%', overflowY: 'auto', background: 'var(--canvas)', padding: 40 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <header style={{ marginBottom: 40, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--coral)', marginBottom: 8 }}>
                <Globe size={20} />
                <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Global Registry</span>
              </div>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 42, fontWeight: 400, color: 'var(--ink)' }}>Skill Market</h1>
              <p style={{ fontSize: 16, color: 'var(--muted)', marginTop: 8 }}>Browse and install specialized agentic skills for your engineering workflow.</p>
            </div>
          </header>

          <div style={{ display: 'flex', gap: 16, marginBottom: 32 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
              <input 
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search for security, design, or cloud skills..."
                style={{ width: '100%', padding: '14px 16px 14px 44px', background: '#fff', border: '1px solid var(--hairline)', borderRadius: 12, fontSize: 14, outline: 'none' }}
              />
            </div>
            <button style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid var(--hairline)', borderRadius: 12, padding: '0 20px', fontSize: 14, color: 'var(--ink)', fontWeight: 500, cursor: 'pointer' }}>
              <Filter size={16} /> All Categories
            </button>
          </div>

          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
              {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="skeleton skeleton-block" style={{ height: 200, borderRadius: 20 }} />)}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
              {filtered.map(skill => (
                <div key={skill.name} style={{ background: '#fff', border: '1px solid var(--hairline)', borderRadius: 24, padding: 24, display: 'flex', flexDirection: 'column', transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'pointer' }} className="skill-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div style={{ width: 48, height: 48, background: 'var(--coral-bg)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--coral)' }}>
                      <Shield size={24} />
                    </div>
                    <Badge variant="FAKE">{skill.category}</Badge>
                  </div>

                  <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>/{skill.name}</h3>
                  <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5, flex: 1, marginBottom: 20 }}>{skill.description}</p>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, borderTop: '1px solid var(--hairline)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--muted)' }}>
                        <Users size={12} /> {skill.installs}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--muted)' }}>
                        <Star size={12} fill="var(--amber)" stroke="var(--amber)" /> 4.9
                      </div>
                    </div>
                    <button style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--ink)', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                      <Download size={14} /> Install
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
