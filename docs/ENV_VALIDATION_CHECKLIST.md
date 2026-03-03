# Environment Validation Checklist

Use this checklist before promoting preview changes to production.

## Required Variables by Environment

> Ensure values match the target branch/environment and deployment URL.

### Preview

- [ ] `NODE_ENV=production`
- [ ] `AUTH_URL` points to **preview** app URL (not production)
- [ ] `NEXT_PUBLIC_APP_URL` points to the same **preview** URL users open
- [ ] Auth provider callback URLs include preview domain
- [ ] Database/storage/queue variables target non-production resources
- [ ] Third-party API keys are preview/sandbox where available

### Production

- [ ] `NODE_ENV=production`
- [ ] `AUTH_URL` points to **production** canonical URL
- [ ] `NEXT_PUBLIC_APP_URL` points to **production** canonical URL
- [ ] Auth provider callback URLs include production domain only
- [ ] Database/storage/queue variables target production resources
- [ ] Monitoring/alerting DSN or API keys are production-grade

## Critical URL Consistency Checks

Run these checks on each deploy:

- [ ] `AUTH_URL` and `NEXT_PUBLIC_APP_URL` use the same domain scheme (`https`)
- [ ] No trailing slash mismatch if app/router logic is strict
- [ ] No leftover branch-specific hostnames in production variables
- [ ] No mixed preview/prod values in one environment

## Branch Pitfalls (AUTH_URL / NEXT_PUBLIC_APP_URL)

Common mistakes during branch-based deploys:

1. **Preview branch promoted without URL swap**
   - Symptom: login redirects to old preview domain or fails callback.
2. **`AUTH_URL` set to prod while `NEXT_PUBLIC_APP_URL` stays preview**
   - Symptom: session/callback mismatch, CSRF/state errors.
3. **`NEXT_PUBLIC_APP_URL` set to prod while `AUTH_URL` stays preview**
   - Symptom: client navigates to prod while auth cookie/session bound to preview.
4. **Stale env cache after variable update**
   - Symptom: behavior does not match dashboard env values until redeploy/restart.

## Pre-Release Validation Steps

- [ ] Verify env vars in deployment platform UI/CLI for target environment
- [ ] Trigger fresh deploy after env changes
- [ ] Execute login/logout flow and callback redirect test
- [ ] Confirm key links/canonical URLs resolve to target environment
- [ ] Run smoke tests on critical user journey

## Sign-Off

- [ ] Preview validated by owner
- [ ] Production env reviewed by second reviewer (4-eyes)
- [ ] Release approved
