# Meet AI

Internal Web meeting V1 built with TanStack Start, oRPC, TanStack Query, Cloudflare Workers, and Cloudflare RealtimeKit.

## Local Setup

1. Install dependencies:

```bash
bun install
```

2. Create local Worker secrets:

```bash
cp .dev.vars.example .dev.vars
```

Fill `.dev.vars` with the real values for `CF_ACCOUNT_ID`, `REALTIMEKIT_APP_ID`, `CLOUDFLARE_API_TOKEN`, and `PUBLIC_APP_URL`. Do not commit `.dev.vars`.

3. Start locally:

```bash
bun run dev
```

## Deployment

Set Worker secrets before deploy:

```bash
bunx wrangler secret put CF_ACCOUNT_ID
bunx wrangler secret put REALTIMEKIT_APP_ID
bunx wrangler secret put CLOUDFLARE_API_TOKEN
bunx wrangler secret put PUBLIC_APP_URL
```

Optional RealtimeKit preset overrides:

```bash
bunx wrangler secret put REALTIMEKIT_PRESET_NAME
bunx wrangler secret put REALTIMEKIT_HOST_PRESET_NAME
bunx wrangler secret put REALTIMEKIT_PARTICIPANT_PRESET_NAME
```

Deploy:

```bash
bun run deploy
```

The Worker route is configured for `meet.celados.com`. If the custom domain is not already attached to the Cloudflare account/zone, add it in Workers & Pages or adjust `wrangler.jsonc`.

### CI/CD

GitHub Actions is split by release boundary:

- `CI` runs on pull requests and pushes to `main`. It builds the Worker bundle on Linux and builds/smokes the packaged Electron app on `macos-26`.
- `Deploy Web` runs on pushes to `main` and manual dispatch. It builds and deploys the Cloudflare Worker, then smokes the production URL.
- `Release Desktop` runs on `v*` tags and manual dispatch. It builds the signed/notarized macOS desktop artifact on `macos-26`, verifies signing/notarization, runs the packaged desktop smoke test against production, uploads artifacts, and creates a draft GitHub Release for tag builds.

Repository variables:

```bash
MEET_PROD_URL=https://meet.celados.com
```

Repository secrets for Web deployment:

```bash
CF_DEPLOY_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

`CF_DEPLOY_API_TOKEN` is the Wrangler deployment token used by CI. `CLOUDFLARE_ACCOUNT_ID` lets Wrangler select the target account in GitHub Actions. The deploy token is separate from the Worker runtime secret named `CLOUDFLARE_API_TOKEN`, which is used by the app when calling Cloudflare RealtimeKit.

Repository secrets for macOS desktop release:

```bash
MACOS_DEVELOPER_ID_CERT_BASE64
MACOS_DEVELOPER_ID_CERT_PASSWORD
APPLE_API_KEY_BASE64
APPLE_API_KEY_ID
APPLE_API_ISSUER
```

`MACOS_DEVELOPER_ID_CERT_BASE64` is the base64-encoded `.p12` export for the Developer ID Application certificate. `APPLE_API_KEY_BASE64` is the base64-encoded App Store Connect `.p8` API key; alternatively, a raw multiline `APPLE_API_KEY` secret is accepted by the workflow.

## Recording Storage

V1 starts RealtimeKit composite recordings through the REST API and polls recording status through oRPC. For long-term storage, configure RealtimeKit Dashboard > Recordings > Setup Storage and choose Cloudflare R2. The app does not store R2 keys or manage R2 objects.

## Production Access

To protect the production address with Cloudflare Access:

1. In Cloudflare Zero Trust, create an Access Application for `https://meet.celados.com`.
2. Choose Self-hosted as the app type.
3. Add an allow policy for the internal email domain or team group.
4. Keep the Worker route pointed at the same hostname.

## Validation

```bash
bun run typecheck
bun run build
```

Manual V1 validation still requires two browsers/devices with camera and microphone permissions, screen sharing, and a real RealtimeKit app with recording enabled.

## Desktop App

The desktop V1 is an Electron shell around the deployed Web app. It keeps all meeting, oRPC, RealtimeKit, and recording logic in the same TanStack Start Worker at `https://meet.celados.com`; the desktop process only owns native windowing, media permissions, and screen-capture integration.

Run against production:

```bash
bun run desktop:dev
```

Run against a local Web server:

```bash
MEET_DESKTOP_URL=http://localhost:3000 bun run desktop:dev
```

Create unpacked or distributable desktop builds:

```bash
bun run desktop:pack
bun run desktop:dist
```

Run the packaged desktop smoke test:

```bash
bun run desktop:smoke
```

Desktop builds are unsigned by default so local smoke tests do not depend on Apple certificate or notarization setup. To enable local macOS signing with the available keychain identity:

```bash
MEET_DESKTOP_SIGN=1 bun run desktop:dist
```

For a signed and notarized macOS release, provide Apple notarization credentials and run:

```bash
bun run desktop:release:mac
```

Notarization accepts either `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID`, or `APPLE_API_KEY`/`APPLE_API_KEY_PATH`, `APPLE_API_KEY_ID`, and `APPLE_API_ISSUER`.

On macOS, the app follows the same native-permission shape used by OnType: the Electron main process is the source of truth for System Settings status, the renderer only receives `ungranted` / `inProgress` / `granted` snapshots through a preload bridge, and permission requests are fire-and-forget from the Web UI. The desktop panel covers microphone, camera, and screen recording. If camera or microphone was previously denied, change it in System Settings and restart the app; screen recording opens System Settings when the system prompt cannot grant it directly.

Desktop startup diagnostics are written to `~/Library/Application Support/Meet AI/logs/desktop-main.log`.
