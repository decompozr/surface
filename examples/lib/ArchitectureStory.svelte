<script lang="ts">
  import { onMount } from 'svelte';
  let active = $state(0);
  let selected = $state('Billing');
  let choice = $state<'current' | 'proposal' | null>(null);
  let confirmed = $state(false);
  let drift = $state(0);
  let root: HTMLElement;
  let steps: HTMLElement[] = [];
  const chapters = [
    { label: 'An intention', title: '“Can we make this simpler?”', text: 'You are working with an agent on a growing product. Every change seems to touch something else. You ask for a simpler architecture — but neither of you knows exactly what “simpler” should mean.', prompt: 'Fewer services? Fewer connections? Less to remember?' },
    { label: 'A shared picture', title: 'First, make the question visible.', text: 'The agent brings a small dependency map into Surface. Now you have something to point at. Six services is not necessarily too many. The relationships might matter more than the count.', prompt: 'A representation gives the conversation a shared reference.' },
    { label: 'A revealing interaction', title: '“This is the part that worries me.”', text: 'You select Billing. Five direct connections light up in this illustrative map. You can now name the concern: changing one service means checking several relationships. Try selecting another service.', prompt: 'A click reveals a question. It does not answer it for you.' },
    { label: 'A useful comparison', title: 'Try a different arrangement.', text: 'The agent proposes keeping only two direct connections to Billing and moving three behind Orders. There are still six services and five links. Less coupling here means more responsibility elsewhere. Switch between the arrangements and inspect the tradeoff.', prompt: 'A proposal is something to examine, not a conclusion.' },
    { label: 'A clearer next step', title: '“I mean fewer places to check.”', text: 'You clarify that your priority is the reach of a billing change, not simply fewer boxes. The next experiment is to trace a real change through both designs and compare the effort. The diagram helped you ask a more precise question.', prompt: 'Confirmed intent guides the next experiment. It does not make the proposal proven.' },
  ];
  const nodes = [
    { name:'Billing', x:50, y:48 }, { name:'Orders', x:21, y:18 },
    { name:'Accounts', x:79, y:18 }, { name:'Reports', x:16, y:78 },
    { name:'Messages', x:50, y:87 }, { name:'Analytics', x:84, y:78 },
  ];
  const mode = $derived(choice ?? (active >= 3 ? 'proposal' : 'current'));
  const edges = $derived(mode === 'current' ? [[0,1],[0,2],[0,3],[0,4],[0,5]] : [[0,1],[0,2],[1,3],[1,4],[1,5]]);
  const selectedIndex = $derived(nodes.findIndex(n=>n.name===selected));
  const neighbors = $derived(edges.filter(e=>e.includes(selectedIndex)).map(e=>e[0]===selectedIndex?e[1]:e[0]));
  function go(index: number) {
    active = index;
    requestAnimationFrame(() => steps[index]?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}));
  }
  function reset() { selected='Billing'; choice=null; confirmed=false; }
  onMount(() => {
    let frame = 0;
    const desktop = window.matchMedia('(min-width: 851px)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    function update() {
      frame=0;
      if (!desktop.matches) { drift=0; return; }
      // Activate a chapter when its opening reaches the shared reading line.
      let chapter=0;
      steps.forEach((step,index)=>{if(step.getBoundingClientRect().top<=80)chapter=index});
      active=chapter;
      drift=reduced.matches?0:Math.max(-10,Math.min(10,(root.getBoundingClientRect().top/window.innerHeight)*6));
    }
    const schedule=()=>{if(!frame)frame=requestAnimationFrame(update)};
    window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);reduced.addEventListener('change',schedule);update();
    return ()=>{cancelAnimationFrame(frame);window.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);reduced.removeEventListener('change',schedule)};
  });
</script>

