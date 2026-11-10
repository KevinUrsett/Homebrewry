/* @vitest-environment jsdom */
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { EditorView } from '@codemirror/view';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDungeon, updateDungeonRoom } from '../lib/dungeons';
import { formatDungeonReference } from '../lib/dungeonReferences';
import { BrewPreview } from './BrewPreview';
import { MarkdownEditor } from './MarkdownEditor';
import type { BrewAsset, DungeonRoomTextChange } from '../types';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const asset: BrewAsset = {
  id: 'lantern-art',
  name: 'lantern.jpg',
  alt: 'A brass lantern',
  mimeType: 'image/jpeg',
  size: 3,
  blob: new Blob(['art'], { type: 'image/jpeg' }),
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
};

describe('MarkdownEditor images', () => {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    root = null;
    host = null;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('renders a stored image beneath its Markdown in Edit mode', async () => {
    const createObjectURL = vi.fn(() => 'blob:lantern-preview');
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL: vi.fn() });
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);

    await act(async () => {
      root?.render(<MarkdownEditor assets={new Map([[asset.id, asset]])} content="![A brass lantern](asset://lantern-art)" onChange={() => undefined} />);
    });

    const image = host.querySelector<HTMLImageElement>('.cm-markdown-image-preview img');
    expect(image?.alt).toBe('A brass lantern');
    expect(image?.src).toBe('blob:lantern-preview');
    expect(host.textContent).toContain('A brass lantern');
    expect(host.textContent).not.toContain('asset://lantern-art');
    expect(createObjectURL).toHaveBeenCalledWith(asset.blob);
  });

  it('reports typing immediately and refreshes embedded previews after typing pauses', async () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);

    await act(async () => {
      root?.render(<MarkdownEditor content="![Old map](https://example.com/old.png)" onChange={onChange} />);
    });

    const editorElement = host.querySelector<HTMLElement>('.cm-editor');
    const view = editorElement ? EditorView.findFromDOM(editorElement) : null;
    const nextContent = '![New map](https://example.com/new.png)';
    expect(view).not.toBeNull();

    act(() => {
      view?.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: nextContent } });
    });

    expect(onChange).toHaveBeenCalledWith(nextContent);
    expect(host.querySelector<HTMLImageElement>('.cm-markdown-image-preview img')?.alt).not.toBe('New map');

    await act(async () => {
      vi.advanceTimersByTime(150);
    });

    expect(host.querySelector<HTMLImageElement>('.cm-markdown-image-preview img')?.alt).toBe('New map');
  });

  it('does not rescan a large document when typing updates parent callbacks', async () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const onOpenEncounter = vi.fn();
    const encounterId = 'ad7d5e0d-4b4d-4fd8-9c78-bf44f9205030';
    const initialContent = `[[encounter:${encounterId}|Ambush]]\n${'# Section\nLong campaign notes with references and descriptions.\n'.repeat(3000)}`;
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    await act(async () => {
      root?.render(<MarkdownEditor content={initialContent} onChange={onChange} onOpenEncounter={() => undefined} />);
    });
    const view = EditorView.findFromDOM(host.querySelector<HTMLElement>('.cm-editor')!)!;
    let scans = 0;
    for (const character of 'Writing without pauses') {
      act(() => view.dispatch({ changes: { from: view.state.doc.length, insert: character } }));
      const content = view.state.doc.toString();
      expect(onChange).toHaveBeenLastCalledWith(content);
      const scan = vi.spyOn(view.state.doc, 'iterLines');
      await act(async () => {
        root?.render(<MarkdownEditor content={content} onChange={(text) => onChange(text)} onOpenEncounter={(id) => onOpenEncounter(id)} />);
      });
      scans += scan.mock.calls.length;
      scan.mockRestore();
    }
    expect(scans).toBe(0);
    expect(view.state.doc.toString()).toBe(`${initialContent}Writing without pauses`);
    await act(async () => host?.querySelector<HTMLButtonElement>('.cm-encounter-reference-chip')?.click());
    expect(onOpenEncounter).toHaveBeenCalledWith(encounterId);
  });
});

