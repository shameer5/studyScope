# ADR-0002: Authentication & Authorization Approach

Date: 2024-01-15  
Status: Accepted (Local-First; To Be Revisited for Multi-User)  
Deciders: Architecture Team  

## Context

StudyScribe needs to determine whether to implement user authentication and authorization. The product is targeted at individual learners capturing personal study sessions. Early deployment will be local or on private networks.

Key considerations:
- Development velocity: authentication adds complexity and test burden.
- Deployment simplicity: no user management infrastructure required initially.
- Future scalability: may need multi-user/collaborative features later.
- Security posture: local deployment implies trust boundary is at network level.

## Decision

**Implement no authentication or authorization layer in v1.0. Assume single-user, local-first deployment model.**

### Rationale:
- **Simplicity**: eliminates password management, session management, role-based access control.
- **Alignment with product vision**: intended for individual learners, not teams.
- **Network-level security**: assume app is deployed behind a firewall or on localhost; network access controls act as the security boundary.
- **Time-to-market**: enables focus on core features (transcription, AI notes, Q&A) rather than auth infrastructure.

## Evidence in Codebase

- No auth decorators or user checks in `studyscribe/app.py` route handlers (all routes are unauthenticated). Example: `upload_audio(module_id, session_id)` assumes caller is authorized by network topology.
- No user table in `studyscribe/core/db.py` `SCHEMA`.
- No login endpoint or session token validation.
- `app.secret_key` is set to a weak default in `studyscribe/app.py` (see `ADR-0006` for session security).

## Alternatives Considered

1. **OAuth2 / OpenID Connect**
   - Pros: delegated auth, SSO support, standards-based.
   - Cons: adds ~1–2 weeks of dev work; requires external identity provider or local IAM system.
   - Rejected: overkill for single-user MVP; network topology assumed to handle boundary.

2. **API key / token-based**
   - Pros: simple to implement; works for local deployments.
   - Cons: requires secure key storage, rotation policy; still adds complexity.
   - Rejected: unnecessary if single-user and behind firewall.

3. **LDAP / Directory service**
   - Pros: integrates with enterprise directory.
   - Cons: enterprise feature; not applicable for individual learners.
   - Rejected: out of scope.

4. **Basic HTTP auth (username/password in headers)**
   - Pros: built into HTTP; libraries available.
   - Cons: weak without HTTPS; session state is complex; not persistent across refreshes.
   - Rejected: insufficient for web app UX.

## Consequences

### Positive:
- **Development speed**: routes focus on business logic, not auth checks. See `studyscribe/app.py` handlers for clean, focused code.
- **Deployment agility**: no user directory, LDAP, or auth service to configure.
- **Testing**: no need for auth fixtures; test routes directly.

### Negative:
- **Security risk if exposed**: if app is accidentally exposed to the internet, all sessions/data are readable by any visitor. See `docs/12-Risk-Register.md` (Risk S3: Unauthenticated endpoints).
- **Collaboration not supported**: cannot easily add multi-user features (shared sessions, comments) without rearchitecting.
- **Audit trail**: no user attribution for who performed actions (uploads, edits, exports).

## Migration Path to Multi-User (v1.1+)

If future versions require multi-user support:
1. Add `users` and `session_permissions` tables to `studyscribe/core/db.py` `SCHEMA`.
2. Integrate Flask-Login or Flask-JWT-Extended for session/token management.
3. Add auth decorators to route handlers in `studyscribe/app.py`.
4. Implement role-based access control (RBAC) per session/module.

## Recommendations

- **Security**: document that deployment should be network-restricted (VPN, firewall, localhost-only).
- **Monitoring**: log all module/session access for audit (to be added later if needed).
- **Session security**: ensure `FLASK_SECRET` is set to a strong random value in production (see `docs/09-Dev-Setup-and-Runbook.md`).