<section class="story" bind:this={root} aria-label="A story about simpler architecture">
  <div class="narrative">
    {#each chapters as chapter,i}
      <article bind:this={steps[i]} class:active={active===i} aria-label={'Chapter '+(i+1)+': '+chapter.label}>
        <p class="eyebrow">0{i+1} / {chapter.label}</p><h2>{chapter.title}</h2><p class="body">{chapter.text}</p><p class="insight">{chapter.prompt}</p>
      </article>
    {/each}
  </div>
  <div class="visual-column"><div class="visual">
    <div class="toolbar"><span>AN EXPLORATION, TOGETHER</span><button onclick={reset}>Reset demo</button></div>
    <div class="scene" style={'--drift:'+drift+'px'}>
      {#if active===0}
        <div class="question"><span class="tag">You → Agent</span><blockquote>“Make this<br />simpler.”</blockquote><div class="possibilities"><span>Fewer parts?</span><span>Fewer dependencies?</span><span>Less effort?</span></div><p>One sentence. Several possible meanings.</p></div>
      {:else}
        <div class="diagram-title"><strong>{mode==='current'?'The current arrangement':'A possible arrangement'}</strong><span>Illustrative dependencies · 6 services</span></div>
        <div class="graph">
          <svg viewBox="0 0 600 360" aria-hidden="true">
            {#each edges as [a,b]}
              <line x1={nodes[a].x*6} y1={nodes[a].y*3.6} x2={nodes[b].x*6} y2={nodes[b].y*3.6} class:highlight={a===selectedIndex||b===selectedIndex} />
            {/each}
          </svg>
          {#each nodes as node,i}
            <button class="node" class:selected={selected===node.name} class:neighbor={neighbors.includes(i)} style={'left:'+node.x+'%;top:'+node.y+'%'} aria-pressed={selected===node.name} aria-label={'Inspect '+node.name} onclick={()=>selected=node.name}>{node.name}</button>
          {/each}
        </div>
        <p class="graph-readout" aria-live="polite">{selected}: {neighbors.length} direct connections in this sketch.</p>
      {/if}
    </div>
    {#if active>=3}
      <div class="comparison" aria-label="Compare arrangements"><button class:chosen={mode==='current'} aria-pressed={mode==='current'} onclick={()=>choice='current'}>Current arrangement</button><button class:chosen={mode==='proposal'} aria-pressed={mode==='proposal'} onclick={()=>choice='proposal'}>Proposed arrangement</button></div>
      <p class="tradeoff">{mode==='proposal'?'Billing has 2 direct links; Orders now has 4. The complexity moved — it did not disappear.':'Billing has 5 direct links; the other services each have 1. What would a change require you to check?'}</p>
    {/if}
    {#if active===4}
      <div class="confirmation"><button onclick={()=>confirmed=!confirmed} aria-pressed={confirmed}>{confirmed?'Preference noted in this demo ✓':'My priority is fewer places to check'}</button><p>{confirmed?'Next: test a real billing change against both arrangements.':'Confirm an interpretation, then investigate the proposal.'}</p></div>
    {/if}
    <div class="chapter-controls"><button disabled={active===0} onclick={()=>go(active-1)} aria-label="Previous chapter">←</button><span aria-live="polite">{active+1} / {chapters.length} · {chapters[active].label}</span><button disabled={active===4} onclick={()=>go(active+1)} aria-label="Next chapter">→</button></div>
    <p class="disclaimer">Interactive illustration. No real system is analyzed or changed; no message is sent to an agent.</p>
  </div></div>
</section>

<style>
 .story{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,3fr);gap:48px;position:relative;margin-top:48px}.narrative article{min-height:max(85vh,800px);scroll-margin-top:28px;display:flex;flex-direction:column;justify-content:flex-start;padding:0 0 80px;opacity:.45;transition:opacity .3s}.narrative article.active{opacity:1}.narrative h2{font-size:clamp(27px,3.1vw,39px);line-height:1.16}.body{font-size:18px;color:#5c626c}.insight{font-size:15px;border-left:3px solid #c9b8a7;padding-left:16px;color:#63606b}.visual-column{min-width:0}.visual{position:sticky;top:28px;border:1px solid #e1e3e8;border-radius:20px;background:#fff;box-shadow:0 16px 60px #303a5010;overflow:hidden;margin:0}.toolbar{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid #eceef1;gap:8px}.toolbar span{font-size:10px;letter-spacing:.12em;color:#626b7a}button{font:inherit;cursor:pointer}button:focus-visible{outline:3px solid #526176;outline-offset:3px}.toolbar button{background:none;border:0;text-decoration:underline;font-size:12px;color:#626b7a}.scene{background:linear-gradient(135deg,#eff3f8,#f4f0f7 55%,#f9f1e9);padding:24px 14px 12px;min-height:330px}.question{padding:20px;transform:translateY(var(--drift))}.tag{font-size:12px;color:#6b6178}.question blockquote{font-size:clamp(36px,4.5vw,57px);line-height:1.1;letter-spacing:-.04em;margin:22px 0;color:#394758}.possibilities{display:flex;flex-wrap:wrap;gap:8px}.possibilities span{padding:7px 10px;border:1px solid #d4cddf;border-radius:8px;font-size:12px;background:#ffffff90}.question p{font-size:13px;color:#656676;margin-top:20px}.diagram-title{display:flex;flex-direction:column;padding:0 8px;gap:3px}.diagram-title strong{font-size:16px}.diagram-title span{font-size:11px;color:#686f7b}.graph{position:relative;aspect-ratio:5/3;transform:translateY(var(--drift))}.graph svg{width:100%;height:100%;position:absolute;inset:0}.graph line{stroke:#bfc5d0;stroke-width:2;transition:stroke .3s}.graph line.highlight{stroke:#bb8566;stroke-width:3}.node{position:absolute;transform:translate(-50%,-50%);border:1px solid #cbd3df;border-radius:9px;background:#fff;padding:10px 12px;font-size:12px;color:#45516a;box-shadow:0 4px 10px #3743540a;transition:background .25s}.node.selected{background:#526784;color:white;border-color:#526784}.node.neighbor{background:#f4e6dc;border-color:#c8a991;color:#5b4539}.graph-readout{text-align:center;font-size:12px;margin:12px 0 0;color:#535e71}.comparison{display:flex;gap:8px;padding:16px 18px 8px}.comparison button{flex:1;border:1px solid #d8dce3;background:#fff;padding:9px 6px;border-radius:8px;font-size:12px;color:#526176}.comparison .chosen{background:#e9edf4;border-color:#8493ab}.tradeoff{font-size:12px;line-height:1.5;color:#68636b;padding:0 20px;margin:0 0 12px}.confirmation{margin:10px 18px;padding:12px;background:#f0eef5;border-radius:9px}.confirmation button{background:none;border:0;color:#514763;font-size:13px;font-weight:600;text-align:left}.confirmation p{font-size:12px;color:#665e70;margin:8px 0 0}.chapter-controls{display:flex;align-items:center;justify-content:space-between;padding:12px 18px;gap:8px}.chapter-controls button{border:1px solid #dbe0e7;border-radius:50%;width:32px;height:32px;background:#fff;color:#526176}.chapter-controls button:disabled{opacity:.3;cursor:default}.chapter-controls span{font-size:12px;color:#626b79}.disclaimer{font-size:10px;color:#707580;padding:0 20px 16px;margin:0;line-height:1.5}@media(max-width:850px){.story{grid-template-columns:1fr;gap:0}.narrative article{display:none;min-height:0;padding:20px 0}.narrative article.active{display:block}.visual{position:static;margin:12px 0}.scene{min-height:270px}.node{padding:8px;font-size:10px}.body{font-size:17px}.graph{min-height:0}.narrative h2{font-size:30px}}@media(prefers-reduced-motion:reduce){.narrative article,.graph line,.node{transition:none}.question,.graph{transform:none}}
</style>
