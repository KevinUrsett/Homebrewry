import { useState } from 'react';

type AiEditDialogProps = {
  selectedText: string;
  onApply: (replacement: string) => void;
  onClose: () => void;
};

export function AiEditDialog({ selectedText, onApply, onClose }: AiEditDialogProps) {
  const [instruction, setInstruction] = useState('Improve the writing while preserving its meaning and Markdown formatting.');
  const [suggestion, setSuggestion] = useState('');
  const [status, setStatus] = useState<'idle' | 'working' | 'error'>('idle');
  const [error, setError] = useState('');

  const generate = async () => {
    if (!instruction.trim()) return;
    setStatus('working');
    setError('');
    try {
      const response = await fetch('/api/ai-edit', {
        body: JSON.stringify({ instruction: instruction.trim(), text: selectedText }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST'
      });
      const payload = await response.json() as { text?: string; error?: string };
      if (!response.ok || !payload.text) throw new Error(payload.error || 'Could not create a suggestion');
      setSuggestion(payload.text);
      setStatus('idle');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not create a suggestion');
      setStatus('error');
    }
  };

  return (
    <div className="ai-edit-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }} role="dialog" aria-modal="true" aria-labelledby="ai-edit-title">
      <section className="ai-edit-dialog">
        <header>
          <div>
            <p className="eyebrow">Selected text</p>
            <h2 id="ai-edit-title">Edit with AI</h2>
          </div>
          <button aria-label="Close AI edit" className="ai-edit-close" onClick={onClose} type="button">×</button>
        </header>
        <p className="ai-edit-help">Ask for a specific change. You can review the proposed replacement before applying it.</p>
        <label>
          What should change?
          <textarea autoFocus onChange={(event) => setInstruction(event.target.value)} value={instruction} />
        </label>
        <details>
          <summary>Selected passage</summary>
          <pre>{selectedText}</pre>
        </details>
        <button className="ai-edit-generate" disabled={status === 'working' || !instruction.trim()} onClick={() => { void generate(); }} type="button">
          {status === 'working' ? 'Writing suggestion…' : suggestion ? 'Rewrite suggestion' : 'Generate suggestion'}
        </button>
        {error && <p className="ai-edit-error" role="alert">{error}</p>}
        {suggestion && (
          <label>
            Suggested replacement
            <textarea className="ai-edit-suggestion" onChange={(event) => setSuggestion(event.target.value)} value={suggestion} />
          </label>
        )}
        <footer>
          <button onClick={onClose} type="button">Cancel</button>
          <button className="ai-edit-apply" disabled={!suggestion.trim()} onClick={() => onApply(suggestion)} type="button">Apply replacement</button>
        </footer>
      </section>
    </div>
  );
}
