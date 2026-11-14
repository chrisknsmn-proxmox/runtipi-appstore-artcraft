# ArtCraft Runtipi App Store

A [Runtipi](https://runtipi.io) app store with the browser versions of the [ArtCraft Crafting Apps](https://getartcraft.com/apps): free, open-source creative tools written from scratch in Rust.

## Using this app store

In Runtipi, go to **Settings → App Stores → Add app store** and enter this repository's URL:

```
https://github.com/chrisknsmn-proxmox/runtipi-appstore-artcraft
```

Then refresh the stores (**Settings → Actions → Update App Stores → Update**). The apps appear in the Runtipi app store.

## Apps

<!-- apps:start -->
| App | What it's for | Version | Port |
| --- | --- | --- | --- |
| [PhotoCraft](https://github.com/storytold/photocraft) | Image editing with layers, masks, type and real PSD files. | 0.23.1 | 8901 |
| [VectorCraft](https://github.com/storytold/vectorcraft) | Vector illustration. | 0.24.1 | 8902 |
| [FilmCraft](https://github.com/storytold/filmcraft) | Video editing, color and sound. | 0.20.1 | 8903 |
| [LightCraft](https://github.com/storytold/lightcraft) | Photo library and raw development. | 0.21.1 | 8904 |
| [PdfCraft](https://github.com/storytold/pdfcraft) | Read, organize, combine, split and protect PDFs. | 0.21.1 | 8905 |
| [EffectCraft](https://github.com/storytold/effectcraft) | Motion graphics and visual effects. | 0.24.1 | 8906 |
| [DesignCraft](https://github.com/storytold/designcraft) | Page layout and publishing. | 0.20.1 | 8907 |
| [FigCraft](https://github.com/storytold/figcraft) | Interface design and prototyping. | 0.18.1 | 8908 |
| [TextureCraft](https://github.com/storytold/texturecraft) | 3D texture painting. | 0.6.1 | 8909 |
| [MaterialCraft](https://github.com/storytold/materialcraft) | Node-based procedural materials. | 0.4.1 | 8910 |
| [SoundCraft](https://github.com/storytold/soundcraft) | Audio recording, editing and mixing. | 0.20.1 | 8911 |
| [WordCraft](https://github.com/storytold/wordcraft) | Word processing and documents. | 0.18.1 | 8912 |
| [DeckCraft](https://github.com/storytold/deckcraft) | Presentations and slide decks. | 0.18.1 | 8913 |
| [CADCraft](https://github.com/storytold/cadcraft) | Computer-aided design and drafting. | 0.20.1 | 8914 |
| [GridCraft](https://github.com/storytold/gridcraft) | Spreadsheets and data analysis. | 0.19.1 | 8915 |
| [Craft Anything](https://github.com/storytold/craft-anything) | See how any software works, then build your own (early alpha). | 0.6.1 | 8916 |
<!-- apps:end -->

AniCraft, the 17th Crafting App, isn't included because it has no browser version yet.

## How the apps work

Each app is one small nginx container. On the first start after an install or update, it downloads the app's official web build (`<app>-web-<version>.zip`) from the project's GitHub release. It checks the file against the SHA-256 pinned in its `docker-compose.yml`, which comes from the release's `SHA256SUMS.txt`, then unpacks it into the app's `data/site` folder and serves it. Later starts reuse the unpacked copy, and an update removes the previous version's files.

The apps run entirely in the browser on WebGPU (or WebGL2), so the server only hands out files. That means:

- **They need a secure context.** That's HTTPS or `localhost`. Expose an app on a domain in Runtipi, or, on a LAN, add its address to Chrome's `chrome://flags/#unsafely-treat-insecure-origin-as-secure` (several addresses can be listed with commas) and relaunch the browser. For every app on one server:

  ```
  http://<server-ip>:8901,http://<server-ip>:8902,http://<server-ip>:8903,http://<server-ip>:8904,http://<server-ip>:8905,http://<server-ip>:8906,http://<server-ip>:8907,http://<server-ip>:8908,http://<server-ip>:8909,http://<server-ip>:8910,http://<server-ip>:8911,http://<server-ip>:8912,http://<server-ip>:8913,http://<server-ip>:8914,http://<server-ip>:8915,http://<server-ip>:8916
  ```

- **Work is saved in the browser, not on the server.** Projects, settings and imported media live in each browser's own storage (OPFS or IndexedDB). Clearing the site's data deletes them. Save or export files you want to keep.

## Save in place

On their own, the browser builds save and export by downloading a new file every time. [`shim/savehere.js`](shim/savehere.js) fixes that in Chrome, Edge and Brave, using the File System Access API. Every container start writes the script next to the app and loads it first in `index.html`. Each app's **Save in place** setting (`CRAFT_SAVE_IN_PLACE`, on by default) turns it off.

- **Downloads:** every app saves by clicking a hidden `<a download href="blob:…">`. The script catches the click and writes the blob into a remembered `FileSystemFileHandle`. A name it doesn't know opens `showSaveFilePicker` once. If a file of the same type was opened in that session, the picker opens on that file.
- **Opening:** the apps' file fields (`<input type="file">`, mostly behind `rfd`'s card) go through `showOpenFilePicker` instead, and dropped files are read with `getAsFileSystemHandle`. Either way the handle is remembered by file name, in IndexedDB, so it survives a reload. "Untitled…" names are remembered only for the session. LightCraft and Craft Anything set `remember_opened: false`, because their opened files are inputs (photo originals, files to inspect), never save targets.
- **Apps that call `showSaveFilePicker` themselves** (WordCraft, GridCraft) get the remembered handle back instead of a new dialog.
- **Feedback:** each save shows a note with **Undo**, which writes back the previous contents (files up to 256 MB), and **Save elsewhere…**. When the browser wants a click before it shows a picker or asks permission, the note shows the button for it. If writing fails, it offers **Download instead**.
- **Other browsers:** in Firefox and Safari, or outside a secure context, the script does nothing.

Tested in Chrome against all 16 builds listed above, with each app's real UI. The tests ran save, save again, reload, open, then save, with the file pickers replaced by Origin Private File System handles. In the 15 apps that save, every later save went into the same file without a dialog or a download. Craft Anything's browser version has no saving, and opening works there too.

App-specific behaviour seen while testing:
- **VectorCraft** names files it opens "Untitled-N", so its first save after opening asks for a name.
- **EffectCraft** asks for the name with a browser `prompt()`.
- **LightCraft** needs a folder name in its Export dialog before it exports.
- **PhotoCraft 0.23.1's** release zip is missing `app/snippets/`, so the container copies it in.

## Updating

`crafts.json` lists every app with its release, web zip, SHA-256 and port. Everything in `apps/` except the logos is generated from it and `templates/`:

```sh
bun install
bun scripts/generate.ts --latest   # move every app to its latest GitHub release (set GITHUB_TOKEN to avoid rate limits)
bun scripts/generate.ts            # or, after editing crafts.json or templates/ by hand
bun test
```

`--latest` raises `tipi_version` for each app that changed, so Runtipi offers the update. Push, refresh the stores in Runtipi, then use **Update** on each app.

## Development

```sh
bun install        # or: npm install
bun test           # or: npx bun test
bun scripts/generate.ts --check
```

The tests check each app's files, `config.json` schema and `docker-compose.yml` format, and that every app pins its download to a GitHub release with a SHA-256. CI also checks that the generated files match `crafts.json`.
