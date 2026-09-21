import { writable, fromStore } from 'svelte/store';

// Explicit preview-session state: survives component HMR, not document reloads.
// Bump the version when changing the shape/meaning of a stored value.
const records = import.meta.hot?.data.records ?? new Map();
if (import.meta.hot) {
  import.meta.hot.data.records = records;
  import.meta.hot.accept();
}
export function previewState(key, initial, version = 1) {
  const scope = location.pathname + '?component=' + (new URL(location.href).searchParams.get('component') ?? '');
  const identity = scope + ':' + key;
  let record = records.get(identity);
  if (!record || record.version !== version) {
    record = { version, store: writable(initial) };
    records.set(identity, record);
  }
  return record.store;
}

const metadata = document.getElementById('artifact-preview-context');
const context = metadata ? JSON.parse(metadata.textContent) : null;
const hostProps = writable(context?.props ?? {});
export function previewProps() {
  const current = fromStore(hostProps);
  return new Proxy({}, {
    get: (_, key) => current.current[key],
    has: (_, key) => key in current.current,
    ownKeys: () => Reflect.ownKeys(current.current),
    getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
  });
}
if (context && import.meta.hot) {
  let revision = 0;
  let pendingRevision;
  const own = (file = '') => {
    const clean = file.replace(/^\/@fs/, '').replace(/\\/g, '/');
    return clean.startsWith(context.source + '/') || clean.includes('/mounts/' + context.namespace + '/' + context.name + '/') || clean.includes('virtual:artifact-component/' + context.namespace + '/' + context.name + '/');
  };
  const clear = () => document.getElementById('artifact-compiler-error')?.remove();
  function show(error) {
    revision++;
    clear();
    const panel = document.createElement('aside');
    panel.id = 'artifact-compiler-error';
    panel.setAttribute('role', 'alert');
    panel.style.cssText = 'position:fixed;inset:16px 16px auto;max-height:45vh;overflow:auto;background:#fff0ed;color:#712219;border:1px solid #cd796c;padding:20px;z-index:99999;font:14px system-ui;box-shadow:0 8px 32px #0002';
    const title = document.createElement('strong');
    title.textContent = 'Compilation failed — ' + context.namespace + '/' + context.name;
    const detail = document.createElement('pre');
    detail.style.whiteSpace = 'pre-wrap';
    detail.textContent = error.message + '\n' + (error.frame ?? '');
    panel.append(title, detail);
    document.body.append(panel);
  }
  import.meta.hot.on('vite:error', ({ err }) => {
    if (own(err.id ?? err.loc?.file ?? '')) show(err);
  });
  import.meta.hot.on('vite:beforeUpdate', ({ updates }) => {
    if (updates.some(update => own(update.path) || own(update.acceptedPath))) pendingRevision = revision;
  });
  import.meta.hot.on('vite:afterUpdate', () => {
    // A second compiler error during the update must not be hidden by completion.
    if (pendingRevision !== undefined && pendingRevision === revision) clear();
    pendingRevision = undefined;
  });
  import.meta.hot.on('artifact:discovery', event => {
    if (event.namespace !== context.namespace || event.name !== context.name) return;
    if (context.component) {
      if (!event.components.includes(context.component)) location.reload();
      else if (event.changedProps.includes(context.component)) hostProps.set(event.props[context.component] ?? {});
      return;
    }
    const list = document.querySelector('[data-artifact-catalog]');
    if (!list) return;
    list.replaceChildren(...event.components.map(component => {
      const item = document.createElement('li'), link = document.createElement('a');
      link.href = '?component=' + encodeURIComponent(component); link.textContent = component; item.append(link); return item;
    }));
  });
}
