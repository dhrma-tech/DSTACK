import React from 'react';
import Link from 'next/link';
import { Rocket } from 'lucide-react';

const Navbar = () => {
  return (
    <nav className="glass" style={{
      height: '72px',
      display: 'flex',
      alignItems: 'center',
      padding: '0 32px',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      justifyContent: 'space-between',
      borderBottom: '1px solid var(--color-border-soft)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ 
          width: '32px', 
          height: '32px', 
          backgroundColor: 'var(--color-primary)', 
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          boxShadow: '0 4px 8px rgba(230, 126, 90, 0.2)'
        }}>
          <Rocket size={18} />
        </div>
        <span style={{ 
          fontFamily: 'var(--font-serif)', 
          fontSize: '22px', 
          fontWeight: 600,
          color: 'var(--color-text-primary)',
          letterSpacing: '-0.02em'
        }}>DStack</span>
      </div>

      <div style={{ 
        display: 'flex', 
        gap: '32px', 
        fontSize: '14px', 
        fontWeight: 500,
        color: 'var(--color-text-secondary)'
      }}>
        <Link href="/workspace" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Workspace</Link>
        <Link href="/" className="nav-link">Command Center</Link>
        <Link href="/skills" className="nav-link">Skills</Link>
        <Link href="/pipelines" className="nav-link">Pipelines</Link>
        <Link href="/artifacts" className="nav-link">Artifacts</Link>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button className="btn btn-secondary">Sign in</button>
        <button className="btn btn-primary">Launch Run</button>
      </div>
    </nav>
  );
};


export default Navbar;

