import React from 'react';

/**
 * MiniMarkdown: A minimal Markdown renderer that supports:
 * - **bold**
 * - ### Heading, ## Heading, # Heading
 * - | table | rows |
 * - ![alt](url) images
 * - plain text lines with pre-wrap
 *
 * Designed to parse the specific Markdown format injected by ReportIncidentModal.
 */

function parseLine(line: string, key: number): React.ReactNode {
  // Convert **bold** inline
  const parts = line.split(/(\*\*[^*]+\*\*)/g);
  const parsed = parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
  return <span key={key}>{parsed}</span>;
}

interface MiniMarkdownProps {
  content: string;
  className?: string;
}

export const MiniMarkdown: React.FC<MiniMarkdownProps> = ({ content, className }) => {
  if (!content) return null;

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Images: ![alt](url)
    const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imgMatch) {
      elements.push(
        <a key={i} href={imgMatch[2]} target="_blank" rel="noopener noreferrer">
          <img
            src={imgMatch[2]}
            alt={imgMatch[1]}
            style={{ maxWidth: '100%', maxHeight: '180px', objectFit: 'cover', borderRadius: '6px', border: '1px solid hsl(var(--border))' }}
          />
        </a>
      );
      i++;
      continue;
    }

    // ### Heading 3
    if (line.startsWith('### ')) {
      elements.push(
        <h5 key={i} style={{ margin: '12px 0 6px', fontSize: '0.82rem', fontWeight: 700, color: 'hsl(var(--primary))', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {line.slice(4)}
        </h5>
      );
      i++;
      continue;
    }

    // ## Heading 2
    if (line.startsWith('## ')) {
      elements.push(
        <h4 key={i} style={{ margin: '12px 0 6px', fontSize: '0.9rem', fontWeight: 700 }}>
          {line.slice(3)}
        </h4>
      );
      i++;
      continue;
    }

    // # Heading 1
    if (line.startsWith('# ')) {
      elements.push(
        <h3 key={i} style={{ margin: '12px 0 6px', fontSize: '1rem', fontWeight: 700 }}>
          {line.slice(2)}
        </h3>
      );
      i++;
      continue;
    }

    // Table: starts with |
    if (line.startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      const rows = tableLines.filter(l => !l.match(/^\|[-| ]+\|$/)); // skip separator rows
      if (rows.length > 0) {
        const headerCells = rows[0].split('|').filter(c => c.trim() !== '');
        const bodyRows = rows.slice(1);
        elements.push(
          <div key={`tbl-${i}`} style={{ overflowX: 'auto', margin: '6px 0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ background: 'hsl(var(--bg-muted))' }}>
                  {headerCells.map((cell, ci) => (
                    <th key={ci} style={{ padding: '7px 10px', textAlign: 'left', borderBottom: '2px solid hsl(var(--border))', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {cell.trim()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bodyRows.map((row, ri) => {
                  const cells = row.split('|').filter(c => c.trim() !== '');
                  return (
                    <tr key={ri} style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                      {cells.map((cell, ci) => (
                        <td key={ci} style={{ padding: '6px 10px', verticalAlign: 'top' }}>
                          {parseLine(cell.trim(), ci)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }

    // Empty line → spacer
    if (line.trim() === '') {
      elements.push(<div key={i} style={{ height: '6px' }} />);
      i++;
      continue;
    }

    // Default: paragraph line
    elements.push(
      <p key={i} style={{ margin: '2px 0', lineHeight: 1.6, fontSize: '0.85rem' }}>
        {parseLine(line, i)}
      </p>
    );
    i++;
  }

  return <div className={className} style={{ display: 'flex', flexDirection: 'column' }}>{elements}</div>;
};
