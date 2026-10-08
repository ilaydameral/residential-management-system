# Release request and health safeguards

Rate limits use ASP.NET Core fixed windows, with no queue. Defaults per 60 seconds:

| Policy | Permit count | Partition | Operations |
| --- | --- | --- | --- |
| auth | 10 | Connection remote IP | login and public register combined |
| ai | 6 | Authenticated user ID | all AI operations combined |
| upload | 10 | Authenticated user ID | documents, maintenance attachments, receipts, import upload/validate/confirm |

Configure `RateLimiting:{auth|ai|upload}:PermitLimit` and `WindowSeconds` through configuration/environment. Values are bounded to 1–1000 permits and 1–3600 seconds. These conservative defaults limit brute-force attempts and synchronous resource use; tune after observing normal traffic. Ordinary GETs are not limited. Authorization precedes rate limiting. 429 returns a safe Turkish message and Retry-After.

Partition keys never use user-supplied forwarding headers. Forwarded-header middleware is deliberately deferred until deployment has known proxy IP/network addresses. Behind a proxy, the current anonymous key is the proxy connection IP, so users share that limit. Before deployment, explicitly configure trusted proxies and place forwarded-header processing before the limiter; never accept all proxies/networks. Limits are per process; multiple replicas require gateway/shared enforcement as well.

Anonymous `/health/live` has no dependencies. Anonymous `/health/ready` checks SQL connectivity only and returns Healthy/Unhealthy with 200/503; optional AI is not a readiness dependency. Bodies contain no connection or exception details. Infrastructure should restrict probe exposure if required.

Known-length upload bodies are rejected before model binding: 6 MiB for maintenance/image/receipt, 11 MiB for documents, 21 MiB for imports (file limits remain 5/10/20 MiB respectively). Safe JSON is supplied for otherwise empty 400/413 responses and surfaced by the frontend. Chunked request enforcement still belongs to Kestrel; reverse-proxy rejections outside the app must be normalized/configured at deployment. Do not assume TestServer proves reverse-proxy behavior.

Failed maintenance/import persistence removes the newly stored file. Document cleanup preserves the primary error. Receipt files become DB-owned immediately after persistence and must survive subsequent realtime/projection failures. Partial maintenance/import writes are removed on failure. Archive/history files remain retained according to existing domain policies; no sweeping retention job is introduced here. Cleanup failures log only safe fixed text and require operational follow-up; startup orphan reconciliation is not implemented.
