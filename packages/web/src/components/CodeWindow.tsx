import React from 'react';

interface CodeWindowProps {
  title?: string;
  code: string;
}

const CodeWindow: React.FC<CodeWindowProps> = ({ title = "terminal", code }) => {
  return (
    <div className="code-window">
      <div className="code-header">
        <div className="dot" style={{ backgroundColor: '#ff5f56' }}></div>
        <div className="dot" style={{ backgroundColor: '#ffbd2e' }}></div>
        <div className="dot" style={{ backgroundColor: '#27c93f' }}></div>
        <span style={{ 
          marginLeft: '8px', 
          fontSize: '12px', 
          color: 'var(--color-text-tertiary)',
          fontWeight: 500,
          fontFamily: 'var(--font-sans)'
        }}>{title}</span>
      </div>
      <div className="code-content">
        <pre style={{ margin: 0 }}>
          <code>
            {code.split('\n').map((line, i) => (
              <div key={i} style={{ display: 'flex', gap: '16px' }}>
                <span style={{ 
                  color: 'var(--color-text-muted)', 
                  width: '20px', 
                  textAlign: 'right', 
                  userSelect: 'none' 
                }}>{i + 1}</span>
                <span style={{ color: line.trim().startsWith('$') ? 'var(--color-primary)' : 'inherit' }}>
                  {line}
                </span>
              </div>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
};

export default CodeWindow;

