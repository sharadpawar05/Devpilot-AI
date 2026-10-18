import DOMPurify from 'dompurify';
import { renderMarkdown } from './markdown';

const PRINT_STYLE = `body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:40px;max-width:800px;margin:0 auto}h1{border-bottom:2px solid #e5e7eb;padding-bottom:8px}h2{margin-top:24px}img{max-width:100%}@media print{body{padding:20px}}`;

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Opens a print window for an AI-generated report. The markdown body is
 * rendered through renderMarkdown() (DOMPurify-sanitized) and all scalar
 * metadata is HTML-escaped — AI output must never reach document.write raw.
 */
export function openPrintableMarkdownReport(options: {
  title: string;
  meta: Array<{ label: string; value: string }>;
  markdownBody: string;
}): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const safeTitle = escapeHtml(options.title);
  const metaHtml = options.meta
    .map(({ label, value }) => `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`)
    .join('');
  const bodyHtml = DOMPurify.sanitize(renderMarkdown(options.markdownBody), {
    USE_PROFILES: { html: true },
  });

  printWindow.document.write(
    `<!DOCTYPE html><html><head><title>${safeTitle}</title><style>${PRINT_STYLE}</style></head><body><h1>${safeTitle}</h1>${metaHtml}<hr/>${bodyHtml}</body></html>`,
  );
  printWindow.document.close();
  printWindow.print();
}
