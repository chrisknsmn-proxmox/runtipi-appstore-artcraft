/*
 * Save in place, for the ArtCraft browser apps. Added by the ArtCraft Runtipi app store; it is not
 * part of the apps themselves. https://github.com/chrisknsmn-proxmox/runtipi-appstore-artcraft
 *
 * The apps save and export by downloading a new file every time. In Chrome, Edge and Brave this
 * script uses the File System Access API instead, so saving writes back into a real file:
 *
 *  - Opening a file (the app's file field, or a file dropped on the page) uses the browser's own
 *    file picker, and the script remembers the file by name.
 *  - When the app downloads a file with a remembered name, the script writes into that file.
 *    A name it doesn't know yet asks once where to save, and later saves go to the same file.
 *  - Apps that already call showSaveFilePicker for every save (WordCraft, GridCraft) get the
 *    remembered file back instead of a new dialog.
 *  - Each save shows a short note with Undo (put the file's previous contents back) and
 *    "Save elsewhere…".
 *
 * Remembered files live in this site's IndexedDB, so they survive a reload. "Untitled…" names are
 * remembered only until the page is closed, because every new document starts with that name.
 * In other browsers, or outside a secure context, the script does nothing and the app downloads.
 */
(() => {
  'use strict';
  if (window.__savehere) return;

  // <script src="savehere.js" data-remember-opened="false">: files opened or dropped are imports
  // (a photo library's originals, say), not documents, so saves never write into them.
  const rememberOpened = !(document.currentScript && document.currentScript.dataset.rememberOpened === 'false');

  const supported =
    window.isSecureContext &&
    typeof window.showSaveFilePicker === 'function' &&
    typeof window.showOpenFilePicker === 'function' &&
    typeof DataTransfer === 'function';

  const api = {
    version: 1,
    supported,
    // Swappable for tests; the real pickers by default.
    pickers: supported
      ? { save: window.showSaveFilePicker.bind(window), open: window.showOpenFilePicker.bind(window) }
      : null,
    events: [],
    forget: null,
  };
  Object.defineProperty(window, '__savehere', { value: api });
  if (!supported) return;

  const log = (type, detail = {}) => {
    api.events.push({ type, at: Date.now(), ...detail });
    if (api.events.length > 300) api.events.shift();
  };
  const isUntitled = (name) => /^untitled\b/i.test(name);
  const scope = location.pathname.replace(/[^/]*$/, '');

  // ---------------------------------------------------------------------------------------------
  // Remembered files: name -> FileSystemFileHandle

  const memory = new Map();
  const ours = new WeakSet(); // handles this script handed out or remembered
  const DB_NAME = 'savehere';
  const STORE = 'handles';

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  async function withStore(mode, run) {
    const db = await openDb();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const result = run(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(result && 'result' in result ? result.result : undefined);
        tx.onerror = tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }
  const dbKey = (name) => `${scope}\u0000${name}`;

  // Load what earlier visits remembered.
  const ready = withStore('readonly', (store) => {
    const request = store.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      const [keyScope, name] = String(cursor.key).split('\u0000');
      if (keyScope === scope && cursor.value && !memory.has(name)) {
        memory.set(name, cursor.value);
        ours.add(cursor.value);
      }
      cursor.continue();
    };
  }).catch((error) => log('db-error', { message: String(error) }));

  async function remember(name, handle) {
    if (!name || !handle) return;
    memory.set(name, handle);
    ours.add(handle);
    if (isUntitled(name)) return;
    try {
      await withStore('readwrite', (store) => store.put(handle, dbKey(name)));
    } catch (error) {
      log('db-error', { message: String(error) });
    }
  }
  async function recall(name) {
    await ready;
    return memory.get(name) || null;
  }
  api.forget = async () => {
    memory.clear();
    await withStore('readwrite', (store) => store.clear()).catch(() => {});
  };

  let lastHandle = null; // starts pickers in the folder last used
  let lastOpened = null; // the file opened last, offered when an app saves it as "Untitled…"
  const extension = (name) => (/\.[^./]+$/.exec(name || '') || [''])[0].toLowerCase();

  // Readwrite permission. Throws SecurityError when the browser needs a click to ask.
  async function permitted(handle) {
    const options = { mode: 'readwrite' };
    if ((await handle.queryPermission(options)) === 'granted') return true;
    return (await handle.requestPermission(options)) === 'granted';
  }

  // ---------------------------------------------------------------------------------------------
  // The note in the corner

  let toastHost = null;
  let toastTimer = 0;
  function toast(message, actions = [], { sticky = false, error = false } = {}) {
    if (!document.body) return;
    if (!toastHost) {
      toastHost = document.createElement('div');
      toastHost.setAttribute('data-savehere', '');
      toastHost.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;';
      toastHost.attachShadow({ mode: 'open' });
    }
    if (!toastHost.isConnected) document.body.append(toastHost);
    const root = toastHost.shadowRoot;
    root.innerHTML = `
      <style>
        .t{font:13px/1.4 system-ui,-apple-system,sans-serif;color:#f4f4f5;background:#18181b;
           border:1px solid ${error ? '#ef4444' : '#3f3f46'};border-radius:8px;padding:10px 12px;
           box-shadow:0 6px 24px rgba(0,0,0,.35);display:flex;gap:10px;align-items:center;max-width:420px}
        .m{flex:1;overflow-wrap:anywhere}
        button{font:inherit;color:#93c5fd;background:none;border:0;padding:2px 4px;cursor:pointer;white-space:nowrap}
        button:hover{text-decoration:underline}
        .x{color:#a1a1aa}
      </style>
      <div class="t" role="status"><span class="m"></span></div>`;
    const box = root.querySelector('.t');
    box.querySelector('.m').textContent = message;
    for (const { label, run } of actions) {
      const button = document.createElement('button');
      button.textContent = label;
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        hide();
        run();
      });
      box.append(button);
    }
    const close = document.createElement('button');
    close.className = 'x';
    close.textContent = '✕';
    close.setAttribute('aria-label', 'Dismiss');
    close.addEventListener('click', hide);
    box.append(close);
    clearTimeout(toastTimer);
    if (!sticky) toastTimer = setTimeout(hide, actions.length ? 8000 : 4000);
  }
  function hide() {
    clearTimeout(toastTimer);
    if (toastHost) toastHost.remove();
  }

  // ---------------------------------------------------------------------------------------------
  // Writing

  async function writeInto(handle, blob) {
    // For Undo, a copy of what the file held. (The File itself goes stale once the file changes.)
    let previous = null;
    try {
      const file = await handle.getFile();
      if (file.size > 0 && file.size <= 256 * 1024 * 1024) {
        previous = new Blob([await file.arrayBuffer()], { type: file.type });
      }
    } catch {
      // A file that can't be read back simply has no Undo.
    }
    const stream = await realCreateWritable.call(handle);
    try {
      await stream.write(blob);
      await stream.close();
    } catch (error) {
      try {
        await stream.abort();
      } catch {}
      throw error;
    }
    lastHandle = handle;
    return previous;
  }

  function savedNote(handle, name, previous, blob) {
    const actions = [];
    if (previous) {
      actions.push({
        label: 'Undo',
        run: () =>
          writeInto(handle, previous).then(
            () => toast(`Put back the previous ${handle.name}`),
            (error) => toast(`Couldn't undo: ${error.message}`, [], { error: true }),
          ),
      });
    }
    actions.push({ label: 'Save elsewhere…', run: () => chooseAndSave(name, blob) });
    toast(`Saved to ${handle.name}`, actions);
  }

  // Asks where to save `name`, remembers the choice and writes `blob` there.
  async function chooseAndSave(name, blob) {
    let handle;
    try {
      // Apps name a save after the document, not the file it came from: "Untitled-N" (a web page
      // never learns a file's path) or the project's own name. So the file opened last, of the
      // same type, is the likely target: suggest it, in its folder. The browser still asks before
      // replacing it.
      const suggested = lastOpened && extension(lastOpened.name) === extension(name) ? lastOpened : null;
      const options = { suggestedName: suggested ? suggested.name : name };
      if (suggested) options.startIn = suggested;
      else if (lastHandle) options.startIn = lastHandle;
      handle = await api.pickers.save(options);
    } catch (error) {
      if (error.name === 'AbortError') {
        log('cancelled', { name });
        toast(`Not saved: ${name}`);
        return;
      }
      if (error.name === 'SecurityError' || error.name === 'NotAllowedError') {
        // The browser wants a fresh click before it shows a picker.
        log('needs-click', { name });
        toast(`Choose where to save ${name}`, [{ label: 'Choose…', run: () => chooseAndSave(name, blob) }], {
          sticky: true,
        });
        return;
      }
      throw error;
    }
    log('picked', { name, file: handle.name });
    await remember(name, handle);
    if (handle.name !== name) await remember(handle.name, handle);
    const previous = await writeInto(handle, blob);
    log('saved', { name, file: handle.name, bytes: blob.size, picked: true });
    savedNote(handle, name, previous, blob);
  }

  async function saveDownload(name, blob, fallback) {
    try {
      const handle = await recall(name);
      if (handle) {
        let allowed;
        try {
          allowed = await permitted(handle);
        } catch (error) {
          if (error.name !== 'SecurityError' && error.name !== 'NotAllowedError') throw error;
          log('needs-click', { name, file: handle.name });
          toast(
            `Allow saving to ${handle.name}?`,
            [
              { label: 'Allow', run: () => saveDownload(name, blob, fallback) },
              { label: 'Save elsewhere…', run: () => chooseAndSave(name, blob) },
            ],
            { sticky: true },
          );
          return;
        }
        if (allowed) {
          const previous = await writeInto(handle, blob);
          log('saved', { name, file: handle.name, bytes: blob.size, picked: false });
          savedNote(handle, name, previous, blob);
          return;
        }
        log('denied', { name, file: handle.name });
      }
      await chooseAndSave(name, blob);
    } catch (error) {
      log('save-failed', { name, message: String(error) });
      toast(`Couldn't save ${name}: ${error.message}`, [{ label: 'Download instead', run: fallback }], {
        sticky: true,
        error: true,
      });
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Downloads: the apps click a hidden <a download href="blob:…">.

  const blobs = new Map(); // object URL -> Blob, so a revoked URL can still be saved
  const realCreateObjectURL = URL.createObjectURL;
  const realRevokeObjectURL = URL.revokeObjectURL;
  URL.createObjectURL = function createObjectURL(object) {
    const url = realCreateObjectURL.call(URL, object);
    if (object instanceof Blob) blobs.set(url, object);
    return url;
  };
  URL.revokeObjectURL = function revokeObjectURL(url) {
    setTimeout(() => blobs.delete(url), 60_000);
    return realRevokeObjectURL.call(URL, url);
  };

  const realClick = HTMLElement.prototype.click;
  const bypass = new WeakSet();

  function realDownload(href, name, blob) {
    const a = document.createElement('a');
    a.href = blob ? realCreateObjectURL.call(URL, blob) : href;
    a.download = name;
    a.style.display = 'none';
    bypass.add(a);
    document.body.append(a);
    realClick.call(a);
    a.remove();
  }

  // A burst of new names (an image sequence, say) downloads normally rather than asking per file.
  const recentAsks = [];
  function isBurst() {
    const now = Date.now();
    while (recentAsks.length && now - recentAsks[0] > 2000) recentAsks.shift();
    recentAsks.push(now);
    return recentAsks.length > 2;
  }

  function isDownloadLink(element) {
    return (
      element instanceof HTMLAnchorElement &&
      !bypass.has(element) &&
      element.hasAttribute('download') &&
      /^(blob|data):/i.test(element.href)
    );
  }

  async function interceptDownload(anchor) {
    const href = anchor.href;
    const name = anchor.getAttribute('download') || decodeURIComponent(href.split('/').pop() || 'download');
    let blob = blobs.get(href);
    log('download', { name });
    if (!blob) {
      try {
        blob = await (await fetch(href)).blob();
      } catch (error) {
        log('download-unreadable', { name, message: String(error) });
        return; // Nothing to save; the URL is already gone.
      }
    }
    const fallback = () => realDownload(href, name, blob);
    if (!memory.has(name) && isBurst()) {
      log('burst-download', { name });
      fallback();
      return;
    }
    await saveDownload(name, blob, fallback);
  }

  HTMLAnchorElement.prototype.click = function click() {
    if (isDownloadLink(this)) {
      interceptDownload(this);
      return;
    }
    return realClick.call(this);
  };

  // ---------------------------------------------------------------------------------------------
  // Opening: the apps show an <input type="file">.

  const realInputClick = HTMLInputElement.prototype.click;
  const realShowPicker = HTMLInputElement.prototype.showPicker;

  function pickerTypes(accept) {
    const tokens = (accept || '')
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    const extensions = tokens.filter((t) => /^\.[a-z0-9][a-z0-9.+_-]{0,15}$/.test(t));
    const mimes = tokens.filter((t) => /^[a-z0-9.+-]+\/[a-z0-9.+*-]+$/.test(t));
    if (!extensions.length && !mimes.length) return undefined;
    const map = {};
    if (extensions.length) map['application/octet-stream'] = extensions;
    for (const mime of mimes) map[mime] = map[mime] || [];
    return [{ description: 'Supported files', accept: map }];
  }

  async function openInto(input) {
    let handles;
    const options = { multiple: input.multiple };
    const types = pickerTypes(input.accept);
    try {
      try {
        handles = await api.pickers.open(types ? { ...options, types } : options);
      } catch (error) {
        if (error.name !== 'TypeError' || !types) throw error;
        handles = await api.pickers.open(options); // the accept list wasn't valid for the picker
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        log('open-cancelled');
        input.dispatchEvent(new Event('cancel'));
        return;
      }
      // No user activation or some other refusal: show the field's own dialog instead.
      log('open-fallback', { message: String(error) });
      toast('Choose a file to open', [{ label: 'Choose…', run: () => realInputClick.call(input) }], { sticky: true });
      return;
    }
    const files = await Promise.all(handles.map((handle) => handle.getFile()));
    for (const [index, handle] of handles.entries()) {
      lastHandle = handle;
      if (!rememberOpened) continue;
      await remember(files[index].name, handle);
      lastOpened = handle;
    }
    log('opened', { files: files.map((f) => f.name) });
    const transfer = new DataTransfer();
    for (const file of files) transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  const isFileInput = (element) => element instanceof HTMLInputElement && element.type === 'file' && !element.disabled;

  HTMLInputElement.prototype.click = function click() {
    if (isFileInput(this)) {
      openInto(this);
      return;
    }
    return realInputClick.call(this);
  };
  if (typeof realShowPicker === 'function') {
    HTMLInputElement.prototype.showPicker = function showPicker() {
      if (isFileInput(this)) {
        openInto(this);
        return;
      }
      return realShowPicker.call(this);
    };
  }

  // Clicks the page dispatches itself, and clicks on visible file fields (the apps' "Open" cards).
  window.addEventListener(
    'click',
    (event) => {
      const target = event.target;
      if (isFileInput(target)) {
        event.preventDefault();
        openInto(target);
      } else if (isDownloadLink(target)) {
        event.preventDefault();
        interceptDownload(target);
      }
    },
    true,
  );

  // Files dropped on the page.
  window.addEventListener(
    'drop',
    (event) => {
      const items = event.dataTransfer && event.dataTransfer.items;
      if (!items) return;
      for (const item of items) {
        if (item.kind !== 'file' || typeof item.getAsFileSystemHandle !== 'function') continue;
        item
          .getAsFileSystemHandle()
          .then((handle) => {
            if (handle && handle.kind === 'file') {
              lastHandle = handle;
              log('dropped', { file: handle.name });
              if (!rememberOpened) return;
              remember(handle.name, handle);
              lastOpened = handle;
            }
          })
          .catch(() => {});
      }
    },
    true,
  );

  // ---------------------------------------------------------------------------------------------
  // Apps that call the pickers themselves.

  window.showOpenFilePicker = async function showOpenFilePicker(options) {
    const handles = await api.pickers.open(options);
    for (const handle of handles) {
      lastHandle = handle;
      if (!rememberOpened) continue;
      await remember(handle.name, handle);
      lastOpened = handle;
    }
    log('opened', { files: handles.map((h) => h.name), viaApp: true });
    return handles;
  };

  window.showSaveFilePicker = async function showSaveFilePicker(options = {}) {
    const name = options.suggestedName;
    if (name) {
      const handle = await recall(name);
      if (handle) {
        try {
          if (await permitted(handle)) {
            log('reused', { name, file: handle.name });
            watchWrites(handle, name);
            return handle;
          }
        } catch {
          // Fall through to the real picker, which has its own permission flow.
        }
      }
    }
    const pickerOptions = { ...options };
    if (lastHandle && !pickerOptions.startIn) pickerOptions.startIn = lastHandle;
    const handle = await api.pickers.save(pickerOptions);
    log('picked', { name, file: handle.name, viaApp: true });
    if (name) await remember(name, handle);
    if (handle.name !== name) await remember(handle.name, handle);
    lastHandle = handle;
    watchWrites(handle, name);
    return handle;
  };

  // Tells the user when an app finishes writing into a file this script handed it.
  const watched = new WeakMap(); // handle -> the name the app asked to save as
  function watchWrites(handle, name) {
    watched.set(handle, name);
  }
  const realCreateWritable = FileSystemFileHandle.prototype.createWritable;
  FileSystemFileHandle.prototype.createWritable = async function createWritable(...args) {
    const stream = await realCreateWritable.apply(this, args);
    if (!watched.has(this)) return stream;
    const handle = this;
    const close = stream.close;
    stream.close = async function (...closeArgs) {
      const result = await close.apply(stream, closeArgs);
      log('saved', { name: watched.get(handle), file: handle.name, viaApp: true });
      toast(`Saved to ${handle.name}`);
      return result;
    };
    return stream;
  };

  log('ready', { scope, rememberOpened });
})();
