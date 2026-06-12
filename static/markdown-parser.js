/**
 * markdown-parser.js — Lightweight Markdown→HTML + YAML Frontmatter Parser
 * No external dependencies. Handles common Markdown syntax.
 */

(function () {
  'use strict';

  // ═══════════════════════════════════════════════
  // YAML FRONTMATTER PARSER
  // ═══════════════════════════════════════════════
  function parseFrontmatter(text) {
    const result = { meta: {}, content: text };
    const trimmed = text.trim();

    if (!trimmed.startsWith('---')) return result;

    const endIndex = trimmed.indexOf('---', 3);
    if (endIndex === -1) return result;

    const yamlBlock = trimmed.substring(3, endIndex).trim();
    const content = trimmed.substring(endIndex + 3).trim();

    const meta = {};
    const lines = yamlBlock.split('\n');

    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;

      const key = line.substring(0, colonIndex).trim().toLowerCase();
      let value = line.substring(colonIndex + 1).trim();

      // Remove surrounding quotes
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      meta[key] = value;
    }

    return { meta, content };
  }

  // ═══════════════════════════════════════════════
  // MARKDOWN → HTML CONVERTER
  // ═══════════════════════════════════════════════
  function markdownToHtml(md) {
    if (!md) return '';

    let html = '';
    const lines = md.split('\n');
    let i = 0;
    let inList = null; // 'ul' or 'ol'
    let inCodeBlock = false;
    let codeContent = '';
    let codeLang = '';

    function closeList() {
      if (inList) {
        html += `</${inList}>`;
        inList = null;
      }
    }

    while (i < lines.length) {
      const line = lines[i];

      // ── Code blocks ──
      if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          html += `<pre><code class="language-${codeLang}">${escapeHtml(codeContent.trim())}</code></pre>`;
          inCodeBlock = false;
          codeContent = '';
          codeLang = '';
        } else {
          closeList();
          inCodeBlock = true;
          codeLang = line.trim().substring(3).trim() || 'text';
        }
        i++;
        continue;
      }

      if (inCodeBlock) {
        codeContent += line + '\n';
        i++;
        continue;
      }

      const trimmed = line.trim();

      // ── Empty line ──
      if (trimmed === '') {
        closeList();
        i++;
        continue;
      }

      // ── Headings ──
      const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        closeList();
        const level = headingMatch[1].length;
        html += `<h${level}>${inlineFormat(headingMatch[2])}</h${level}>`;
        i++;
        continue;
      }

      // ── Horizontal rule ──
      if (/^[-*_]{3,}$/.test(trimmed)) {
        closeList();
        html += '<hr>';
        i++;
        continue;
      }

      // ── Blockquote ──
      if (trimmed.startsWith('>')) {
        closeList();
        let quoteContent = '';
        while (i < lines.length && lines[i].trim().startsWith('>')) {
          quoteContent += lines[i].trim().substring(1).trim() + ' ';
          i++;
        }
        html += `<blockquote><p>${inlineFormat(quoteContent.trim())}</p></blockquote>`;
        continue;
      }

      // ── Unordered list ──
      if (/^[-*+]\s+/.test(trimmed)) {
        if (inList !== 'ul') {
          closeList();
          html += '<ul>';
          inList = 'ul';
        }
        html += `<li>${inlineFormat(trimmed.replace(/^[-*+]\s+/, ''))}</li>`;
        i++;
        continue;
      }

      // ── Ordered list ──
      if (/^\d+\.\s+/.test(trimmed)) {
        if (inList !== 'ol') {
          closeList();
          html += '<ol>';
          inList = 'ol';
        }
        html += `<li>${inlineFormat(trimmed.replace(/^\d+\.\s+/, ''))}</li>`;
        i++;
        continue;
      }

      // ── Paragraph ──
      closeList();
      let para = trimmed;
      i++;
      while (i < lines.length && lines[i].trim() !== '' && !lines[i].trim().startsWith('#') && !lines[i].trim().startsWith('```') && !lines[i].trim().startsWith('>') && !/^[-*+]\s+/.test(lines[i].trim()) && !/^\d+\.\s+/.test(lines[i].trim()) && !/^[-*_]{3,}$/.test(lines[i].trim())) {
        para += ' ' + lines[i].trim();
        i++;
      }
      html += `<p>${inlineFormat(para)}</p>`;
    }

    closeList();
    return html;
  }

  function inlineFormat(text) {
    // Bold + Italic
    text = text.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    // Bold
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/__(.+?)__/g, '<strong>$1</strong>');
    // Italic
    text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
    text = text.replace(/_(.+?)_/g, '<em>$1</em>');
    // Strikethrough
    text = text.replace(/~~(.+?)~~/g, '<del>$1</del>');
    // Inline code
    text = text.replace(/`(.+?)`/g, '<code>$1</code>');
    // Links
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    // Images
    text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
    return text;
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ═══════════════════════════════════════════════
  // EXPORT
  // ═══════════════════════════════════════════════
  window.MarkdownParser = {
    parseFrontmatter,
    markdownToHtml,
  };

})();
