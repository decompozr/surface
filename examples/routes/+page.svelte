<script lang="ts">
  import Guide from '../lib/Guide.svelte';
  const base = window.location.pathname.split('/examples')[0] + '/examples';
</script>

<Guide>
  <p class="eyebrow">Meet Surface</p>
  <h1>Make ideas tangible.<br />Explore them together.</h1>
  <p class="lead">Surface gives people and agents a shared place to see an idea, interact with it, and discover what matters. Use visuals and small experiments to clarify intent, explore possibilities, and decide what to try next.</p>

  <section class="section reading">
    <p class="eyebrow">Why</p>
    <h2>Some ideas become clearer when you can work with them.</h2>
    <p>“Make this simpler” can mean fewer steps, fewer dependencies, or less to learn. A conversation gives the idea a starting point. A diagram, a comparison, or an adjustable model gives you something concrete to explore together.</p>
    <p>You can point to what feels wrong, change a relationship, or try an alternative. Those interactions help reveal preferences, constraints, and questions that were difficult to put into words.</p>
  </section>

  <section class="section">
    <p class="eyebrow">How</p>
    <h2>A loop for understanding, not just input.</h2>
    <ol class="intent-loop" aria-label="The exploration loop">
      <li><span>01</span><strong>Express an idea</strong><p>Start with a question, a desired outcome, or an assumption.</p></li>
      <li><span>02</span><strong>Make it tangible</strong><p>Give the idea a visual or interactive form you can examine.</p></li>
      <li><span>03</span><strong>Explore together</strong><p>Adjust, compare, select, or run a small experiment.</p></li>
      <li><span>04</span><strong>Observe & clarify</strong><p>Discuss what happened and confirm what it means.</p></li>
      <li><span>05</span><strong>Refine the idea</strong><p>Carry what you learned into the next question or decision.</p></li>
    </ol>
    <p class="loop-return">Each round gives the next exploration a clearer starting point.</p>
  </section>

  <section class="section reading example">
    <p class="eyebrow">For example</p>
    <h2>“I want this architecture to be simpler.”</h2>
    <p>Your project presents a dependency diagram. You highlight a cluster that feels difficult to understand and compare a version with fewer connections. Together with the agent, you discover that your concern is how many systems a single change touches.</p>
    <p>You then try a small change and examine its effects. The next step can now address a specific concern, with your observations and tradeoffs attached, instead of guessing what “simpler” meant.</p>
    <p class="note">An interaction is an observation, not automatically a confirmed intention. An experiment result is evidence to interpret, not automatically a requirement. You and the agent clarify those meanings together.</p>
  </section>

  <section class="section reading">
    <p class="eyebrow">What</p>
    <h2>The shared space behind that exploration.</h2>
    <p>Surface is a runtime for interactive representations owned by a project. A project can bring a graph, a form, a simulation, or an editor into that shared space and receive structured observations and responses.</p>
    <p>The project provides the domain meaning. Surface makes the representation available for interaction. People and agents interpret the observations, confirm intent, and choose the next step.</p>
    <p class="note">The current development implementation supports local Svelte pages, live editing, and scoped agent interactions. Projects supply their own visuals and experiments; Surface does not infer intent or validate a hypothesis on its own.</p>
    <div class="next"><a class="button" href={base + '/counter'}>Try a simple interaction →</a><a class="button secondary" href={base + '/setup'}>Set up your first Surface</a></div>
  </section>
</Guide>

<style>
  .reading{max-width:760px;font-size:18px}
  .reading>p:not(.eyebrow){color:#5c626c}
  .intent-loop{list-style:none;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:24px;padding:0;margin:30px 0 16px}
  .intent-loop li{border-top:2px solid #dfe3e9;padding-top:16px}
  .intent-loop span{display:block;font-size:12px;color:#6b7079;margin-bottom:12px}
  .intent-loop strong{display:block;font-size:16px;margin-bottom:8px}
  .intent-loop p,.loop-return{font-size:15px;color:#5c626c}
  .intent-loop li:nth-child(2){border-color:#dfd5cd}.intent-loop li:nth-child(3){border-color:#d9d5e5}.intent-loop li:nth-child(4){border-color:#d5dce0}.intent-loop li:nth-child(5){border-color:#c8d1df}
  .example{padding:28px;border:1px solid #e3e4e7;border-radius:10px;background:#fafafa}
  .next{margin-top:28px}
  @media(max-width:800px){.intent-loop{grid-template-columns:1fr;gap:16px}.intent-loop li{display:grid;grid-template-columns:32px 1fr;column-gap:12px}.intent-loop p{grid-column:2}.intent-loop span{grid-row:1 / 3}.example{padding:22px}.reading{font-size:17px}}
</style>
