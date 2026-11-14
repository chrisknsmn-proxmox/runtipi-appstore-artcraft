// Builds apps/<id>/ (config.json, docker-compose.yml, metadata/description.md) and the README's
// app table from crafts.json and templates/.
//
//   bun scripts/generate.ts            write everything
//   bun scripts/generate.ts --check    exit 1 if any generated file is out of date (used in CI)
//   bun scripts/generate.ts --latest   first move each app to its latest GitHub release, taking the
//                                      web zip's SHA-256 from the release's SHA256SUMS.txt
//   bun scripts/generate.ts --bump     raise every app's tipi_version (after changing shim/ or
//                                      templates/), so Runtipi offers the update
//
// Logos (apps/<id>/metadata/logo.jpg) are committed files and aren't generated.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

type Craft = {
  id: string
  name: string
  repo: string
  tag: string
  asset: string
  sha256: string
  port: number
  short_desc: string
  description: string
  categories: string[]
  // false: files opened in the app are inputs (a photo library's originals), never save targets
  remember_opened?: boolean
  // An extra paragraph for the description's "Saving to real files" section
  save_note?: string
  tipi_version?: number
  created_at?: number
  updated_at?: number
}

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const manifestPath = path.join(root, 'crafts.json')
const args = new Set(process.argv.slice(2))
const check = args.has('--check')

const readText = (file: string) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null)
const fill = (template: string, values: Record<string, string>) =>
  template.replace(/@@([A-Z0-9_]+)@@/g, (match, key: string) => {
    const value = values[key]
    if (value === undefined) throw new Error(`Template placeholder ${match} has no value`)
    return value
  })

async function github(url: string) {
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json', 'User-Agent': 'runtipi-appstore-generator' }
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  const response = await fetch(url, { headers })
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
  return response
}

async function moveToLatest(craft: Craft, now: number) {
  type Release = { tag_name: string; assets: { name: string; browser_download_url: string }[] }
  const release = (await (await github(`https://api.github.com/repos/${craft.repo}/releases/latest`)).json()) as Release
  if (release.tag_name === craft.tag) return false
  const asset = release.assets.find((a) => /-web-[^/]*\.zip$/.test(a.name))
  if (!asset) throw new Error(`${craft.repo} ${release.tag_name} has no web zip`)
  const sums = release.assets.find((a) => a.name === 'SHA256SUMS.txt')
  if (!sums) throw new Error(`${craft.repo} ${release.tag_name} has no SHA256SUMS.txt`)
  const text = await (await github(sums.browser_download_url)).text()
  const line = text.split('\n').map((l) => l.trim().split(/\s+\*?/)).find(([, name]) => name === asset.name)
  const sha256 = line?.[0]
  if (!sha256 || !/^[0-9a-f]{64}$/.test(sha256)) throw new Error(`${craft.repo} ${release.tag_name}: no SHA-256 for ${asset.name}`)
  console.log(`${craft.name}: ${craft.tag} -> ${release.tag_name}`)
  Object.assign(craft, { tag: release.tag_name, asset: asset.name, sha256, tipi_version: (craft.tipi_version ?? 1) + 1, updated_at: now })
  return true
}

function configFor(craft: Craft) {
  return {
    $schema: 'https://schemas.runtipi.io/app-info.json',
    urn: `tipi://${craft.id}`,
    name: craft.name,
    id: craft.id,
    available: true,
    short_desc: craft.short_desc,
    author: 'ArtCraft (storytold)',
    port: craft.port,
    categories: craft.categories,
    description: craft.description,
    tipi_version: craft.tipi_version,
    version: craft.tag.replace(/^v/, ''),
    source: `https://github.com/${craft.repo}`,
    website: `https://getartcraft.com/apps/${craft.id}`,
    exposable: true,
    supported_architectures: ['amd64', 'arm64'],
    created_at: craft.created_at,
    updated_at: craft.updated_at,
    dynamic_config: true,
    form_fields: [
      {
        type: 'boolean',
        label: 'Save in place',
        env_variable: 'CRAFT_SAVE_IN_PLACE',
        default: true,
        required: false,
        hint: "Chrome, Edge and Brave: Save writes back into the file you opened (or chose on the first save) instead of downloading a new copy each time. Turn off to keep the app's own downloads.",
      },
    ],
  }
}

