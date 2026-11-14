## CADCraft

CADCraft is an open-source computer-aided design and drafting app, written from scratch in Rust.

This app serves the official browser build of CADCraft (release `v0.20.1`). CADCraft runs entirely in your browser and uses your computer's graphics card (WebGPU, or WebGL2 where WebGPU isn't available). The server only hands out the files, so it uses almost no CPU or memory.

On the first start, the app downloads the release from GitHub and checks it against its published SHA-256 checksum. The page is available once that finishes, usually within a minute.

### Before you start: HTTPS

WebGPU, the clipboard and offline support only work in a **secure context**: HTTPS, or `localhost`. Over plain `http://<server-ip>:8914`, choose one of these:

- **Expose the app on a domain** in Runtipi, with a valid certificate.
- **LAN without HTTPS:** in Chrome, Edge or Brave, open `chrome://flags/#unsafely-treat-insecure-origin-as-secure`, add `http://<server-ip>:8914` (separate several addresses with commas), set it to **Enabled** and relaunch the browser. Do this on each device you use.

### Where your work is saved

Projects, settings and imported media are kept in **your browser's own storage** on the device you're using, not on the server. Each browser and device has its own copy, and clearing the site's data in the browser deletes it. To keep or move work, save or export files from the app to your computer.

### Links

- Website: https://getartcraft.com/apps/cadcraft
- Source: https://github.com/storytold/cadcraft
- Store: https://github.com/chrisknsmn-proxmox/runtipi-appstore-artcraft

CADCraft is part of the ArtCraft Crafting Apps. It is licensed under MIT or Apache-2.0.
