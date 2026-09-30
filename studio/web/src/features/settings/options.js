// The descriptions are i18n keys; use modelSuggestions(t) at the render site.
export const MODEL_SUGGESTIONS = [
  { value: 'opus', description: 'settings.model.opus' },
  { value: 'sonnet', description: 'settings.model.sonnet' },
  { value: 'haiku', description: 'settings.model.haiku' },
];
export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];

export const modelSuggestions = (t) => MODEL_SUGGESTIONS.map((s) => ({ ...s, description: t(s.description) }));

export const opt = (value, label, description) => ({ value, label, description });
