import { useState, useMemo, useCallback, useEffect } from 'react';
import { Send, Loader2, AlertCircle, FileText, ChevronDown, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useChat, type ChatResponse } from '@/hooks/use-chat';
import { PromptRegistry, loadMarkdownPrompts } from '@devpilot/ai-prompts';
import { getFormConfig } from './form-config';
import { FormField } from './FormField';
import { PromptPreview } from './PromptPreview';
import { AdvancedSettings, MODELS } from './AdvancedSettings';
import { ResponseDisplay } from './ResponseDisplay';
import { usePersistedState } from './use-persisted-state';

const registry = new PromptRegistry();
registry.registerAll(loadMarkdownPrompts());

const MODELS_MAP = MODELS as Record<string, { value: string; label: string }[]>;

function interpolate(template: string, variables: Record<string, unknown>): string {
  let result = template;
  result = result.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_m, key, content) => {
    const value = variables[key];
    if (value !== undefined && value !== null && value !== '' && value !== false) {
      return interpolate(String(content), variables);
    }
    return '';
  });
  result = result.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (key in variables) {
      const value = variables[key];
      return value === undefined || value === null ? '' : String(value);
    }
    return match;
  });
  return result;
}

export function PlaygroundPage() {
  const {
    templateId: persistedTemplateId,
    setTemplateId: setPersistedTemplateId,
    formValues: persistedFormValues,
    setFormValues: setPersistedFormValues,
    provider,
    setProvider,
    model,
    setModel,
    temperature,
    setTemperature,
    maxTokens,
    setMaxTokens,
    resetForm,
  } = usePersistedState();

  const [selectedTemplateId, setSelectedTemplateId] = useState(persistedTemplateId);
  const [formValues, setFormValues] = useState<Record<string, string>>(persistedFormValues);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ChatResponse | null>(null);

  const chat = useChat();

  const allTemplates = useMemo(() => registry.list(), []);

  const selectedMetadata = useMemo(() => {
    if (!selectedTemplateId) return null;
    return registry.getMetadata(selectedTemplateId) ?? null;
  }, [selectedTemplateId]);

  const selectedTemplate = useMemo(() => {
    if (!selectedTemplateId) return null;
    return registry.get(selectedTemplateId) ?? null;
  }, [selectedTemplateId]);

  const formConfig = useMemo(
    () => (selectedTemplateId ? getFormConfig(selectedTemplateId) : null),
    [selectedTemplateId],
  );

  // Initialize form values when template changes
  useEffect(() => {
    if (formConfig) {
      setFormValues((prev) => {
        const next: Record<string, string> = {};
        for (const field of formConfig.fields) {
          const defaultValue = formConfig.defaults[field.name];
          next[field.name] =
            prev[field.name] !== undefined
              ? prev[field.name]
              : defaultValue !== undefined
                ? String(defaultValue)
                : '';
        }
        return next;
      });
    } else if (!selectedTemplateId) {
      // Freeform mode — no template
    }
  }, [formConfig, selectedTemplateId]);

  // Build the final prompt from template + form values
  const finalPrompt = useMemo(() => {
    if (!selectedTemplate) {
      // Freeform mode: no template, just empty
      return '';
    }
    return interpolate(selectedTemplate.userPromptTemplate, formValues);
  }, [selectedTemplate, formValues]);

  // Validation
  const isValid = useMemo(() => {
    if (!formConfig) return true; // freeform
    for (const field of formConfig.fields) {
      if (field.required && !formValues[field.name]?.trim()) {
        return false;
      }
    }
    return true;
  }, [formConfig, formValues]);

  const firstError = useMemo(() => {
    if (!formConfig) return null;
    for (const field of formConfig.fields) {
      if (field.required && !formValues[field.name]?.trim()) {
        return field.validationMessage ?? `Please fill in ${field.label}.`;
      }
    }
    return null;
  }, [formConfig, formValues]);

  function handleTemplateChange(templateId: string) {
    setSelectedTemplateId(templateId);
    setPersistedTemplateId(templateId);
    setValidationErrors({});
    setResult(null);
    if (!templateId) {
      resetForm();
    }
  }

  const handleFieldChange = useCallback(
    (name: string, value: string) => {
      setFormValues((prev) => {
        const next = { ...prev, [name]: value };
        setPersistedFormValues(next);
        return next;
      });
      // Clear validation error for this field
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    },
    [setPersistedFormValues],
  );

  function handleProviderChange(newProvider: string) {
    setProvider(newProvider);
    const models = MODELS_MAP[newProvider];
    if (models?.length) setModel(models[0].value);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validate
    if (formConfig) {
      const errors: Record<string, string> = {};
      for (const field of formConfig.fields) {
        if (field.required && !formValues[field.name]?.trim()) {
          errors[field.name] = field.validationMessage ?? `Please fill in ${field.label}.`;
        }
      }
      if (Object.keys(errors).length > 0) {
        setValidationErrors(errors);
        return;
      }
    }

    const toSend = finalPrompt.trim();
    if (!toSend || chat.isPending) return;

    chat.mutate(
      { provider, model, prompt: toSend, temperature, maxTokens },
      { onSuccess: (data) => setResult(data) },
    );
  }

  return (
    <div className="flex h-full">
      {/* Left Panel */}
      <div className="flex flex-1 flex-col overflow-y-auto border-r border-input">
        <div className="flex-1 p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">AI Playground</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Select a template and fill in the details to generate AI-powered output.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Template Selector */}
            <div className="space-y-1.5">
              <label htmlFor="template" className="text-sm font-medium">
                <FileText className="mr-1 inline h-3.5 w-3.5" />
                Template
              </label>
              <div className="relative">
                <select
                  id="template"
                  value={selectedTemplateId}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                  className="w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">Choose a template...</option>
                  {allTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
              {selectedMetadata && (
                <p className="text-xs text-muted-foreground">{selectedMetadata.description}</p>
              )}
            </div>

            {/* Dynamic Form Fields */}
            {formConfig && (
              <div className="space-y-4 rounded-md border border-input p-4">
                {formConfig.fields.map((field) => (
                  <FormField
                    key={field.name}
                    config={field}
                    value={formValues[field.name] ?? ''}
                    allValues={formValues}
                    onChange={handleFieldChange}
                    error={validationErrors[field.name]}
                  />
                ))}
              </div>
            )}

            {/* Freeform prompt when no template */}
            {!formConfig && !selectedTemplateId && (
              <div className="rounded-md border border-dashed border-input p-6 text-center text-muted-foreground">
                <Sparkles className="mx-auto mb-2 h-5 w-5" />
                <p className="text-sm">Select a template above to get started</p>
              </div>
            )}

            {/* Advanced Settings */}
            <AdvancedSettings
              provider={provider}
              model={model}
              temperature={temperature}
              maxTokens={maxTokens}
              onProviderChange={handleProviderChange}
              onModelChange={setModel}
              onTemperatureChange={setTemperature}
              onMaxTokensChange={setMaxTokens}
            />

            {/* Send Button */}
            <Button
              type="submit"
              disabled={!isValid || chat.isPending || !selectedTemplateId}
              className="w-full"
            >
              {chat.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Generate
                </>
              )}
            </Button>

            {/* Validation hint */}
            {!isValid && selectedTemplateId && (
              <p className="text-center text-xs text-amber-500">{firstError}</p>
            )}
          </form>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex flex-1 flex-col overflow-y-auto">
        <div className="flex-1 p-6">
          {/* Error */}
          {chat.isError && (
            <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <div>
                  <p className="text-sm font-medium text-destructive">Error</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {chat.error?.error?.message ?? 'An unexpected error occurred'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Response */}
          {result && <ResponseDisplay response={result} />}

          {/* Empty state */}
          {!result && !chat.isError && !chat.isPending && (
            <div className="flex h-full min-h-[300px] items-center justify-center rounded-md border border-dashed text-muted-foreground">
              <div className="text-center">
                <Sparkles className="mx-auto mb-2 h-6 w-6" />
                <p className="text-sm">
                  Select a template and fill in the form to generate a response
                </p>
              </div>
            </div>
          )}

          {/* Loading */}
          {chat.isPending && (
            <div className="flex h-full min-h-[300px] items-center justify-center">
              <div className="text-center">
                <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Generating response...</p>
              </div>
            </div>
          )}

          {/* Prompt Preview */}
          {selectedTemplate && formConfig && (
            <div className="mt-4">
              <PromptPreview
                systemPrompt={selectedTemplate.systemPrompt}
                userPrompt={finalPrompt}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
