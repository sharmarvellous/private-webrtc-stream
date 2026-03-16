# Private One-to-One WebRTC Stream

This refactor splits the MVP into two independent runtimes:

- `source-server/`
  Source-owned control plane and dashboard. It owns auth, sessions, signaling, protected media access, and serves the source dashboard.
- `viewer-client/`
  Viewer-side local app. It runs on the viewer machine, authenticates against the remote source node, joins an approved session, and renders the remote stream.
- `shared/`
  Cross-cutting constants and message shape references.

The source node is the only machine that must be reachable from the public internet. The viewer node stays local and connects outward to the source node.

## Architecture

### Source Node

- Runs Express and Socket.IO on a publicly reachable port.
- Stores users, videos, sessions, and audit logs locally.
- Hosts the source dashboard as static files from `source-server/ui/dist`.
- Issues JWTs and validates every REST and signaling action.
- Relays WebRTC offer, answer, and ICE candidates for a single source and single viewer.

### Viewer Node

- Runs only the viewer UI locally.
- Calls the remote source node for login, session authorization, and signaling.
- Does not expose any port publicly.
- Receives the remote WebRTC stream directly from the source browser when ICE succeeds.

### Connectivity

- Default STUN: `stun:stun.l.google.com:19302`
- TURN placeholders are supported in env files but not required to start.
- For internet-wide reliability, the source machine must expose its server port in the router or firewall.
- Without TURN, some NAT combinations may still fail even when signaling is correct.

## Folder Structure

```text
root/
  source-server/
    data/
    src/
    ui/
  viewer-client/
    src/
  shared/
    constants/
    schemas/
    webrtc/
  docker/
  scripts/
  package.json
  README.md
```

## File-by-File Implementation Plan

### Root

- `package.json`
  Single-command entry points for each machine.
- `scripts/start-source.mjs`
  Installs missing dependencies, builds the source dashboard, then starts the source server.
- `scripts/start-viewer.mjs`
  Installs missing dependencies, then starts the viewer app.

### Source Server

- `source-server/src/config/env.js`
  Reads `PUBLIC_HOST`, `PUBLIC_URL`, `ALLOWED_ORIGINS`, session TTLs, JWT, and WebRTC env.
- `source-server/src/app.js`
  Registers API routes and serves the built source dashboard.
- `source-server/src/server.js`
  Binds the public host and port, and starts Socket.IO signaling.
- `source-server/src/services/*`
  Own auth, sessions, signaling, and audit logic.
- `source-server/ui/*`
  Source-only React/Vite dashboard for session creation and publishing.

### Viewer Client

- `viewer-client/src/api/httpClient.js`
  Derives API base URL from `VITE_SOURCE_SERVER_URL`.
- `viewer-client/src/services/socketService.js`
  Connects signaling to the remote source node.
- `viewer-client/src/pages/ViewerPage.jsx`
  Handles login, session request, approval refresh, connect, disconnect, mute, and fullscreen.

### Shared

- `shared/constants/*`
  Roles, session statuses, and socket event names.
- `shared/webrtc/ice-config.js`
  Shared ICE server builder.
- `shared/schemas/signaling-messages.js`
  Message shape reference for signaling payloads.

## Machine Setup

### 1. Source Machine

Copy `source-server/.env.example` to `source-server/.env` and update it.

Recommended starting values:

```env
PORT=5000
PUBLIC_HOST=0.0.0.0
PUBLIC_URL=http://YOUR_PUBLIC_IP:5000
ALLOWED_ORIGINS=http://localhost:5000,http://127.0.0.1:5000,http://localhost:5173,http://127.0.0.1:5173
JWT_SECRET=change-me-in-development
JWT_EXPIRES_IN=8h
SESSION_DEFAULT_TTL_MINUTES=30
SESSION_MAX_TTL_MINUTES=120
DATA_FILE=./data/db.json
SEED_FILE=./data/seed.json
LOG_LEVEL=debug
STUN_URLS=stun:stun.l.google.com:19302
TURN_URLS=
TURN_USERNAME=
TURN_CREDENTIAL=
SOURCE_DASHBOARD_DIST=./ui/dist
```

Copy `source-server/ui/.env.example` to `source-server/ui/.env`.

Local-source example:

```env
VITE_SOURCE_SERVER_URL=http://localhost:5000
VITE_APP_MODE=source
VITE_VIEWER_APP_BASE_URL=
```

Run:

```bash
npm run start-source
```

