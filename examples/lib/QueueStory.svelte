<script lang="ts">
  import { onMount } from 'svelte';

  const advance = () => {
    if(ticks>=12)return;
    const processed=Math.min(queue+4,capacity);
    const finished=Math.min(review+processed,3);
    queue=queue+4-processed; review=review+processed-finished;
    completed+=finished; ticks+=1;
    history=[...history,{tick:ticks,waiting:queue+review}];
  };

  const compare = (rate:number) => {
    let upstream=0, downstream=0, done=0;
    for(let i=0;i<8;i++) {
      const processed=Math.min(upstream+4,rate);
      const finished=Math.min(downstream+processed,3);
      upstream+=4-processed; downstream+=processed-finished; done+=finished;
    }
    return {upstream,downstream,done};
  };

  const go = (index: number) => {
    index = Math.max(0, Math.min(chapters.length - 1, index));
    navigating = index;
    active = index;
    requestAnimationFrame(() => steps[index]?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}));
  };

  const reset = () => { capacity=2; ticks=0; queue=0; review=0; completed=0; history=[]; };

  let active = $state(0);
  let inRange = $state(false);
  let navigating: number | null = null;
  let drift = $state(0);
  let root: HTMLElement;
  let steps: HTMLElement[] = [];
  let capacity = $state(2);
  let ticks = $state(0);
  let queue = $state(0);
  let review = $state(0);
  let completed = $state(0);
  let history = $state<{tick:number; waiting:number}[]>([]);
  const chapters = [
    {label:'A hypothesis',title:'“More capacity should mean less waiting.”',text:'Requests are piling up. You and the agent have a plausible idea: let more work happen at once. Before changing a real system, make that assumption visible in a small model.',prompt:'What would you expect to change — and what would stay the same?'},
    {label:'A baseline',title:'Watch where the work waits.',text:'Every round, four requests arrive. Processing can handle two, and review can finish three. Advance a round and watch the processing queue grow. These are chosen assumptions, not measurements from your project.',prompt:'Start with an explicit model so the comparison has a shared reference.'},
    {label:'One change',title:'Give processing more capacity.',text:'Move the processing capacity to five, then advance a few rounds. Keep arrivals and review unchanged. Does more processing help the whole flow, or just move the waiting somewhere else?',prompt:'Change one condition. Observe both queues, not just the stage you improved.'},
    {label:'An observation',title:'The queue can move downstream.',text:'At five requests per round, processing can outpace review. Review still finishes at most three. Compare the two runs below: upstream waiting shrinks, but downstream waiting grows. More work finishes than in the baseline, but review limits further improvement.',prompt:'An improvement can help — and still leave a different limit in place.'},
    {label:'A next experiment',title:'Now ask a more precise question.',text:'The model suggests checking review capacity before adding more processing. Next, measure arrivals and time spent at each stage in a real workflow. Those observations may support this model — or show that its assumptions are wrong.',prompt:'Surface makes the hypothesis explorable. Real evidence determines what to do next.'},
  ];
  const comparisons=[{rate:2,...compare(2)},{rate:5,...compare(5)}];
  onMount(() => {

    const update = () => {
      frame=0;
      const bounds = root.getBoundingClientRect();
      inRange = bounds.top < window.innerHeight * .5 && bounds.bottom > window.innerHeight * .5;
      if (navigating !== null && Math.abs(steps[navigating].getBoundingClientRect().top - 28) < 3) navigating = null;
      if (!desktop.matches) { drift=0; return; }
      // Activate a chapter when its opening reaches the shared reading line.
      let chapter=0;
      steps.forEach((step,index)=>{if(step.getBoundingClientRect().top<=80)chapter=index});
      if (navigating === null) active=chapter;
      drift=reduced.matches?0:Math.max(-10,Math.min(10,(root.getBoundingClientRect().top/window.innerHeight)*6));
    };

    const keydown = (event: KeyboardEvent) => {
      if (!inRange || event.defaultPrevented || event.repeat || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      const target = event.target;
      if (target instanceof Element && target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="slider"],[role="tablist"],[role="listbox"],[role="menu"],[role="tree"],[role="grid"],audio,video')) return;
      if (target instanceof Element && target.closest('button,a') && !target.closest('.chapter-controls')) return;
      const next = active + (event.key === 'ArrowRight' ? 1 : -1);
      if (next < 0 || next >= chapters.length) return;
      event.preventDefault(); go(next);
    };

    let frame = 0;
    const desktop = window.matchMedia('(min-width: 851px)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const schedule=()=>{if(!frame)frame=requestAnimationFrame(update)};
    const cancelNavigation = () => { navigating = null; schedule(); };
    window.addEventListener('keydown',keydown);
    window.addEventListener('wheel',cancelNavigation,{passive:true});
    window.addEventListener('touchstart',cancelNavigation,{passive:true});
    window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);reduced.addEventListener('change',schedule);update();
    return ()=>{window.removeEventListener('keydown',keydown);window.removeEventListener('wheel',cancelNavigation);window.removeEventListener('touchstart',cancelNavigation);cancelAnimationFrame(frame);window.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);reduced.removeEventListener('change',schedule)};
  });
