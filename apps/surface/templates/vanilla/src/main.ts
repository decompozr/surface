import { createInteractionClient } from './interactions';
const form = document.querySelector<HTMLFormElement>('form')!;
const button = document.querySelector<HTMLButtonElement>('button')!;
const status = document.querySelector<HTMLElement>('[role=status]')!;
const output = document.querySelector<HTMLElement>('pre')!;
const responseId = crypto.randomUUID();
form.addEventListener('submit', async event => {
  event.preventDefault();
  button.disabled = true;
  try {
    const client = createInteractionClient();
    const current = await client.read();
    if (!current.response) {
      const message = String(new FormData(form).get('message'));
      const request = await client.submit({ message }, responseId);
      status.textContent = `Submission ${request.response?.status ?? 'saved'}. Waiting for the agent result.`;
    }
    output.textContent = JSON.stringify(await client.waitForResult(), null, 2);
    status.textContent = 'Agent result received.';
  } catch (error) { status.textContent = error instanceof Error ? error.message : String(error); }
});

if (new URL(location.href).searchParams.has('request')) {
  void (async () => {
    try {
      const client = createInteractionClient();
      const current = await client.read();
      if (current.response) {
        button.disabled = true;
        const input = document.querySelector<HTMLTextAreaElement>('textarea')!;
        input.value = typeof current.response.data.message === 'string' ? current.response.data.message : '';
        input.disabled = true;
        status.textContent = `Existing submission: ${current.response.status}.`;
        output.textContent = JSON.stringify(current.result ?? await client.waitForResult(), null, 2);
        status.textContent = 'Agent result received.';
      }
    } catch (error) { status.textContent = error instanceof Error ? error.message : String(error); }
  })();
} else { status.textContent = 'Preview only. Open a Surface interaction link to send data.'; }
