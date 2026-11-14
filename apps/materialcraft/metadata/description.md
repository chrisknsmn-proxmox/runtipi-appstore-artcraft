## MaterialCraft

MaterialCraft is an open-source, node-based procedural material creator, written from scratch in Rust.

This app serves the official browser build of MaterialCraft (release `v0.4.1`). MaterialCraft runs entirely in your browser and uses your computer's graphics card (WebGPU, or WebGL2 where WebGPU isn't available). The server only hands out the files, so it uses almost no CPU or memory.

On the first start, the app downloads the release from GitHub and checks it against its published SHA-256 checksum. The page is available once that finishes, usually within a minute.

### Before you start: HTTPS

WebGPU, the clipboard and offline support only work in a **secure context**: HTTPS, or `localhost`. Over plain `http://<server-ip>:8910`, choose one of these:

- **Expose the app on a domain** in Runtipi, with a valid certificate.
- **LAN without HTTPS:** in Chrome, Edge or Brave, open `chrome://flags/#unsafely-treat-insecure-origin-as-secure`, add `http://<server-ip>:8910` (separate several addresses with commas), set it to **Enabled** and relaunch the browser. Do this on each device you use.

### Saving to real files (Chrome, Edge, Brave)

On its own, the browser version downloads a new file every time you save. This store adds a small script, **Save in place**, that changes that in Chrome, Edge and Brave:

- **Open** a file with the app's Open command, or drop it on the page, and **Save** writes your changes back into that file.
- The **first save** of a new document asks where to save it. Every later save goes into the same file, with no dialog and no download.
- If the app saves under a different name than the file you opened, the save dialog opens on that file. Press Enter and confirm **Replace** once.
- After each save, a note in the corner offers **Undo** (put the file's previous contents back) and **Save elsewhere…**.
- After you reload the page, the browser asks once for permission to edit the file again. Choose "Allow on every visit" to stop it asking.

Files on a network share, such as a folder on your server's drive connected in Finder, work the same way. Firefox and Safari don't support this, so there the app keeps downloading. To turn it off, set **Save in place** off in the app's settings. The script is part of this store, not of MaterialCraft.

### Where your work is saved

Projects, settings and imported media you haven't saved to a file are kept in **your browser's own storage** on the device you're using, not on the server. Each browser and device has its own copy, and clearing the site's data in the browser deletes it.

### Links

- Website: https://getartcraft.com/apps/materialcraft
- Source: https://github.com/storytold/materialcraft
- Store: https://github.com/chrisknsmn-proxmox/runtipi-appstore-artcraft

MaterialCraft is part of the ArtCraft Crafting Apps. It is licensed under MIT or Apache-2.0.
