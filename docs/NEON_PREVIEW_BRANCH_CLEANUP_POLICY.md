# Neon Preview Branch Cleanup Policy

## Goal
Prevent Vercel preview deployment failures caused by Neon branch quota limits.

## Scope
Applies to all preview databases created by Vercel integration for this repository.

## Branch Retention Rules

### Always keep
- `main`
- `production` (if used)
- `staging` (if used)
- any branch explicitly marked as protected/long-lived by the team

### Safe to delete
- preview branches tied to **merged or closed PRs**
- preview branches older than **7 days** with no active PR
- failed deployment branches not reused by active PRs

## Operating Schedule
- **Event-driven cleanup:** after PR is merged/closed
- **Weekly cleanup:** every Monday (Asia/Jakarta), prune stale preview branches

## Manual Emergency Procedure (when branch limit is hit)
1. Open Neon dashboard → Project → Branches
2. Sort by newest/oldest and identify preview branches
3. Keep protected branches (`main`, `production`, `staging`)
4. Delete stale preview branches first (merged/closed PRs)
5. Re-run failed Vercel deployment

## Ownership
- Primary owner: engineering (repo maintainers)
- Review cadence: weekly

## Verification Checklist
After cleanup:
- [ ] Vercel preview deployment can provision integration branch
- [ ] Active PR previews still work
- [ ] Protected branches remain intact

## Naming + Metadata Convention (recommended)
Use branch names or labels that can be traced to PR:
- `preview/pr-<number>-<slug>`

If Vercel controls naming, maintain a mapping in deployment metadata/logs where possible.

## Safety Guardrails
- Never delete `main`/production branches.
- Never delete a branch used by an open PR without confirmation.
- If uncertain, keep branch and delete oldest confirmed stale previews first.