</script>
<section class="story" bind:this={root} aria-label="A story about testing a capacity hypothesis">
  <div class="narrative">
    {#each chapters as chapter,i}
      <article bind:this={steps[i]} class:active={active===i} aria-label={'Experiment chapter '+(i+1)+': '+chapter.label}>
        <p class="eyebrow">0{i+1} / {chapter.label}</p><h2>{chapter.title}</h2><p class="body">{chapter.text}</p><p class="insight">{chapter.prompt}</p>
      </article>
    {/each}
  </div>
  <div class="visual-column"><div class="visual">
    <div class="toolbar"><span>A SMALL EXPERIMENT</span><button onclick={reset}>Reset experiment</button></div>
    <div class="experiment-scene">
      <div class="hypothesis"><span class="tag">You → Agent</span><h3>What if we could process more?</h3><p>4 arrive → processing → review → done</p></div>
      <div class="pipeline" style={'--drift:'+drift+'px'}>
        <div class="stage processing"><span>Waiting to process</span><strong>{queue}</strong><div class="tokens" aria-hidden="true">{#each Array(Math.min(queue,20)) as _}<span></span>{/each}</div><small>Capacity: {capacity} / round</small></div>
        <div class="flow" aria-hidden="true">→</div>
        <div class="stage review"><span>Waiting for review</span><strong>{review}</strong><div class="tokens" aria-hidden="true">{#each Array(Math.min(review,20)) as _}<span></span>{/each}</div><small>Capacity: 3 / round</small></div>
      </div>
      <div class="readout" aria-live="polite">Round {ticks} · {completed} finished · {queue+review} waiting</div>
    </div>
    <div class="experiment-controls">
      <label for="processing-capacity">Processing capacity <strong>{capacity} / round</strong></label>
      <input id="processing-capacity" type="range" min="1" max="6" step="1" bind:value={capacity} />
      <div class="run"><button onclick={advance} disabled={ticks>=12}>Advance one round →</button><small>{ticks>=12?'12 rounds reached. Reset to try again.':'Your changes apply to the next round.'}</small></div>
      {#if history.length}<div class="history" aria-label="Unfinished requests after each round">{#each history as point}<div title={'Round '+point.tick+': '+point.waiting+' waiting'}><span style={'height:'+Math.max(2,point.waiting*2)+'px'}></span><small>{point.tick}</small></div>{/each}</div><p class="chart-label">Waiting after each round · both queues combined</p>{/if}
    </div>
    {#if active>=3}
      <div class="results"><h3>Same arrivals. Eight rounds. Fresh runs.</h3><table><thead><tr><th>Processing</th><th>Queue</th><th>Review</th><th>Done</th></tr></thead><tbody>{#each comparisons as run}<tr><th>{run.rate} / round</th><td>{run.upstream}</td><td>{run.downstream}</td><td>{run.done}</td></tr>{/each}</tbody></table><p>These fixed comparisons restart from empty queues. Your exploratory run above is separate.</p></div>
    {/if}
    <details><summary>Model assumptions</summary><p>Each round adds four requests, processes up to the chosen capacity, then reviews up to three — including work just processed. No variation, failures, transit time, or feedback. Dots show up to twenty requests; counts show the full queues.</p></details>
    <p class="disclaimer">Illustrative model, not a forecast. No real system is measured or changed; no message is sent to an agent.</p>
  </div></div>
</section>
{#if inRange}
  <nav class="chapter-controls" aria-label="Experiment chapters">
    <button disabled={active===0} onclick={()=>go(active-1)} aria-label="Previous experiment chapter" aria-keyshortcuts="ArrowLeft">←</button>
    <div><span aria-live="polite">{active+1} / {chapters.length} · {chapters[active].label}</span><small>Use ← → to explore</small></div>
    <button disabled={active===chapters.length-1} onclick={()=>go(active+1)} aria-label="Next experiment chapter" aria-keyshortcuts="ArrowRight">→</button>
  </nav>
{/if}
<style>
 .story{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,3fr);gap:48px;position:relative;margin-top:48px;padding-bottom:100px}.narrative article{min-height:max(85vh,800px);scroll-margin-top:28px;display:flex;flex-direction:column;justify-content:flex-start;padding:0 0 80px;opacity:.45;transition:opacity .3s}.narrative article.active{opacity:1}.narrative h2{font-size:clamp(27px,3.1vw,39px);line-height:1.16}.body{font-size:18px;color:#5c626c}.insight{font-size:15px;border-left:3px solid #c9b8a7;padding-left:16px;color:#63606b}.visual-column{min-width:0}.visual{position:sticky;top:28px;border:1px solid #e1e3e8;border-radius:20px;background:#fff;box-shadow:0 16px 60px #303a5010;overflow:auto;max-height:calc(100dvh - 140px);margin:0}.toolbar{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid #eceef1;gap:8px}.toolbar span{font-size:10px;letter-spacing:.12em;color:#626b7a}button:focus-visible{outline:3px solid #526176;outline-offset:3px}.toolbar button{background:none;border:0;text-decoration:underline;font-size:12px;color:#626b7a}.chapter-controls{position:fixed;z-index:20;bottom:max(16px,env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);width:min(580px,calc(100% - 32px));background:#fffffff5;border:1px solid #dbe0e7;border-radius:16px;box-shadow:0 8px 32px #303a5020;display:flex;align-items:center;justify-content:space-between;padding:12px 18px;gap:8px}.chapter-controls div{text-align:center}.chapter-controls small{display:block;font-size:10px;color:#707580}.chapter-controls button{border:1px solid #dbe0e7;border-radius:50%;width:44px;height:44px;flex-shrink:0;background:#fff;color:#526176}.chapter-controls button:disabled{opacity:.3;cursor:default}.chapter-controls span{font-size:12px;color:#626b79}.disclaimer{font-size:10px;color:#707580;padding:0 20px 16px;margin:0;line-height:1.5}
button{font:inherit;cursor:pointer}.experiment-scene{padding:20px;background:linear-gradient(125deg,#edf1f7,#f4eff7 55%,#f7ede3)}.hypothesis h3{font-size:22px;margin:6px 0}.hypothesis p,.tag{font-size:12px;color:#626b7a}.pipeline{display:grid;grid-template-columns:1fr 22px 1fr;align-items:center;gap:6px;margin:20px 0;transform:translateY(var(--drift))}.stage{min-height:150px;background:#ffffffb0;border:1px solid #cbd3df;border-radius:12px;padding:12px;display:flex;flex-direction:column}.stage>span,.stage small{font-size:11px}.stage strong{font-size:32px;color:#526784}.stage.review{border-color:#c9b1cd}.stage.review strong{color:#84668c}.tokens{display:flex;flex-wrap:wrap;gap:4px;min-height:24px;margin:6px 0}.tokens span{width:9px;height:9px;border-radius:3px;background:#8298b5}.review .tokens span{background:#b39abb}.flow{color:#8b8291}.readout{text-align:center;font-size:12px;color:#526176}.experiment-controls{padding:16px 20px}.experiment-controls label{display:flex;justify-content:space-between;font-size:12px;gap:10px}input{width:100%;accent-color:#657b99;margin:12px 0}.run{display:flex;align-items:center;gap:12px}.run button{background:#526784;color:#fff;border:0;border-radius:8px;padding:10px;font-size:12px}.run button:disabled{opacity:.5}.run small{font-size:10px;color:#6a707a}.history{display:flex;align-items:end;gap:8px;height:76px;margin-top:8px}.history>div{display:flex;flex-direction:column;align-items:center;flex:1}.history span{background:#b8a4c2;width:100%;max-width:24px;border-radius:3px 3px 0 0}.history small{font-size:9px;color:#74707a}.chart-label{font-size:10px;color:#74707a;margin:4px 0}.results{padding:0 20px 12px}.results h3{font-size:13px;margin:0 0 8px}table{border-collapse:collapse;width:100%;font-size:11px;text-align:left}th,td{padding:7px 4px;border-bottom:1px solid #e4e1e8}.results p,details p{font-size:11px;color:#666572;line-height:1.5}details{padding:4px 20px 16px}summary{font-size:11px;color:#626b7a;cursor:pointer}@media(max-width:850px){.story{grid-template-columns:1fr;gap:0}.narrative article{display:none;min-height:0;padding:20px 0}.narrative article.active{display:block}.visual{position:static;max-height:none;margin:12px 0}.body{font-size:17px}.narrative h2{font-size:30px}.experiment-scene{padding:14px}.stage{padding:9px}.run{align-items:start;flex-direction:column}}@media(prefers-reduced-motion:reduce){.narrative article{transition:none}.pipeline{transform:none}}
</style>
