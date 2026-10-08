# Deployment contract

Provider-neutral contract for the current application; not a deployment automation script. Pair with the [release runbook](release-runbook.md) and [existing safeguards / CI](release-hardening.md). No cloud provider, container runtime or distributed service is required by this document.

## Audited baseline

- API: ASP.NET Core / EF Core 10, SQL Server provider; no production automatic migrations or bootstrap users. OpenAPI is Development-only. No production Docker/compose artifacts currently exist.
- Frontend: Vite static build, browser-history routes. API origin is embedded at build time; SignalR uses `/hubs/realtime` on the page origin.
- Probes: dependency-free liveness; SQL connectivity readiness; AI is not a dependency. Readiness does **not** prove schema version, disk write access or role correctness.
- JWT key must have at least 32 characters at startup. Connection configuration must exist. Issuer/audience, host allowlist, filesystem and proxy deployment correctness still require operator verification.
- `AllowedHosts` defaults to `*`; no explicit forwarded-header middleware or application HSTS is configured. HTTPS redirection is enabled. Auth limits see the TCP peer IP, not an arbitrary forwarding header.
- Storage is local/private under the API content root, not configurable through a custom storage-root option. No `UseStaticFiles` exposes these files. No automatic orphan sweep or retention scheduler exists.
- CI gates are implemented, but a successful first GitHub-hosted execution is still a release prerequisite. Local tests are not a substitute for staging/proxy/restore checks.

## Initial topology

