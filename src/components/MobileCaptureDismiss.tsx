import { useEffect } from 'react';

export function MobileCaptureDismiss() {
  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const menu = document.querySelector<HTMLElement>('.mobile-capture-menu');
      if (!menu || menu.contains(target)) return;

      const toggle = menu.querySelector<HTMLButtonElement>('.mobile-outline-fab[aria-expanded="true"]');
      toggle?.click();
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, []);

  return null;
}
