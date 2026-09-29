<script lang="ts">
 import {ToggleButton,IconButton,TextArea} from '@decompozr/design-system';
 import Review from '../../lib/Review.svelte';
 let pressed=$state(false);let value=$state('');
</script>
<Review title="Controls and focus" description="First review: mode state and keyboard focus must mean different things.">
<section><h2>Interactive selection control</h2><div class="row"><ToggleButton icon="mouse-pointer-2" label="Selection mode specimen" size="compact" touchAppearance="compact" bind:pressed onclick={e=>{if(e.detail>0)e.currentTarget.blur();}}/><span>Selection mode: {pressed?'on':'off'}</span></div><p class="note">Click twice: the control returns to idle. Press Tab: keyboard focus remains visible. Press Space on the focused control: the mode changes without moving focus.</p></section>
<section><h2>Independent states</h2><div class="row"><ToggleButton icon="mouse-pointer-2" label="Idle selection specimen" size="compact" pressed={false}/><span>Idle</span><ToggleButton icon="mouse-pointer-2" label="Active selection specimen" size="compact" pressed={true}/><span>Active</span><IconButton icon="camera" label="Disabled capture specimen" size="compact" disabled/><span>Disabled</span></div></section>
<section><h2>Typing boundary</h2><TextArea label="Draft specimen" bind:value rows={3}/><p class="note">Type C, S and V here. Page shortcuts must not interrupt typing.</p></section>
<section><h2>Real selection test</h2><p>Hover over this paragraph and use the surrounding Surface controls: C opens a comment, S captures, V toggles selection. This uses the actual shell rather than a simulated toolbar.</p></section>
</Review>
