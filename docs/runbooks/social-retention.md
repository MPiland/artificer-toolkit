# Social Hub retention

Run this monthly during the beta. It does not require a queue or scheduler.

1. Set `DATABASE_CONNECTION_STRING` for the intended environment.
2. Run `yarn social:retention`. This is always a dry run and prints counts only.
3. Review the four counts and confirm the target environment independently.
4. Set `CONFIRM_SOCIAL_RETENTION_PURGE=purge-expired-social-data` and run
   `yarn social:retention --apply`.
5. Run the dry run again; every reported count should be zero.

The command removes terminal invitations after 180 days. It removes terminal applications after
180 days, except an accepted application whose Campaign membership is still active; after that
membership ends, its expectations snapshot remains for a further 180 days. Resolved report evidence
and its audit actions remain for two years. Obsolete rate-limit windows are cleared. Blocks are never
removed by this command.

The command is idempotent and transactional. It prints counts, not row contents, account identifiers,
application messages, evidence, connection strings, or credentials.
