'use client';

import React from 'react';
import Link from 'next/link';

export default function LoginPage() {
  return (
    <main style={{ 
      backgroundColor: 'var(--color-canvas)', 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--spacing-lg)'
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 'var(--spacing-md)', 
        marginBottom: 'var(--spacing-xxl)' 
      }}>
        <div style={{ 
          width: '32px', 
          height: '32px', 
          backgroundColor: 'var(--color-ink)', 
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: 'bold',
          fontSize: '24px'
        }}>*</div>
        <span className="serif" style={{ fontSize: '28px' }}>DStack</span>
      </div>

      <div className="card" style={{ 
        width: '100%', 
        maxWidth: '400px', 
        backgroundColor: 'white', 
        border: '1px solid var(--color-hairline)',
        padding: 'var(--spacing-xl)',
        textAlign: 'center'
      }}>
        <h1 className="serif" style={{ fontSize: '32px', marginBottom: 'var(--spacing-sm)' }}>Welcome back</h1>
        <p className="muted" style={{ fontSize: '14px', marginBottom: 'var(--spacing-xl)' }}>
          Continue to your AI command center.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)', textAlign: 'left' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Email Address</label>
            <input 
              type="email" 
              placeholder="name@company.com" 
              style={{ 
                width: '100%', 
                padding: '12px', 
                borderRadius: 'var(--rounded-md)', 
                border: '1px solid var(--color-hairline)',
                fontSize: '14px',
                outline: 'none'
              }} 
            />
          </div>
          <button className="btn btn-primary" style={{ width: '100%', height: '48px', fontSize: '16px' }}>
            Continue with Email
          </button>
        </div>

        <div style={{ margin: 'var(--spacing-lg) 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--color-hairline)' }}></div>
          <span style={{ fontSize: '12px', color: 'var(--color-muted-soft)' }}>OR</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--color-hairline)' }}></div>
        </div>

        <button className="btn btn-secondary" style={{ width: '100%', height: '48px', display: 'flex', gap: '12px' }}>
          <div style={{ width: '18px', height: '18px', borderRadius: '2px', backgroundColor: '#4285F4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '10px', fontWeight: 'bold' }}>G</div>
          Continue with Google
        </button>

        <p style={{ marginTop: 'var(--spacing-xl)', fontSize: '13px', color: 'var(--color-muted)' }}>
          Don&apos;t have an account? <Link href="/signup" className="text-link">Create one</Link>
        </p>
      </div>

      <div style={{ marginTop: 'var(--spacing-xxl)', fontSize: '12px', color: 'var(--color-muted-soft)', display: 'flex', gap: 'var(--spacing-lg)' }}>
        <a href="#">Privacy Policy</a>
        <a href="#">Terms of Service</a>
      </div>
    </main>
  );
}