What it does:

1. Installs missing dependencies in `source-server/` and `source-server/ui/`
2. Builds the source dashboard
3. Starts the source server
4. Serves the dashboard from the same origin as the API

Open:

- Source dashboard: [http://localhost:5000/source](http://localhost:5000/source)
- Health: [http://localhost:5000/api/health](http://localhost:5000/api/health)

### 2. Viewer Machine

Copy `viewer-client/.env.example` to `viewer-client/.env`.

Set the viewer to the public source URL:

```env
VITE_SOURCE_SERVER_URL=http://SOURCE_PUBLIC_IP:5000
VITE_APP_MODE=viewer
```

Run:

```bash
npm run start-viewer
```

Open:

- Viewer app: [http://localhost:5173/viewer](http://localhost:5173/viewer)

## Local Mode

Source server:

- `http://localhost:5000`

Viewer client:

- `http://localhost:5173`

Use:

- `viewer-client/.env` with `VITE_SOURCE_SERVER_URL=http://localhost:5000`
- `source-server/.env` with `PUBLIC_URL=http://localhost:5000`

## Global Mode

Source server:

- `http://PUBLIC_IP:5000`

Viewer client:

- still runs locally on the viewer machine, for example `http://localhost:5173`

Use:

- `source-server/.env` with `PUBLIC_URL=http://PUBLIC_IP:5000`
- `viewer-client/.env` with `VITE_SOURCE_SERVER_URL=http://PUBLIC_IP:5000`

## Router / NAT / Firewall Instructions

The source machine must be reachable from the internet.

1. Give the source machine a stable LAN IP on the local router.
2. Forward external TCP port `5000` to source-machine-LAN-IP:`5000`.
3. Allow inbound TCP `5000` in the host firewall.
4. Confirm the source server is listening on `0.0.0.0`.
5. Set `PUBLIC_URL` to the real public IP or DNS name and the forwarded port.

Notes:

- This project does not include automatic NAT traversal for the HTTP signaling server.
- If your public IP changes often, use a dynamic DNS name and update `PUBLIC_URL`.
- STUN alone is not enough for every network path. If direct media fails across certain NATs, add TURN later using the existing placeholders.

## Testing From Two Devices

1. Start the source machine with `npm run start-source`.
2. Visit the source dashboard and log in as:
   - `source@example.com`
   - `SourcePass123!`
3. Start the viewer machine with `npm run start-viewer`.
4. Log in on the viewer app as:
   - `viewer@example.com`
   - `ViewerPass123!`
5. On the source dashboard, create a new session.
6. Copy the session ID.
7. On the viewer app, paste that session ID and request access.
8. Approve the viewer on the source dashboard.
9. On the source dashboard, choose the capture mode:
   - browser tab
   - window/app
   - full screen
   - protected backend video
10. Start publishing.
11. On the viewer app, the stream should connect automatically once approved; if needed, use `Connect now`.

## Development Workflow

### Daily Source-Node Development

1. Update `source-server/.env`
2. Update `source-server/ui/.env`
3. Run `npm run start-source`
4. Work from `source-server/src/` for backend changes
5. Work from `source-server/ui/src/` for source-dashboard changes

### Daily Viewer-Node Development

1. Update `viewer-client/.env`
2. Run `npm run start-viewer`
3. Work from `viewer-client/src/`

### Debug Checklist

If login fails:

- confirm `VITE_SOURCE_SERVER_URL`
- confirm `ALLOWED_ORIGINS`
- confirm source server health at `/api/health`

If session join fails:

- confirm the viewer pasted the current session ID
- confirm the viewer was approved
- confirm the session is not expired

If signaling works but media does not:

- check browser permission prompts
- check ICE state in the UI debug panel
- verify router port exposure
- remember that TURN is not enabled yet

## Security Notes

- JWT auth remains enforced for REST and Socket.IO.
- The source node is still the single authority for session approval.
- Session IDs are UUID-based and authorization is checked before signaling is accepted.
- Viewer clients cannot access arbitrary sessions without auth and approval.
- Browser local storage is still used for dev-session persistence in the UI. For stronger production hardening, move to secure cookies or a refresh-token architecture.

## Current Scope

This refactor still intentionally supports only:

- one source
- one viewer
- private authenticated access
- direct WebRTC media path when ICE succeeds

It does not add:

- multi-viewer support
- SFU or relay media servers
- public streaming
- HLS fallback
- cloud hosting
