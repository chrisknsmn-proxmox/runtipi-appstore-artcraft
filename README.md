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
