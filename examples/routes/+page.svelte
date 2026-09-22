<script lang="ts">
  import Guide from '../lib/Guide.svelte';
  import ArchitectureStory from '../lib/ArchitectureStory.svelte';
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

  <section class="section"><p class="eyebrow">A story you can explore</p><h2>One vague request. A more useful question.</h2><p class="lead">Follow the conversation. Scroll to reveal each chapter, or use the arrows to move through the story. Your selections stay with you.</p></section>
  <ArchitectureStory />

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
  .next{margin-top:28px}
  @media(max-width:800px){.reading{font-size:17px}}
</style>
