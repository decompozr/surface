/** Freeze the document behind an overlay while preserving its exact scroll position. */
export function lockPageScroll(): () => void {
  const body = document.body;
  const root = document.documentElement;
  const x = window.scrollX, y = window.scrollY;
  const changes: [HTMLElement, Record<string, string>][] = [
    [root, { overflow: 'hidden', 'scroll-behavior': 'auto' }],
    // Fixed positioning also prevents background movement on mobile Safari.
    [body, { position: 'fixed', top: `${-y}px`, left: `${-x}px`, width: '100%', overflow: 'hidden' }],
  ];
  const saved = changes.flatMap(([element, properties]) => Object.keys(properties).map(property => ({
    element, property, value: element.style.getPropertyValue(property), priority: element.style.getPropertyPriority(property),
  })));
  for (const [element, properties] of changes) for (const [property, value] of Object.entries(properties)) {
    element.style.setProperty(property, value, 'important');
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    // Keep restoration instant even when the consumer enables smooth scrolling.
    for (const { element, property, value, priority } of saved) {
      if (property === 'scroll-behavior') continue;
      if (value) element.style.setProperty(property, value, priority);
      else element.style.removeProperty(property);
    }
    window.scrollTo(x, y);
    const behavior = saved.find(entry => entry.property === 'scroll-behavior')!;
    if (behavior.value) root.style.setProperty(behavior.property, behavior.value, behavior.priority);
    else root.style.removeProperty(behavior.property);
  };
}
