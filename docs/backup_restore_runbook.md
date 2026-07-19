# Backup and Restore Runbook

This runbook describes the intended backup and recovery procedure for Somni's Supabase database.
It separates repository-confirmed behaviour from controls that must be verified in the hosted
Supabase project.

> **Stage 7 status — launch evidence missing (19 July 2026):** The repository does not prove that
> Point-in-Time Recovery (PITR) is enabled, how long backups are retained, that backup-failure
> alerts are delivered, or that a restore has succeeded. Record dashboard evidence and complete a
> non-production restore rehearsal before treating backup and recovery as launch-ready.

## 1. What is and is not verified

- Supabase is Somni's primary datastore, and schema changes are represented by versioned files in
  `supabase/migrations/`.
- Hosted backup availability, PITR availability, schedule, retention, and restore destinations
  depend on the actual Supabase project and plan. They are **not configured or verifiable in this
  repository**.
- No repository-backed Slack channel, paging integration, or automated backup-health alert was
  found. Operators must not assume a failed backup will page anyone.
- No working maintenance-mode control exists. `NEXT_PUBLIC_MAINTENANCE_MODE` is not consumed by
  application code and must not be used as an incident-control instruction.
- No named backup owner or substitute is recorded here. A reachable person must be assigned before
  launch; this runbook does not invent that assignment.

## 2. Pre-launch backup evidence

An authorised operator should capture the following without exposing database credentials or user
data in the evidence:

1. Open the hosted Supabase project's **Database > Backups** page.
2. Record which backup mechanisms the project actually offers and whether each is enabled.
3. Record the displayed backup schedule and retention period. Do not assume seven-day PITR or
   30-day snapshot retention unless the dashboard shows those values.
4. Record the timestamp and successful status of the most recent restorable backup.
5. Record where backup failures can be observed and who will check them. If there is no automated
   alert, document the manual check frequency and the assigned person outside this runbook.
6. Store screenshots or exported evidence in the approved private operational evidence location,
   not in this repository if they contain project identifiers or user data.

Missing or stale evidence is a launch blocker, not a reason to infer that managed backups are
healthy.

## 3. Non-production restore rehearsal

Use a provider-supported isolated restore target. Never rehearse by overwriting production.

1. Declare the rehearsal window and confirm that the target is an isolated, non-production
   project.
2. In the Supabase dashboard, choose a recent backup and use the restore or clone option that the
   current project plan actually provides. If no isolated restore option is available, stop and
   obtain an approved alternative; do not improvise against production.
3. Record the backup timestamp, rehearsal start time, restore completion time, and any provider
   errors.
4. Connect to the isolated database using an approved read-only or temporary rehearsal credential.
5. Validate schema presence and representative row counts. At minimum, confirm expected tables
   exist and run non-content checks such as counts for `profiles`, `babies`, `sleep_logs`, and
   `messages`.
6. Verify that application credentials and external webhooks do not point at the rehearsal project.
7. Record pass/fail evidence and the achieved recovery time. Do not copy personal data into tickets,
   chat, or this repository.
8. Remove the isolated target through the provider only after the evidence has been reviewed and
   any required retention has been satisfied.

The rehearsal passes only when the restored database is usable, representative integrity checks
pass, the measured recovery time is recorded, and production was not changed.

## 4. Emergency production recovery

Restoring production is destructive and can discard writes after the chosen recovery point.

1. Declare a SEV-1 incident and preserve the incident timeline. Follow
   [Incident Response](incident_response.md).
2. Contain writes using a control that is confirmed to work at incident time. There is currently no
   application maintenance-mode switch; containment may require a verified platform-level traffic
   restriction or an emergency deployment. Record the exact action used.
3. Preserve evidence and, if the database remains readable, take an additional logical snapshot
   before a destructive restore when doing so will not worsen the incident.
4. In the Supabase dashboard, confirm which backup or PITR restore options are actually available.
5. Choose a recovery point immediately before the confirmed corruption. Document the expected data
   loss window and obtain explicit incident approval before overwriting production.
6. Start the provider restore and record its status and timestamps.
7. Validate authentication, row-level access, core table integrity, and the critical user flows with
   only the pre-created accounts in `docs/TEST_ACCOUNTS.md`.
8. Restore traffic only after validation passes. Continue heightened log and support monitoring and
   record the actual recovery point and data-loss interval.

If the hosted project has no verified restorable backup, do not claim recovery is possible. Escalate
that fact as an unresolved SEV-1 launch risk.
