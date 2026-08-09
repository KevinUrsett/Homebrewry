import { useState, type FormEvent } from 'react';
import { generateNames, nameCategoryLabels, type GeneratedName, type NameCategory, type NameGeneratorOptions } from '../lib/nameGenerator';

type NameGeneratorDialogProps = {
  actionLabel: string;
  onClose: () => void;
  onUse: (result: GeneratedName) => void;
};

const defaultOptions: NameGeneratorOptions = {
  category: 'settlement',
  theme: '',
  affixes: '',
  allowDirections: false,
  allowCompounds: true,
  includeTitles: false
};

export function NameGeneratorDialog({ actionLabel, onClose, onUse }: NameGeneratorDialogProps) {
  const [options, setOptions] = useState<NameGeneratorOptions>(defaultOptions);
  const [results, setResults] = useState(() => generateNames(defaultOptions));

  const regenerate = (event?: FormEvent) => {
    event?.preventDefault();
    setResults(generateNames(options));
  };

  return (
    <div className="name-generator-backdrop" role="presentation">
      <section aria-labelledby="name-generator-title" aria-modal="true" className="name-generator-dialog" role="dialog">
        <header>
          <div>
            <p className="eyebrow">Belentor name generator</p>
            <h2 id="name-generator-title">Name a new thing</h2>
          </div>
          <button aria-label="Close name generator" onClick={onClose} type="button">×</button>
        </header>
        <form onSubmit={regenerate}>
          <label>Category
            <select onChange={(event) => setOptions((current) => ({ ...current, category: event.target.value as NameCategory }))} value={options.category}>
              {Object.entries(nameCategoryLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </label>
          <label>Theme
            <input onChange={(event) => setOptions((current) => ({ ...current, theme: event.target.value }))} placeholder="Coastal trade city, old temple, wealthy family…" value={options.theme} />
          </label>
          <label>Directional prefixes / suffixes
            <input onChange={(event) => setOptions((current) => ({ ...current, affixes: event.target.value }))} placeholder="North, -hold, -lund" value={options.affixes} />
          </label>
          <div className="name-generator-options">
            <label><input checked={options.allowDirections} onChange={(event) => setOptions((current) => ({ ...current, allowDirections: event.target.checked }))} type="checkbox" /> Use directional names</label>
            <label><input checked={options.allowCompounds} onChange={(event) => setOptions((current) => ({ ...current, allowCompounds: event.target.checked }))} type="checkbox" /> Use descriptive compounds</label>
            <label><input checked={options.includeTitles} onChange={(event) => setOptions((current) => ({ ...current, includeTitles: event.target.checked }))} type="checkbox" /> Include titles / honorifics</label>
          </div>
          <button className="primary-button" type="submit">Generate names</button>
        </form>
        <div aria-live="polite" className="name-generator-results">
          {results.map((result) => (
            <button key={result.name} onClick={() => onUse(result)} type="button">
              <strong>{result.name}</strong>
              <span>{result.style} · {nameCategoryLabels[result.category]}</span>
              <small>{actionLabel}</small>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
