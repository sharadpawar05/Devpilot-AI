import { useCallback } from 'react';
import Editor from '@monaco-editor/react';
import type { FormFieldConfig } from './form-config';
import { useTheme } from '@/hooks/use-theme';

interface FormFieldProps {
  config: FormFieldConfig;
  value: string;
  allValues: Record<string, string>;
  onChange: (name: string, value: string) => void;
  error?: string;
}

const selectClass =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

const inputClass =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

export function FormField({ config, value, allValues, onChange, error }: FormFieldProps) {
  const { theme } = useTheme();
  const monacoTheme = theme === 'dark' ? 'vs-dark' : 'vs';

  const handleChange = useCallback(
    (val: string) => onChange(config.name, val),
    [config.name, onChange],
  );

  return (
    <div className="space-y-1.5">
      <label htmlFor={`field-${config.name}`} className="text-sm font-medium">
        {config.label}
        {config.required && <span className="ml-1 text-destructive">*</span>}
      </label>

      {config.type === 'text' && (
        <input
          id={`field-${config.name}`}
          type="text"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={config.placeholder}
          className={inputClass}
        />
      )}

      {config.type === 'select' && (
        <div className="relative">
          <select
            id={`field-${config.name}`}
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            className={selectClass}
          >
            <option value="">Select...</option>
            {config.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {config.type === 'textarea' && (
        <textarea
          id={`field-${config.name}`}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={config.placeholder}
          rows={3}
          className={`${inputClass} resize-none`}
        />
      )}

      {config.type === 'number' && (
        <input
          id={`field-${config.name}`}
          type="number"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          min={config.min}
          max={config.max}
          placeholder={config.placeholder}
          className={inputClass}
        />
      )}

      {config.type === 'code' && (
        <div className="overflow-hidden rounded-md border border-input">
          <Editor
            height="350px"
            language={allValues[config.languageField ?? 'language'] || 'plaintext'}
            theme={monacoTheme}
            value={value}
            onChange={(val) => handleChange(val ?? '')}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: 'on',
              wordWrap: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              padding: { top: 12, bottom: 12 },
              renderLineHighlight: 'gutter',
              bracketPairColorization: { enabled: true },
              smoothScrolling: true,
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
            }}
          />
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