```text
Internet -- HTTPS --> reverse proxy / TLS termination
                       |-- frontend/dist static assets + SPA route fallback
                       |-- /api/* ----------- HTTPS --> private API process
                       |-- /hubs/* ---------- HTTPS --> same API (WebSocket upgrade)
                       `-- /health/* -------- HTTPS --> API (probe access restricted)
                                                     |-- SQL Server (encrypted connection)
                                                     |-- persistent private App_Data volume
                                                     `-- optional private Ollama endpoint
```

Start with one API replica. Only the proxy is public. Restrict API, SQL and AI network access to their required callers. Serve static assets separately from private storage. Route API/hub/probe requests **before** the frontend SPA fallback; never turn an API 404 into `index.html`. Frontend deep links must serve `index.html`; missing static assets should remain 404. Cache hashed assets long-term; revalidate `index.html` to avoid mixed releases.

### Proxy trust, HTTPS and HSTS

For this unchanged application, use an **HTTPS backend hop with certificate verification**, so Kestrel sees HTTPS without relying on `X-Forwarded-Proto`. Provision a real internal server certificate and trust chain, restrict Kestrel ingress to the proxy, and preserve the public Host header. Configure its certificate/listener using standard Kestrel host configuration (below), not a development certificate. Redirect public HTTP to HTTPS at the proxy; add HSTS at the proxy only after TLS and all affected hosts are validated. Application `UseHttpsRedirection` remains enabled; `UseHsts` is not present. Check for redirect loops in staging.

Forwarded headers are deliberately not enabled by this checkpoint. There is no application `KnownProxies` configuration key to set. Do **not** enable trust-all forwarding via `ASPNETCORE_FORWARDEDHEADERS_ENABLED`, clear trust lists or trust client-supplied IP headers. The proxy must strip/overwrite inbound forwarding headers and enforce its own per-client auth rate limit. Current app anonymous limits aggregate users behind each proxy TCP peer; choose the application auth budget for aggregate traffic and retain a stricter per-client gateway limit. Application logs will not provide original client IP attribution in this mode.

If a deployment requires HTTP upstream or application-level client IP attribution, a small separately reviewed change is required **before that deployment**: configure actual trusted proxy addresses in `ForwardedHeadersOptions.KnownProxies` (or narrowly trusted `KnownIPNetworks` in .NET 10), a bounded forwarding hop limit and only the needed `XForwardedFor` / `XForwardedProto`; process them before HTTPS redirection, auth and rate limiting. Do not forward Host unless specifically validated. Test spoofed headers and real proxy IP/scheme behavior. No fictional proxy addresses or currently unsupported configuration knobs are supplied here. See [Microsoft proxy guidance](https://learn.microsoft.com/en-us/aspnet/core/host-and-deploy/proxy-load-balancer).

## Configuration matrix

All backend entries below are **runtime** settings supplied by the process supervisor/secret store, not committed credentials. `__` represents nested .NET configuration. “Required” means required by this deployment contract, even where code has a default.

| Setting | Requirement / classification | Meaning / current default |
| --- | --- | --- |
| `ASPNETCORE_ENVIRONMENT` | Required, non-secret | `Production`; never Development in production |
| `ConnectionStrings__DefaultConnection` | Required, secret | SQL connection; validated encryption, database and least-privilege identity |
| `Jwt__Key` | Required, secret | Random high-entropy signing material, at least 32 characters; do not reuse CI dummy key |
| `Jwt__Issuer` | Required, non-secret | Stable deployment issuer; default `ResidentialManagementApi` |
| `Jwt__Audience` | Required, non-secret | Stable application audience; default `ResidentialManagementApp` |
| `Jwt__ExpirationMinutes` | Optional, non-secret | Default 60; review session policy |
| `Cors__AllowedOrigins__0` (and indexed siblings) | Required review, non-secret | Exact browser origins (scheme/host/port, no trailing slash); replace localhost default. Same-origin does not need cross-origin access, but supply only intended public origin(s) |
| `AllowedHosts` | Required, non-secret | Semicolon-separated actual accepted hostnames, no scheme/port; override `*`. Proxy must reject unexpected Host values too; allow only necessary probe Host values |
| `RateLimiting__auth__PermitLimit` / `WindowSeconds` | Optional, non-secret | Default 10 / 60 seconds; TCP peer IP; proxy aggregate caveat above |
| `RateLimiting__ai__PermitLimit` / `WindowSeconds` | Optional, non-secret | Default 6 / 60; authenticated user |
| `RateLimiting__upload__PermitLimit` / `WindowSeconds` | Optional, non-secret | Default 10 / 60; authenticated user |
| `Ai__Provider` | Optional, non-secret | `Disabled` (default) or `Ollama` |
| `Ai__Model` | Required only for Ollama, non-secret | Installed text model name |
| `Ai__BaseUrl` | Required only for Ollama, server-side non-secret | Private HTTP/HTTPS provider origin; not a browser setting |
| `Ai__TimeoutSeconds` | Optional, non-secret | Default 60; service clamps to 5–60 seconds |
| `Ai__Vision__Provider` | Optional, non-secret | `Disabled` (default) or `Ollama`, independent of text |
| `Ai__Vision__Model` | Required only for vision Ollama, non-secret | Installed vision-capable model |
| `Ai__Vision__BaseUrl` | Required only for vision Ollama, server-side non-secret | Private provider origin |
| `Ai__Vision__TimeoutSeconds` | Optional, non-secret | Default 90; service clamps to 10–180 seconds |
| `Logging__LogLevel__Default` | Optional, non-secret | Default Information; avoid verbose production request/body logging |
| `Logging__LogLevel__Microsoft.AspNetCore` | Optional, non-secret | Default Warning |
| `Kestrel__Endpoints__Https__Url` | Required for HTTPS upstream baseline, non-secret | Private HTTPS bind address/port; do not publish directly |
| `Kestrel__Endpoints__Https__Certificate__Path` | Required for certificate-file setup, non-secret | Mounted server certificate path chosen by operator |
| `Kestrel__Endpoints__Https__Certificate__Password` | Conditional, secret | If certificate is password protected; secret-store supplied |
| `VITE_API_BASE_URL` | Required frontend **build-time**, public/non-secret | Public HTTPS origin, **without `/api`**, with no trailing slash |

Rate values are bounded to 1–1000 permits / 1–3600 seconds, no queue. Full policy/body-limit details remain in [release-hardening](release-hardening.md). Set proxy body allowance to accommodate 21 MiB import multipart requests; retain route-specific backend limits. Normalize edge 413/429 responses without internal details and set upstream timeouts above allowed synchronous operation time; test actual upload/AI behavior.

### Frontend and example values

Same-origin deployment is recommended, but **empty `VITE_API_BASE_URL` is not same-origin in this code**: `frontend/src/config.ts` falls back to `http://localhost:5006`. Build using the actual public application HTTPS origin. The code appends `/api/...`; supplying an `/api` suffix duplicates it. Explicit `/` currently normalizes to an empty prefix and therefore also supports same-origin requests; an actual HTTPS origin is preferred here for an unambiguous build contract. There is no runtime frontend environment injection: changing that public origin requires rebuilding. Vite dev `/hubs` proxy is not part of `dist`.

Placeholder-only configuration example (replace through deployment tooling; do not use literally):

```text
ASPNETCORE_ENVIRONMENT=Production
ConnectionStrings__DefaultConnection=<secret encrypted SQL connection>
Jwt__Key=<secret random signing material>
Jwt__Issuer=<stable issuer>
Jwt__Audience=<stable audience>
AllowedHosts=<actual public hostname>
Cors__AllowedOrigins__0=<actual public HTTPS origin>
Ai__Provider=Disabled
Ai__Vision__Provider=Disabled
VITE_API_BASE_URL=<same actual public HTTPS origin, build-time only>
```

No `.env` example files are added: the backend does not load dotenv files, and shell/supervisor syntax differs. The example above is a configuration checklist, not a shell script. Actual `.env` and `.env.*` files are already ignored (except `.env.example`); keep production secrets in deployment-managed storage and outside release artifacts. Never put a secret in `VITE_*`.

## SignalR, probes and scale

- Proxy `/hubs/realtime` to this API with WebSocket upgrade and HTTP fallback transport support (negotiate/long polling/SSE), suitable idle timeouts and no caching. Preserve query parameters for authentication **but redact them in logs**. Frontend hubs remain same-origin even if an explicit different API origin is built.
- Restrict `/health/*` to platform probes/operators where possible. Use the HTTPS upstream listener and a Host accepted by `AllowedHosts`. `/health/live`: 200 without dependency checks. `/health/ready`: 200 Healthy / 503 Unhealthy, SQL only, safe JSON status. Probe every tens of seconds with short timeouts, a startup grace period and several failures before removal/restart; do not restart continuously on a transient database readiness failure.
- All rate limits are per API process. Multiple replicas multiply limits and also need shared/gateway enforcement. SignalR groups/connections are process-local: this release does not include a backplane; sticky connections alone do not deliver broadcasts across replicas. Stay single-replica until realtime scale-out is designed/tested. No Redis or separate SignalR service is added now.

## SQL and migrations

SQL Server 2022 is the tested baseline (integration fixture uses 2022); use a supported, patched installation. Configure encrypted client connections with certificate validation (`Encrypt=True;TrustServerCertificate=False`) and matching server certificate/hostname; do not carry development trust bypasses into production. See [SqlClient encryption guidance](https://learn.microsoft.com/en-us/sql/connect/ado-net/encryption-and-certificate-validation).

Use a dedicated application database identity, not `sa` or development defaults. Grant only required application DML/access; use a separate controlled identity for schema migrations, not permanent schema-owner privileges in the API. Keep SQL off the public network. Encrypt/restrict backups, retain restore keys/certificates securely and rehearse restoration. Set retention, recovery point/time objectives and alert ownership before release.

Production startup does not apply migrations. CI pending-model validation is mandatory; do not generate a new migration during deployment. Review committed migrations and execute them once as a controlled step using EF tool 10.0.10 matching this repository's packages. The [runbook](release-runbook.md) gives the procedure. No first production administrator is bootstrapped: a reviewed secure account provisioning procedure is an explicit first-release prerequisite; do not use Development mode to create production users.

## Persistent files and lifecycle

All roots are relative to **API `IHostEnvironment.ContentRootPath`**:

| Category | Exact root | Storage service |
| --- | --- | --- |
| Documents | `App_Data/documents` | `DocumentFileStorageService` |
| Import uploads | `App_Data/imports` | `ImportFileStorageService` |
| Payment receipts | `App_Data/receipts` | `LocalReceiptStorageService` |
| Maintenance attachments | `App_Data/request_attachments` | `RequestFileStorageService` |

Mount persistent storage at `<API content root>/App_Data`; no custom `StorageRoot` env key exists. Fix the service working/content root explicitly to the deployed API directory; mounting a different working directory does not magically redirect storage. Keep the mount across release-directory switches. API identity needs directory traversal plus read/write/create/delete, not world-access. Restrict backup access, keep storage outside static frontend roots, and never expose `/App_Data` through proxy aliases. Protect symlinks/mount ownership from untrusted modification. Verify read/write and free capacity before admitting traffic. Readiness does not test this.

Database references and files form one recovery set. Back up/restore both within a quiesced write window; do not assume SQL transactions make file writes atomic. Failed-upload cleanup is best effort; crash/realtime/storage failure can leave orphan files. Never delete by age alone: reconcile keys against live/history database references, quarantine candidates, then perform reviewed cleanup. No sweeper is implemented.

Import retention is an explicit ADMIN operation: `POST /api/imports/cleanup-retention?fileRetentionDays=7&piiRetentionDays=30`. It uses UTC `CreatedAt`, terminal statuses COMPLETED/FAILED/ROLLED_BACK, clamps file days to 1–365 and raw-row PII days to 7–365, marks stored file keys `[CLEANED_UP]`, and redacts `ImportRowLog.RawDataJson`. It does **not** purge every history/metadata field or abandoned nonterminal batch. Schedule an operator-reviewed invocation according to local policy, not an invented background service. The current response counts attempted deletion/marks keys even if physical deletion fails; inspect warning logs and reconcile residual files. Test on staging and back up before destructive cleanup. Do not treat its counts as verified physical erasure or a complete PII retention policy.

## Optional AI and privacy

1. **Disabled:** safest default; core maintenance, announcements, analytics and health work without a model.
2. **Ollama:** text/vision independently enabled via server-side settings; isolate network, install the chosen models, bound resources and test timeouts. Never expose unauthenticated model endpoints to the internet. No external paid key is required.
3. **Future external provider:** abstractions allow one, but none is implemented/configured by this checkpoint. A separate privacy/security/data-transfer review is required before use; `Ai__ApiKey` is not a working new-provider switch.

Do not log passwords, JWTs, connection strings, file contents, unnecessary resident free text, image/base64 or raw AI prompts/responses. Known domain/AI errors use safe logging, and client cancellation is expected control flow. The generic unexpected-exception path still records exception/message/stack: these are not proven universally free of sensitive values. Restrict access, review logs in staging, apply redaction at collection and avoid verbose EF/request-body logging. Configure rotation/retention/alerts through the host. Mask SignalR `access_token` query values in proxy/APM/access logs; do not record full query strings or Authorization headers. Provider payloads and secrets do not belong in backups of application artifacts.

## Staging and readiness boundary

Use independent SQL, private files and credentials with synthetic users; no production personal data. Reuse the intended proxy/TLS, migration and mount process on modest resources. CI proves build/tests/dependency audit/model consistency; deployment proves secrets, network/TLS, migration identity, persistence, backups, real role boundaries and rollback. Neither CI nor these documents claim production deployment has occurred. First hosted green `backend`, `integration`, `frontend`, `security`, staging smoke and a restore drill remain required before release.