function readmeTable(crafts: Craft[]) {
  const rows = crafts.map(
    (c) => `| [${c.name}](https://github.com/${c.repo}) | ${c.short_desc} | ${c.tag.replace(/^v/, '')} | ${c.port} |`,
  )
  return ["| App | What it's for | Version | Port |", '| --- | --- | --- | --- |', ...rows].join('\n')
}

async function main() {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { apps: Craft[] }
  const crafts = manifest.apps
  const now = Date.now()

  for (const craft of crafts) {
    craft.tipi_version ??= 1
    craft.created_at ??= now
    craft.updated_at ??= now
  }
  if (args.has('--latest')) {
    for (const craft of crafts) await moveToLatest(craft, now)
  }
  if (args.has('--bump')) {
    for (const craft of crafts) Object.assign(craft, { tipi_version: (craft.tipi_version ?? 1) + 1, updated_at: now })
  }

  const composeTemplate = fs.readFileSync(path.join(root, 'templates', 'docker-compose.yml'), 'utf8')
  const descriptionTemplate = fs.readFileSync(path.join(root, 'templates', 'description.md'), 'utf8')
  const saveHereB64 = Buffer.from(fs.readFileSync(path.join(root, 'shim', 'savehere.js'))).toString('base64')

  const outputs = new Map<string, string>()
  outputs.set(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

  for (const craft of crafts) {
    const values = {
      ID: craft.id,
      NAME: craft.name,
      REPO: craft.repo,
      TAG: craft.tag,
      VERSION: craft.tag.replace(/^v/, ''),
      ASSET: craft.asset,
      SHA256: craft.sha256,
      PORT: String(craft.port),
      DESCRIPTION: craft.description,
      REMEMBER_OPENED: String(craft.remember_opened ?? true),
      SAVE_NOTE: craft.save_note ? `${craft.save_note}\n\n` : '',
      SAVEHERE_B64: saveHereB64,
    }
    const dir = path.join(root, 'apps', craft.id)
    outputs.set(path.join(dir, 'config.json'), `${JSON.stringify(configFor(craft), null, 2)}\n`)
    outputs.set(path.join(dir, 'docker-compose.yml'), fill(composeTemplate, values))
    outputs.set(path.join(dir, 'metadata', 'description.md'), fill(descriptionTemplate, values))
    if (!fs.existsSync(path.join(dir, 'metadata', 'logo.jpg'))) console.warn(`${craft.id}: metadata/logo.jpg is missing`)
  }

  const readmePath = path.join(root, 'README.md')
  const readme = readText(readmePath)
  if (readme) {
    const marked = /(<!-- apps:start -->\n)[\s\S]*?(<!-- apps:end -->)/
    if (!marked.test(readme)) throw new Error('README.md is missing the <!-- apps:start/end --> markers')
    outputs.set(readmePath, readme.replace(marked, (_, start: string, end: string) => `${start}${readmeTable(crafts)}\n${end}`))
  }

  const stale = [...outputs].filter(([file, content]) => readText(file) !== content).map(([file]) => file)
  if (check) {
    if (stale.length) {
      console.error(`Out of date; run "bun scripts/generate.ts":\n${stale.map((f) => `  ${path.relative(root, f)}`).join('\n')}`)
      process.exit(1)
    }
    console.log('Generated files are up to date.')
    return
  }
  for (const file of stale) {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, outputs.get(file) as string)
  }
  console.log(stale.length ? `Wrote ${stale.length} files.` : 'Nothing to change.')
}

await main()
