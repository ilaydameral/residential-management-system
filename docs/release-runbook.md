# Release runbook

Use with the [deployment contract](deployment.md). Provider-neutral, manually controlled release procedure; no automatic deployment/DB downgrade is introduced. Assign a release owner and rollback decision owner. Record artifact/commit IDs, schema migration ID, config revision, backup set and smoke outcomes without secrets.

## 1. Pre-deploy gate

- Scope freeze; review diff and migration compatibility with both new and previous application versions.
- After branch push/PR, require first **GitHub-hosted** CI success for `backend`, `integration`, `frontend`, `security`. Local results alone do not validate the hosted runner. Require the same checks for subsequent releases; pending-model check is included, no duplicate migration generation.
- Prepare previous/new immutable artifacts and static frontend build with actual `VITE_API_BASE_URL`. Verify origin has no `/api` suffix and no localhost fallback. Build with the SDK in `global.json`, Node 22 and lockfile installs; never use Vite dev server for production.
- Verify Production environment, JWT secret/issuer/audience, exact AllowedHosts/CORS, SQL TLS, credentials and private HTTPS listener/certificate. Provision a reviewed initial ADMIN if first deployment; Development bootstrap is not a production provisioning mechanism.
- Mount persistent `App_Data` into the new API content root. Check permissions, write access, available space and backup access before startup.
- Verify edge Host validation, HTTP→HTTPS/HSTS, HTTPS upstream certificate verification, client-IP rate limiting, upload allowances, `/api` routing, WebSocket `/hubs/realtime`, protected probes and SPA deep-link fallback.
- Complete staging role/proxy/file checks and a coordinated restore rehearsal. Choose downtime/write-quiescence window and identify schema compatibility/rollback path **before** applying migration.

Build artifacts on a controlled machine (output paths are operator-selected, outside private files):

```bash
dotnet publish backend/ResidentialManagement.Api/ResidentialManagement.Api.csproj -c Release -o <backend-artifact-directory>
npm --prefix frontend ci
# Inject actual VITE_API_BASE_URL into this build process, never a secret.
npm --prefix frontend run build
```

Angle-bracket placeholders in this runbook must be replaced; these blocks are not copy/paste scripts. Keep artifacts separate from the repository's uploads and from DB backups.

## 2. Coordinated backup

1. Remove public write traffic and drain requests; stop API writers/other jobs, including retention invocations. Confirm no background/external writer remains.
2. Take a SQL backup using approved DBA tooling; verify it and record database migration history/recovery timestamp. Retain any required encryption keys/certificates separately and securely.
3. Snapshot/copy the complete private `App_Data` tree while writes remain quiesced. Preserve ownership/permissions and capture a manifest/checksums if tooling supports them.
4. Link SQL and file snapshots to one recovery-set ID. Store encrypted/restricted copies outside the application host's failure domain; document retention and recovery objectives.
5. Confirm restore capability, not merely that backup files exist. Release/deploy while writes remain stopped or resume only if abandoning deployment. A SQL-only backup cannot restore file-backed records reliably.

## 3. Controlled migration

Prepare source/tooling from the exact release commit, not whichever branch happens to be checked out. Use .NET SDK from `global.json`, EF CLI **10.0.10**, Production environment, migration identity connection and JWT configuration supplied securely to the process. Never put connection strings in command arguments/history or logs. Production bootstrap is disabled; there is no automatic production migration.

```bash
dotnet ef migrations list --project backend/ResidentialManagement.Api/ResidentialManagement.Api.csproj
dotnet ef migrations script --idempotent --project backend/ResidentialManagement.Api/ResidentialManagement.Api.csproj --output <reviewed-script-path>
dotnet ef database update --project backend/ResidentialManagement.Api/ResidentialManagement.Api.csproj
```

Review the generated script before execution (schema/data changes, locks, expected duration, backwards compatibility); alternatively have the DBA execute the reviewed idempotent script. Choose **one** controlled executor, not both concurrently. Scripts may contain seeded/domain data and belong in restricted release staging, not committed/generated artifacts by default. Confirm `__EFMigrationsHistory` reaches the release's expected final ID, the command succeeded and no pending deployment step remains. Readiness only checks connectivity, not schema completeness. Return the running API to the lower-privilege app identity after the migration step.

Migrations are forward operations. Never automatically run Down during a rollback; data loss/schema incompatibility requires a reviewed rollback migration or coordinated backup restore. Stop on migration failure and assess partial effects before rerunning or resuming traffic.

## 4. Deploy, start and switch traffic

1. Install/switch backend and frontend artifacts; retain previous compatible artifacts. Reattach the same persistent storage, not an empty directory beneath a new release.
2. Ensure configuration/SQL/network/storage/migrations are ready. Start the published API via supervisor in its correct content root; provision valid internal HTTPS certificate before startup. Keep API private.
3. Verify startup logs without disclosing config. Call `/health/live` and `/health/ready` on the HTTPS listener with an allowed Host. Require 200/Healthy readiness; inspect SQL/schema/file access separately.
4. Enable routing to the healthy API and matching frontend. Confirm HTTP redirect and HTTPS deep links, no loops, no localhost browser API calls and no mixed content. Revalidate `index.html` cache. No private file static routes.
5. Run the smoke matrix below; record pass/fail and stop release if privacy/authorization/migration/file failures occur. Optional AI failure alone is not core downtime, but report it honestly if AI was enabled for release.

