<script lang="ts">
  import { onMount } from 'svelte';
  import { Toolbar, ToggleButton } from '@decompozr/design-system';
  let { active, disabled, onchoose }: {
    active: 'comment' | 'capture' | null;
    disabled: boolean;
    onchoose: (action: 'comment' | 'capture') => void;
  } = $props();
  let host: HTMLDivElement;
  let x = $state(16), y = $state(80);
  let drag: { pointer: number; x: number; y: number; originX: number; originY: number } | null = null;
  const constrain = () => {
    x = Math.max(8, Math.min(x, window.innerWidth - (host?.offsetWidth ?? 96) - 8));
    y = Math.max(40, Math.min(y, window.innerHeight - (host?.offsetHeight ?? 36) - 32));
  };
  const save = () => {
    try { localStorage.setItem('surface.comment-tools.position', JSON.stringify({ x, y })); } catch { /* Position remains usable without browser storage. */ }
  };
  const start = (event: PointerEvent) => {
    if (event.target instanceof Element && event.target.closest('button')) return;
    drag = { pointer: event.pointerId, x: event.clientX, y: event.clientY, originX: x, originY: y };
    host.setPointerCapture(event.pointerId); event.preventDefault();
  };
  const move = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.pointer) return;
    x = drag.originX + event.clientX - drag.x; y = drag.originY + event.clientY - drag.y; constrain();
  };
  const end = () => { if (drag) { drag = null; save(); } };
  const key = (event: KeyboardEvent) => {
    if (event.target !== host || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    x += event.key === 'ArrowLeft' ? -10 : event.key === 'ArrowRight' ? 10 : 0;
    y += event.key === 'ArrowUp' ? -10 : event.key === 'ArrowDown' ? 10 : 0;
    constrain(); save();
  };
  onMount(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem('surface.comment-tools.position') ?? 'null');
      if (saved && typeof saved === 'object' && 'x' in saved && 'y' in saved && typeof saved.x === 'number' && Number.isFinite(saved.x) && typeof saved.y === 'number' && Number.isFinite(saved.y)) { x = saved.x; y = saved.y; }
    } catch { /* Invalid saved position never prevents toolbar access. */ }
    constrain(); window.addEventListener('resize', constrain);
    return () => window.removeEventListener('resize', constrain);
  });
</script>
<!-- The focusable group provides keyboard movement of this spatial control; its children retain Toolbar action navigation. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div bind:this={host} class="floating-tools" role="group" aria-label="Move comment tools" tabindex="0" title="Drag toolbar background to move; arrow keys when focused" style:left={`${x}px`} style:top={`${y}px`} onpointerdown={start} onpointermove={move} onpointerup={end} onpointercancel={end} onkeydown={key}>
  <Toolbar label="Comment tools" appearance="floating">
    <ToggleButton size="compact" touchAppearance="compact" icon="message-square" label="Comment" title="Comment: choose an element, or hover and press C" aria-keyshortcuts="C" pressed={active === 'comment'} {disabled} onPressedChange={() => onchoose('comment')} />
    <ToggleButton size="compact" touchAppearance="compact" icon="camera" label="Screenshot" title="Screenshot: choose an element, or hover and press S" aria-keyshortcuts="S" pressed={active === 'capture'} {disabled} onPressedChange={() => onchoose('capture')} />
  </Toolbar>
</div>
<style>
  .floating-tools { position:fixed; z-index:61; width:max-content; touch-action:none; cursor:move; --dz-action-coarse-target:2rem; }
</style>
