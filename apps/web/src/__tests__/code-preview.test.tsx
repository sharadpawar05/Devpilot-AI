import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/ui/toast';
import { CodePreview } from '@/components/code-preview';
import { getLanguageFromPath, getLanguageLabel } from '@/components/code-preview/language';

function wrap(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={client}>
      <ToastProvider>{ui}</ToastProvider>
    </QueryClientProvider>
  );
}

describe('language helpers', () => {
  it('maps common extensions', () => {
    expect(getLanguageFromPath('src/app.ts')).toBe('typescript');
    expect(getLanguageFromPath('src/App.tsx')).toBe('typescript');
    expect(getLanguageFromPath('styles/main.css')).toBe('css');
    expect(getLanguageFromPath('README.md')).toBe('markdown');
    expect(getLanguageFromPath('Dockerfile')).toBe('dockerfile');
    expect(getLanguageFromPath('package.json')).toBe('json');
    expect(getLanguageFromPath('unknown.xyz')).toBe('plaintext');
  });

  it('labels languages for display', () => {
    expect(getLanguageLabel('typescript')).toBe('Typescript');
    expect(getLanguageLabel('xml')).toBe('HTML');
    expect(getLanguageLabel('plaintext')).toBe('Plain Text');
  });
});

describe('CodePreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders empty state when no file is selected', () => {
    render(wrap(<CodePreview file={null} />));
    expect(screen.getByTestId('code-preview-empty')).toBeInTheDocument();
    expect(screen.getByText('No file selected')).toBeInTheDocument();
    expect(screen.getByTestId('code-preview')).toBeInTheDocument();
  });

  it('renders file header with name, path, and language', () => {
    render(wrap(<CodePreview file="src/components/Button.tsx" content={'const a = 1;\n'} />));
    expect(screen.getByTestId('code-preview-header')).toBeInTheDocument();
    expect(screen.getByTestId('file-name')).toHaveTextContent('Button.tsx');
    expect(screen.getByTestId('file-path')).toHaveTextContent('src/components/Button.tsx');
    expect(screen.getByText('Typescript')).toBeInTheDocument();
    expect(screen.getByTestId('line-count')).toHaveTextContent('2 lines');
  });

  it('renders syntax-highlighted code with line numbers', () => {
    const content = 'function hello() {\n  return "world";\n}';
    render(wrap(<CodePreview file="hello.ts" content={content} />));

    expect(screen.getByTestId('code-display')).toBeInTheDocument();
    expect(screen.getByLabelText('Line 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Line 2')).toBeInTheDocument();
    expect(screen.getByLabelText('Line 3')).toBeInTheDocument();
    expect(screen.getByText('hello')).toBeInTheDocument();
    expect(screen.getByText('"world"')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(wrap(<CodePreview file="a.ts" isLoading />));
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading file');
  });

  it('shows error state with retry', () => {
    const onRetry = vi.fn();
    render(wrap(<CodePreview file="a.ts" error="Network error" onRetry={onRetry} />));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Unable to load file')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('shows empty file state', () => {
    render(wrap(<CodePreview file="empty.ts" content="" />));
    expect(screen.getByText('Empty file')).toBeInTheDocument();
  });

  it('opens search with toggle and finds matches', () => {
    const content = 'const foo = 1;\nconst bar = foo;\n';
    render(wrap(<CodePreview file="search.ts" content={content} />));

    fireEvent.click(screen.getByTestId('search-toggle'));
    expect(screen.getByTestId('code-search-bar')).toBeInTheDocument();

    const input = screen.getByTestId('code-search-input');
    fireEvent.change(input, { target: { value: 'foo' } });
    expect(screen.getByTestId('search-counter')).toHaveTextContent('1/2');
  });

  it('closes search with Escape on input', () => {
    render(wrap(<CodePreview file="s.ts" content={'x = 1\n'} />));
    fireEvent.click(screen.getByTestId('search-toggle'));
    expect(screen.getByTestId('code-search-bar')).toBeInTheDocument();

    fireEvent.keyDown(screen.getByTestId('code-search-input'), { key: 'Escape' });
    expect(screen.queryByTestId('code-search-bar')).not.toBeInTheDocument();
  });

  it('opens search on Ctrl+F', () => {
    render(wrap(<CodePreview file="s.ts" content={'x = 1\n'} />));
    expect(screen.queryByTestId('code-search-bar')).not.toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'f', ctrlKey: true, bubbles: true });
    expect(screen.getByTestId('code-search-bar')).toBeInTheDocument();
  });

  it('shows minimap only when lines exceed threshold', () => {
    const few = Array.from({ length: 10 }, (_, i) => `line ${i}`).join('\n');
    const { unmount } = render(wrap(<CodePreview file="few.ts" content={few} />));
    expect(screen.queryByTestId('code-minimap')).not.toBeInTheDocument();
    unmount();

    const many = Array.from({ length: 60 }, (_, i) => `line ${i}`).join('\n');
    render(wrap(<CodePreview file="many.ts" content={many} />));
    expect(screen.getByTestId('code-minimap')).toBeInTheDocument();
  });

  it('exposes header actions for copy, download, share, and more', () => {
    render(wrap(<CodePreview file="a.ts" content={'x'} />));
    expect(screen.getByTestId('copy-file')).toBeInTheDocument();
    expect(screen.getByTestId('download-file')).toBeInTheDocument();
    expect(screen.getByTestId('share-file')).toBeInTheDocument();
    expect(screen.getByTestId('more-actions')).toBeInTheDocument();
  });

  it('copies file content to clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { ...navigator.clipboard, writeText } });

    render(wrap(<CodePreview file="a.ts" content={'copy-me'} />));
    await act(async () => {
      fireEvent.click(screen.getByTestId('copy-file'));
    });

    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('copy-me');
    });
  });

  it('activates a line when line number is clicked', () => {
    render(wrap(<CodePreview file="a.ts" content={'one\ntwo\nthree'} />));
    fireEvent.click(screen.getByLabelText('Line 2'));
    const line2 = screen.getByLabelText('Line 2').closest('.code-line');
    expect(line2).toHaveClass('code-line-active');
  });

  it('navigates search matches with next button', () => {
    const content = 'aa\naa\naa\n';
    render(wrap(<CodePreview file="a.ts" content={content} />));
    fireEvent.click(screen.getByTestId('search-toggle'));
    fireEvent.change(screen.getByTestId('code-search-input'), { target: { value: 'aa' } });
    expect(screen.getByTestId('search-counter')).toHaveTextContent('1/3');

    const next = screen.getByRole('button', { name: 'Next match' });
    fireEvent.click(next);
    expect(screen.getByTestId('search-counter')).toHaveTextContent('2/3');
  });

  it('is keyboard accessible for search controls', () => {
    render(wrap(<CodePreview file="a.ts" content={'x=1\nx=2\n'} />));
    fireEvent.click(screen.getByTestId('search-toggle'));
    const bar = within(screen.getByTestId('code-search-bar'));
    // No query yet — both nav buttons disabled
    expect(bar.getByRole('button', { name: 'Previous match' })).toBeDisabled();
    expect(bar.getByRole('button', { name: 'Next match' })).toBeDisabled();

    fireEvent.change(screen.getByTestId('code-search-input'), { target: { value: 'x' } });
    expect(bar.getByRole('button', { name: 'Next match' })).toBeEnabled();
    expect(bar.getByRole('button', { name: 'Previous match' })).toBeEnabled();
    expect(bar.getByRole('button', { name: 'Close search' })).toBeEnabled();
  });
});
