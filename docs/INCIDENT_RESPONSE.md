# Incident Response Runbook

This runbook covers first-response actions for production incidents.

## Severity Levels

- **SEV-1 (Critical):** Full outage, major data corruption risk, auth/payment/system-wide failure. Immediate response.
- **SEV-2 (High):** Significant feature degradation for many users, no full outage.
- **SEV-3 (Medium):** Limited impact or clear workaround exists.
- **SEV-4 (Low):** Minor issue, cosmetic/non-blocking.

## First 15 Minutes (Golden Window)

1. **Acknowledge incident** in team channel/on-call thread with timestamp.
2. **Assign Incident Commander (IC)** and a communications owner.
3. **Stabilize first**:
   - Pause risky deploys/migrations.
   - Enable maintenance mode/feature flag fallback if applicable.
4. **Confirm blast radius**:
   - Which environment (preview/prod)?
   - Which user segments/routes are affected?
   - Is data integrity at risk?
5. **Collect hard signals**:
   - App/API error rates, latency, crash logs.
   - Auth/session failures.
   - Recent deploy/config/env changes.
6. **Set initial severity** and next update time (e.g., every 10–15 min).

## Rollback Criteria

Rollback immediately when one or more apply:

- Error rate or failed requests sharply increased right after release.
- Core flows fail (login, checkout, order submission, dashboard load).
- Data write path is failing or risking corruption.
- Incident cannot be mitigated safely within 10–15 minutes.
- Root cause is strongly linked to latest deploy/config change.

### Rollback Guardrails

- Prefer **last known good build/config**.
- Roll back one variable at a time when feasible (code vs env vs flag).
- Confirm rollback with smoke checks before announcing recovery.

## Owner Checklist

### Incident Commander (IC)

- [ ] Declare incident + severity
- [ ] Assign roles (ops, comms, investigator)
- [ ] Keep timeline of key actions
- [ ] Decide rollback/mitigation path
- [ ] Declare recovery and handoff to RCA

### Investigator/Implementer

- [ ] Verify trigger (release, env, dependency, infra)
- [ ] Capture logs/errors/screenshots/trace IDs
- [ ] Apply mitigation or rollback
- [ ] Validate core user journeys post-fix

### Communications Owner

- [ ] Publish status updates at agreed cadence
- [ ] Share impact, mitigation, and ETA clearly
- [ ] Confirm incident closure message

## Recovery Exit Criteria

Before closure:

- [ ] Metrics returned to baseline (errors/latency/success rate)
- [ ] Core flows pass smoke checks
- [ ] No new high-severity alerts for a stability window
- [ ] Incident timeline and follow-ups captured

## Post-Incident (Within 24 Hours)

- Write brief RCA (trigger, impact, fix, prevention).
- Create action items with owners and due dates.
- Add tests/alerts/runbook updates to prevent recurrence.