describe('MarkdownEditor encounter references', () => {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    root = null;
    host = null;
  });

  it('opens an encounter editor when its edit-mode reference is clicked', async () => {
    const encounterId = 'ad7d5e0d-4b4d-4fd8-9c78-bf44f9205030';
    const onOpenEncounter = vi.fn();
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);

    await act(async () => {
      root?.render(<MarkdownEditor content={`[[encounter:${encounterId}|Goblin ambush]]`} onChange={() => undefined} onOpenEncounter={onOpenEncounter} />);
    });

    const reference = host.querySelector<HTMLButtonElement>('[aria-label="encounter reference: Goblin ambush"]');
    expect(reference?.title).toBe('Open encounter editor');
    await act(async () => reference?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(onOpenEncounter).toHaveBeenCalledWith(encounterId);
  });
});

it('opens the same dungeon inline in Edit and Preview, with independent room folds', async () => {
  const dungeon = createDungeon('Sunken vault');
  const area = dungeon.areas[0];
  area.name = 'Area 1';
  area.imageSource = 'https://example.test/vault.png';
  area.rooms = [{ id: 'gate', name: 'Gate', number: 1, notes: '**Silver latch**', readAloud: 'Cold air pours out.', encounterIds: [], updatedAt: dungeon.updatedAt }];
  area.markers = [{ roomId: 'gate', x: 30, y: 40 }];
  dungeon.areas.push({
    id: 'lower', name: 'Area 2', imageSource: 'https://example.test/lower.png',
    rooms: [{ id: 'vault', name: 'Vault', number: 2, notes: '', readAloud: 'The ceiling glitters.', encounterIds: [], updatedAt: dungeon.updatedAt }],
    markers: [{ roomId: 'vault', x: 40, y: 50 }]
  });
  const reference = formatDungeonReference({ id: dungeon.id, name: 'Old vault name' });
  const missing = formatDungeonReference({ id: 'a001', name: 'Missing vault' });
  const prefix = '# Session\n\n';
  const content = prefix + reference + '\n\n' + missing;
  const onOpenDungeon = vi.fn();
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);

  function BrewWithDungeon() {
    const [record, setRecord] = useState(dungeon);
    const dungeons = new Map([[record.id, record]]);
    const changeRoomText: DungeonRoomTextChange = (id, areaId, roomId, field, value) => {
      setRecord((current) => id === current.id ? updateDungeonRoom(current, areaId, roomId, { [field]: value }) : current);
    };
    return <>
      <MarkdownEditor content={content} dungeons={dungeons} onChange={() => undefined} onOpenDungeon={onOpenDungeon} onDungeonRoomTextChange={changeRoomText} />
      <BrewPreview brew={{
        id: 'brew', title: 'Session', content, version: 1, createdAt: dungeon.createdAt, updatedAt: dungeon.updatedAt,
        rendererSettings: { accentColor: '#6a2f26', parchmentTone: 'warm' }
      }} dungeons={dungeons} onDungeonOpen={() => undefined} onDungeonRoomTextChange={changeRoomText} />
    </>;
  }

  try {
    await act(async () => root.render(<BrewWithDungeon />));

    const editor = host.querySelector<HTMLElement>('.cm-editor')!;
    const view = EditorView.findFromDOM(editor)!;
    const editCard = editor.querySelector<HTMLButtonElement>('button.brew-dungeon-header')!;
    const previewCard = host.querySelector<HTMLButtonElement>('.brew-preview button.brew-dungeon-header')!;
    expect(editor.querySelector('.cm-inline-reference')).toBeNull();
    expect(editCard.textContent).toBe(previewCard.textContent);
    expect(editCard.getAttribute('aria-label')).toBe('Open Sunken vault');
    expect(editCard.querySelector('.brew-dungeon-caption')?.textContent).toBe('Dungeon · 2 rooms');
    expect(editor.querySelector('.brew-dungeon-content')).toBeNull();

    act(() => {
      view.dispatch({ selection: { anchor: 3 } });
      view.focus();
    });
    expect(document.activeElement).toBe(view.contentDOM);
    for (const type of ['pointerdown', 'mousedown']) {
      const press = new MouseEvent(type, { bubbles: true, cancelable: true });
      editCard.querySelector('strong')!.dispatchEvent(press);
      expect(press.defaultPrevented).toBe(true);
    }
    await act(async () => {
      editCard.click();
      previewCard.click();
    });
    expect(document.activeElement).toBe(editCard);
    expect(view.state.selection.main.head).toBe(3);
    const editRooms = [...editor.querySelectorAll<HTMLDetailsElement>('.brew-dungeon-content > .brew-dungeon-room')];
    const previewRooms = [...host.querySelectorAll<HTMLDetailsElement>('.brew-preview .brew-dungeon-content > .brew-dungeon-room')];
    expect(editRooms.map((room) => room.open)).toEqual([true, true]);
    expect(previewRooms.map((room) => room.open)).toEqual([true, true]);
    expect(editRooms.map((room) => room.querySelector('summary')?.textContent)).toEqual(['Gate', 'Vault']);
    expect(previewRooms.map((room) => room.querySelector('summary')?.textContent)).toEqual(['Gate', 'Vault']);
    expect(editor.querySelector('.brew-dungeon-content')?.textContent).not.toMatch(/Area [12]/);
    expect([...editor.querySelectorAll<HTMLImageElement>('.brew-dungeon-map img')].map((image) => image.alt)).toEqual(['Map 1', 'Map 2']);
    expect(editRooms[0].textContent).toContain('Cold air pours out.');
    expect(editRooms[0].querySelector('.dungeon-room-notes strong')?.textContent).toBe('Silver latch');
    expect(onOpenDungeon).not.toHaveBeenCalled();

    const editRoomText = async (room: HTMLDetailsElement, label: string, value: string) => {
      await act(async () => room.querySelector<HTMLButtonElement>(`[aria-label="Edit ${label}"]`)!.click());
      const field = room.querySelector<HTMLTextAreaElement>(`textarea[aria-label="${label}"]`)!;
      expect(document.activeElement).toBe(field);
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(field, value);
        field.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await act(async () => field.blur());
    };
    await editRoomText(editRooms[0], 'Read aloud', 'A **warm wind** rises.');
    expect(previewRooms[0].querySelector('.dungeon-read-aloud strong')?.textContent).toBe('warm wind');
    await editRoomText(previewRooms[1], 'GM notes', 'Watch for the **tripwire**.');
    expect(editRooms[1].querySelector('.dungeon-room-notes strong')?.textContent).toBe('tripwire');
    expect(editRooms[0].querySelector('.dungeon-room-notes strong')?.textContent).toBe('Silver latch');
    expect(view.state.doc.toString()).toBe(content);

    await act(async () => editRooms[0].querySelector('summary')!.click());
    expect(editRooms.map((room) => room.open)).toEqual([false, true]);
    expect(previewRooms[0].open).toBe(true);
    const scrollIntoView = vi.fn();
    Object.defineProperty(editRooms[0], 'scrollIntoView', { value: scrollIntoView });
    await act(async () => editor.querySelector<HTMLButtonElement>('.map-number-pin')!.click());
    expect(editRooms[0].open).toBe(true);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' });

    await act(async () => editRooms[1].querySelector('summary')!.click());
    await act(async () => editCard.click());
    expect(editor.querySelector('.brew-dungeon-content')).toBeNull();
    await act(async () => editCard.click());
    expect([...editor.querySelectorAll<HTMLDetailsElement>('.brew-dungeon-room')].map((room) => room.open)).toEqual([true, true]);

    // A missing reference still opens Dungeons from the card's mapped position.
    act(() => view.dispatch({ changes: { from: 0, insert: prefix } }));
    await act(async () => editor.querySelector<HTMLButtonElement>('[aria-label="Find Missing vault"]')!.click());
    expect(onOpenDungeon).toHaveBeenCalledWith('a001', prefix.length * 2 + reference.length + 2);
    expect(view.state.doc.toString()).toBe(prefix + content);
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});


describe('MarkdownEditor spellchecking', () => {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    root = null;
    host = null;
  });

  it('enables and disables the browser writing assistance attributes', async () => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);

    await act(async () => {
      root?.render(<MarkdownEditor content="" onChange={() => undefined} spellcheckEnabled />);
    });

    const content = host.querySelector<HTMLElement>('.cm-content');
    expect(content?.getAttribute('spellcheck')).toBe('true');
    expect(content?.getAttribute('autocorrect')).toBe('on');
    expect(content?.getAttribute('writingsuggestions')).toBe('true');

    await act(async () => {
      root?.render(<MarkdownEditor content="" onChange={() => undefined} spellcheckEnabled={false} />);
    });

    expect(content?.getAttribute('spellcheck')).toBe('false');
    expect(content?.getAttribute('autocorrect')).toBe('off');
    expect(content?.getAttribute('writingsuggestions')).toBe('false');
  });
});
