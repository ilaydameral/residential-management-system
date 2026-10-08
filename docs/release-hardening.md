# Release request and health safeguards

Rate limits use ASP.NET Core fixed windows, with no queue. Defaults per 60 seconds:

| Policy | Permit count | Partition | Operations |
| --- | --- | --- | --- |
| auth | 10 | Connection remote IP | login and public register combined |
| ai | 6 | Authenticated user ID | all AI operations combined |
| upload | 10 | Authenticated user ID | documents, maintenance attachments, receipts, import upload/validate/confirm |

Configure `RateLimiting:{auth|ai|upload}:PermitLimit` and `WindowSeconds` through configuration/environment. Values are bounded to 1–1000 permits and 1–3600 seconds. These conservative defaults limit brute-force attempts and synchronous resource use; tune after observing normal traffic. Ordinary GETs are not limited. Authorization precedes rate limiting. 429 returns a safe Turkish message and Retry-After.

Partition keys never use user-supplied forwarding headers. Forwarded-header middleware is deliberately deferred until deployment has known proxy IP/network addresses. Behind a proxy, the current anonymous key is the proxy connection IP, so users share that limit. The unchanged-code [deployment contract](deployment.md#proxy-trust-https-and-hsts) uses verified HTTPS upstream and gateway per-client limits. HTTP upstream/client IP attribution requires a separately reviewed trusted-proxy hook before deployment, ahead of HTTPS redirection and the limiter; never accept all proxies/networks. Limits are per process; multiple replicas require gateway/shared enforcement as well.

Anonymous `/health/live` has no dependencies. Anonymous `/health/ready` checks SQL connectivity only and returns Healthy/Unhealthy with 200/503; optional AI is not a readiness dependency. Bodies contain no connection or exception details. Infrastructure should restrict probe exposure if required.

Known-length upload bodies are rejected before model binding: 6 MiB for maintenance/image/receipt, 11 MiB for documents, 21 MiB for imports (file limits remain 5/10/20 MiB respectively). Safe JSON is supplied for otherwise empty 400/413 responses and surfaced by the frontend. Chunked request enforcement still belongs to Kestrel; reverse-proxy rejections outside the app must be normalized/configured at deployment. Do not assume TestServer proves reverse-proxy behavior.

Failed maintenance/import persistence removes the newly stored file. Document cleanup preserves the primary error. Receipt files become DB-owned immediately after persistence and must survive subsequent realtime/projection failures. Partial maintenance/import writes are removed on failure. Archive/history files remain retained according to existing domain policies; no sweeping retention job is introduced here. Cleanup failures log only safe fixed text and require operational follow-up; startup orphan reconciliation is not implemented.

## CI quality gate

`.github/workflows/ci.yml` runs four parallel jobs for pull requests and pushes to main only. It uses read-only repository permissions and does not persist checkout credentials. New runs cancel older runs of the same PR; main runs have unique concurrency groups and remain independent. Tests and builds do not need production secrets or AI providers. Integration uses the existing Testcontainers SQL Server 2022 fixture on the GitHub-hosted Ubuntu Docker daemon, with random credentials and an isolated disposable DB. No SQL service container or SQLite substitute is introduced.

SDK selection is .NET 10.0.302 with compatible patch roll-forward; Node is the supported 22 LTS line. npm cache keys use `frontend/package-lock.json`; NuGet package cache keys use `global.json` plus project files. NuGet has no committed lock files, so package caching is only a performance aid and restore always runs. NuGet transitive resolution and the SQL image `2022-latest` remain upstream inputs. CI never generates migrations, changes lock files, or formats source. Each job checks tracked files stayed unchanged.

Security checks fail on production npm advisories (`npm audit --omit=dev`) and NuGet audit warnings for direct/transitive dependencies. `dotnet list package --vulnerable` is a diagnostic report, not the failure gate: security first runs audit-enabled restore with warnings as errors for every project. Restore/audit source failures also fail CI rather than claim a clean scan. Local equivalent from the repository root:

```bash
for project in backend/*/*.csproj; do
  dotnet restore "$project" --force -p:NuGetAudit=true -p:NuGetAuditMode=all -p:TreatWarningsAsErrors=true
  dotnet list "$project" package --vulnerable --include-transitive --no-restore
done
```

Full ESLint is excluded because of existing debt. Browser/E2E, staging probes, proxy behavior and deployment validation are separate acceptance checks. The backend job installs EF tool 10.0.10 (matching the API's EF packages) in runner temp storage and checks pending model changes after build. Production environment disables development bootstrap/user-secrets; a deliberately unreachable placeholder DB connection and public dummy JWT key satisfy startup validation without connecting to a DB. The host-resolution timeout is bounded to 30 seconds. The same isolated check passed locally; sandbox-restricted process execution had previously caused host-resolution timeout. Integration also applies committed migrations to a fresh SQL DB. Keep the EF tool version aligned when updating EF packages.

Expected cold workflow time is approximately 4–8 minutes, dominated by SDK/NuGet download and SQL image pull; this is an estimate until the first hosted run. Job timeouts bound hangs. No user files, DB dumps, provider payloads or test artifacts are uploaded. GitHub secret scanning availability depends on repository settings/plan: enable native scanning/push protection where available; dependency audit is not secret scanning.

Recommended branch protection: require a PR and passing checks named exactly `backend`, `integration`, `frontend`, and `security` from the `CI` workflow, and disallow merges when these checks fail. Confirm the displayed check names after the first hosted run. Branch protection is not configured automatically. Review the first hosted run before treating this workflow as a proven remote gate.