## 5. Post-deployment smoke matrix

Use synthetic staging users; in production prefer read-only checks and explicitly approved disposable records, never casually mutate/delete residents or financial history. “Denial” means no sensitive data returned, not merely hidden navigation.

| Role/system | Checks |
| --- | --- |
| ADMIN | Login; management shell; representative property→building→unit detail; analytics; scoped document download; import remains ADMIN-only |
| MANAGER | Own assigned property/building/unit; guessed sibling IDs denied; announcements within scope; analytics only authorized scope; global users/import denied |
| RESIDENT | Own unit/detail only; maintenance form usable with AI disabled; documents/finance limited to own authorized data; common facilities match occupancy; optional explicit AI suggestion if enabled (apply/ignore, no automatic persistence) |
| TECHNICAL_STAFF | Assigned maintenance detail/workflow; management/private resident API denial |
| Probes | `/health/live` 200; `/health/ready` 200 safe status; staging SQL outage yields readiness 503 without killing liveness |
| Realtime | Authenticated `/hubs/realtime` negotiate + WebSocket connection; representative safe notification/update; reconnect/fallback; no token query logging |
| Files | Authorized representative document/receipt/attachment download; unauthorized guessed file/record denied; private directory unreachable directly; test persistent mount across staging restart |
| Edge limits | Staging controlled bursts produce safe 429/Retry-After; distinguish gateway client-IP limit vs app proxy aggregate limit; verify chunked/oversized upload 413 and no internal detail leakage |
| Browser | Deep-link refresh; role guards; logout/login; account/settings; narrow-screen navigation remains usable |

Do not deliberately disrupt production SQL or flood production endpoints to test limits. These failure-mode checks belong in staging; record production health/read-only outcomes separately.

## 6. Shutdown

Remove new traffic/readiness admission where supported; drain HTTP requests and realtime connections, then ask the supervisor for graceful termination with time for in-flight operations. Verify process exit; avoid abrupt kill unless hung and consciously accept possible orphan-file reconciliation. No shutdown migration. Retention/backup writers must also stop before a recovery snapshot.

## 7. Rollback decision tree

| Case | Action |
| --- | --- |
| Application failed, schema compatible with old app | Remove traffic; restore previous frontend/backend artifacts together, preserve files/config compatibility; health + role/file smoke before traffic |
| Migration incompatible or destructive | Do not blindly downgrade; stop writes; DBA/owner chooses reviewed rollback migration or restores coordinated SQL/files backup. A backup restore loses writes after the recovery point; explicitly approve this consequence |
| Storage lost/corrupt/mis-mounted | Remove traffic/writers; verify mount first; if recovery required restore coordinated database/files set, not an unrelated snapshot. Reconcile references before opening traffic |

A partially failed migration or unknown compatibility is a stop condition, not permission to deploy an older binary against it. JWT/config rollback must preserve deliberate security decisions; do not restore leaked keys. Communicate outage/data recovery point and document the incident.

## 8. Restore drill / recovery

1. Isolate recovery target and stop all writes; choose one verified coordinated backup set. Restore to staging first where possible.
2. Restore SQL using DBA tooling and required keys; restore complete private files with intended ownership/permissions to the matching API content root.
3. Reconcile DB storage keys for documents/imports/receipts/attachments with disk: identify missing, unmatched and cleaned/redacted records. Do not delete candidates automatically or silently rewrite references.
4. Select application artifacts compatible with restored migration history; restore safe config (secrets from secret store, not a public backup). Apply any separately reviewed forward upgrade only after recovery validation.
5. Verify probes plus representative authorized downloads, finance and role isolation. Readiness alone does not validate restored files.
6. Resume traffic only after sign-off; record measured recovery time/data loss window. Rotate exposed secrets if the incident involved compromise.

## 9. Ongoing operations and release evidence

- Schedule reviewed import retention invocation per [actual lifecycle behavior](deployment.md#persistent-files-and-lifecycle); monitor delete warnings/residual files and nonterminal batches. No general file sweeping or automatic history purge exists.
- Monitor disk, SQL/backups, readiness, 5xx/429, realtime connectivity and optional AI resource/timeout failures. Host log rotation/retention/redaction are operator-owned. Unexpected exception logging still needs privacy review; do not claim universal sanitized logs.
- CI owns build/test/dependency audit/model-drift checks. Deployment owns secrets, migrations, proxy/TLS, mounts, backups, restore, actual health and post-deploy role checks. No deployment workflow is introduced.
- Release evidence must include hosted CI URLs, artifact IDs, reviewed migration/script, backup recovery-set verification, staging/proxy results and role smoke outcome. No hosted CI or production/staging deployment is claimed by this documentation checkpoint.
