import { useEffect, useId, useRef, useState } from 'react';
import { catalogueCategories, catalogueCategoryLabel, type CatalogueCategory, type CustomCatalogueCategory } from '../catalogue/types';

type ReferenceMenuProps = {
  customCategories?: readonly CustomCatalogueCategory[];
  onBrowseCatalogue: () => void;
  onSelectCategory: (category: CatalogueCategory) => void;
};

export function ReferenceMenu({ customCategories = [], onBrowseCatalogue, onSelectCategory }: ReferenceMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return undefined;

    const closeOutsideMenu = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', closeOutsideMenu);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutsideMenu);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div className="toolbar-reference-menu" ref={menuRef}>
      <button
        aria-controls={menuId}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((visible) => !visible)}
        type="button"
      >
        Reference <span aria-hidden="true">⌄</span>
      </button>
      {open && (
        <div aria-label="Reference options" className="reference-menu" id={menuId} role="menu">
          <button
            className="reference-menu-browse"
            onClick={() => {
              onBrowseCatalogue();
              setOpen(false);
            }}
            role="menuitem"
            type="button"
          >
            Browse catalogue
          </button>
          <div aria-hidden="true" className="reference-menu-divider" role="separator" />
          <p className="reference-menu-label">Add selected text as</p>
          {[...catalogueCategories, ...customCategories.map((category) => category.id)].map((category) => (
            <button
              key={category}
              onClick={() => {
                onSelectCategory(category);
                setOpen(false);
              }}
              role="menuitem"
              type="button"
            >
              {catalogueCategoryLabel(category, customCategories)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
