<script lang="ts">
  import { onMount } from 'svelte';
  import { workbench } from '../workbench/state.svelte';
  import { readViewport, observeViewport } from '../comments/viewport';
  import { Toolbar, ToggleButton, DragHandle } from '@decompozr/design-system';
  let { active, disabled, onchoose }: {
    active: 'comment' | 'capture' | null;
    disabled: boolean;
    onchoose: (action: 'comment' | 'capture') => void;
  } = $props();
  let host: HTMLDivElement;
  let x = $state(16), y = $state(80);
  let narrow = $state(false);
  let viewport = $state({x:0,y:0,width:390,height:844});
  let width = $state(96), height = $state(36);
  const placedY = $derived(narrow ? viewport.y + viewport.height - (workbench.status ? 24 : 0) - height - 8 : y);
  const placedX = $derived(narrow ? viewport.x + (viewport.width-width)/2 : Math.max(x, !narrow && workbench.left ? workbench.leftWidth + 16 : 8));
  let drag: { pointer: number; x: number; y: number; originX: number; originY: number } | null = null;
  const constrain = () => {
    viewport = readViewport(window);
    if(narrow) return;
    x = Math.max(8, Math.min(x, window.innerWidth - (host?.offsetWidth ?? 96) - 8));
    y = Math.max(40, Math.min(y, window.innerHeight - (host?.offsetHeight ?? 36) - 32));
  };
  const save = () => {
    try { localStorage.setItem('surface.comment-tools.position', JSON.stringify({ x, y })); } catch { /* Position remains usable without browser storage. */ }
  };
  const start = (event: PointerEvent) => {
    if(narrow) return;
    drag = { pointer: event.pointerId, x: event.clientX, y: event.clientY, originX: placedX, originY: y };
    if(event.currentTarget instanceof HTMLElement)event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault();
  };
  const move = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.pointer) return;
    x = drag.originX + event.clientX - drag.x; y = drag.originY + event.clientY - drag.y; constrain();
  };
  const end = () => { if (drag) { drag = null; save(); } };
  const key = (event: KeyboardEvent) => {
    if (narrow || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
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
    const media = window.matchMedia('(max-width: 760px)');
    const syncWidth = () => { narrow = media.matches; };
    syncWidth(); media.addEventListener('change', syncWidth);
    constrain(); window.addEventListener('resize', constrain);
    const stopViewport = observeViewport(window, constrain);
    return () => { window.removeEventListener('resize', constrain); media.removeEventListener('change', syncWidth); stopViewport(); };
  });
</script>
<div bind:this={host} bind:clientWidth={width} bind:clientHeight={height} hidden={narrow && workbench.left} class="floating-tools" role="group" aria-label="Comment tools position" style:left={`${placedX}px`} style:top={`${placedY}px`}>
  <Toolbar label="Comment tools" appearance="floating">
    {#if !narrow}<DragHandle label="Move comment tools" onpointerdown={start} onpointermove={move} onpointerup={end} onpointercancel={end} onkeydown={key} />{/if}
    <ToggleButton size="compact" touchAppearance="compact" icon="message-square" label="Comment" title="Comment: choose an element, or hover and press C" aria-keyshortcuts="C" pressed={active === 'comment'} {disabled} onPressedChange={() => onchoose('comment')} />
    <ToggleButton size="compact" touchAppearance="compact" icon="camera" label="Screenshot" title="Screenshot: choose an element, or hover and press S" aria-keyshortcuts="S" pressed={active === 'capture'} {disabled} onPressedChange={() => onchoose('capture')} />
  </Toolbar>
</div>
<style>
  .floating-tools { position:fixed; z-index:61; width:max-content; --dz-action-coarse-target:2rem; }
</style>
