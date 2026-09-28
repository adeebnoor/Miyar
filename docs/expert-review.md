# Expert review trial

Entry page: `/review.html`. This is a separate, optional trial of strategic
objective analysis. It requires no organization account and never grants access
to organization routes, users, positions, approvals or uploaded reference data.
The existing organization API still requires its original authenticated roles.

The operator must set both `MIYAR_ENABLE_EXPERT_REVIEW=true` and an explicit
timezone-aware ISO timestamp in `MIYAR_EXPERT_REVIEW_EXPIRES_AT`. It fails closed
when either setting is missing, malformed or expired. Disable the flag to end
the trial early. Nothing changes the billing plan or provider credentials.

Each request requires explicit external-processing consent. Inputs are limited
to 2,500 objective characters and 1,000 constraint characters. The same real
strategic pipeline and its global concurrency limit are used, but only with the
bundled public reference catalog, never an organization's custom release.

Quota reservations are committed before provider calls: at most 60 attempts per
UTC day overall and 12 per source network per UTC hour, with a 20-second minimum
interval per network. A PostgreSQL global row lock serializes reservations.
Failed provider attempts count toward the limits. Restarts do not reset quotas.
Only counters and keyed hashes of network addresses are stored; request text,
model output, evaluations and raw network addresses are not stored by this trial.
Google receives the consented text; its account terms still apply.

Reviewers can download their current example, result and evaluation locally.
The trial is for role design, not decisions about employees. Matching coverage
is the five original engineering objective examples. Generated titles and codes
remain proposals requiring professional review; low similarity is not proof
that a role is new or lacks a code in the complete occupation directory.
