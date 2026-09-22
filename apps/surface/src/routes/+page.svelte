<svelte:head>
  <title>Surface</title>
  <meta name="description" content="A shared interactive environment for people and agents." />
</svelte:head>

<main>
  <p class="eyebrow">Development preview</p>
  <h1>Surface</h1>
  <p>A shared interactive environment for people and agents.</p>
  <a href="/health" data-sveltekit-reload>Server health</a>
</main>

<style>
  :global(body) {
    margin: 0;
    background: #f3f5f2;
    color: #213c33;
    font-family: system-ui, sans-serif;
  }
  main { max-width: 760px; margin: 12vh auto; padding: 32px; }
  .eyebrow { font-size: 12px; letter-spacing: .12em; text-transform: uppercase; }
  h1 { margin: 16px 0; font-size: clamp(48px, 10vw, 80px); letter-spacing: -.04em; }
  p { line-height: 1.6; }
  a { display: inline-block; margin-top: 20px; color: #245b44; text-underline-offset: 4px; }
</style>
