(() => {
  const coarsePointer = window.matchMedia('(pointer: coarse)');

  const disableNativeHandleDragging = (root = document) => {
    if (!coarsePointer.matches) return;
    root.querySelectorAll?.('.combatant-drag-handle').forEach((handle) => {
      if (handle instanceof HTMLElement && handle.draggable) {
        handle.draggable = false;
      }
    });
  };

  const start = () => {
    disableNativeHandleDragging();

    const observer = new MutationObserver((mutations) => {
      if (!coarsePointer.matches) return;
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.target instanceof HTMLElement) {
          if (mutation.target.matches('.combatant-drag-handle')) {
            mutation.target.draggable = false;
          }
          continue;
        }
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLElement) {
            if (node.matches('.combatant-drag-handle')) node.draggable = false;
            disableNativeHandleDragging(node);
          }
        }
      }
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['draggable']
    });

    document.addEventListener('dragstart', (event) => {
      if (!coarsePointer.matches) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('.combatant-drag-handle')) {
        event.preventDefault();
      }
    }, true);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
