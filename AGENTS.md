# Codex Code Review Instructions

You are reviewing a QA management application.

Your primary goal is to detect real bugs, regressions, security issues,
data integrity problems, and incorrect QA workflow behavior.

Do not focus on cosmetic style issues unless they can cause bugs,
maintenance problems, or inconsistent behavior.

## Review priorities

Prioritize findings in this order:

1. Data loss or corruption
2. Authorization / permission bypass
3. Broken business logic
4. Incorrect state transitions
5. API contract regressions
6. Database consistency problems
7. Concurrency and race conditions
8. Incorrect error handling
9. Broken UI/backend integration
10. Missing or insufficient tests

Do not report minor formatting, naming, or stylistic preferences unless
they introduce ambiguity or a realistic defect.

---

# Architecture

The application contains concepts such as:

- Project
- Test Plan
- Test Run
- Test Case
- Test Step
- Step Run Result
- users and access control
- project/document access
- revision-based mutations

When reviewing changes, verify that relationships between these entities
remain consistent.

Pay special attention to nested Prisma reads/writes and cascading changes.

---

# Test Run rules

Test Run behavior is business-critical.

Check carefully for bugs involving:

- starting a run
- completing a run
- cancelling a run
- overriding a run
- starting child runs
- updating step results
- calculating run status
- calculating test case status
- progress counters
- parent/child TestPlan context
- revision handling

A Test Run mutation must not leave the run in a partially updated or
internally inconsistent state.

For mutations involving several dependent database operations, verify
whether a transaction is required.

Do not recommend transactions for read-only operations unless they are
actually necessary for correctness.

Read-only UI GET requests should generally avoid long interactive
transactions.

---

# Concurrency

Look for race conditions.

Pay special attention to:

- simultaneous StepRunResult updates
- completing/cancelling the same run concurrently
- stale revision updates
- duplicated child runs
- repeated requests
- retry behavior

Mutations using revision/version checks must reject stale updates rather
than silently overwriting newer data.

Operations that require strong consistency should use an appropriate
transaction/isolation strategy.

---

# Database / Prisma

For Prisma changes check for:

- accidental N+1 queries
- unnecessarily large nested includes
- long-running interactive transactions
- missing indexes for frequently filtered fields
- incorrect relation handling
- orphan records
- nullable fields used as non-null
- uniqueness assumptions that are not enforced
- incorrect cascade behavior

Flag cases where a failed intermediate database operation could leave
persistent data partially modified.

Do not suggest an interactive transaction merely to obtain a consistent
snapshot for ordinary UI reads unless the code genuinely requires it.

---

# Authorization

Every server operation that reads or modifies project data must preserve
the existing authorization model.

Check:

- projectAccess
- documentAccess
- runAccess
- currentActor

Never assume that authorization enforced only by the UI is sufficient.

Flag any endpoint/service method where a user could access or modify an
entity by supplying an ID belonging to another project or document.

Pay special attention to IDOR-style vulnerabilities.

---

# API behavior

For API/server changes verify:

- HTTP status codes are appropriate
- validation errors are distinguishable from server errors
- malformed input is rejected
- optional fields are handled correctly
- old clients are not unintentionally broken
- response shape remains compatible where required

Do not expose internal errors, database details, secrets, tokens, stack
traces, or sensitive user data in API responses.

---

# Input validation

Check boundary values and unusual inputs.

Examples:

- empty strings
- null / undefined
- zero
- negative values
- extremely large values
- malformed UUIDs / IDs
- duplicated IDs
- invalid enum values
- empty arrays
- very large arrays
- invalid dates
- start date after end date

Do not rely exclusively on TypeScript types for runtime validation.

---

# Frontend / UI

When frontend code changes, verify:

- loading state
- empty state
- error state
- disabled state
- double-click / repeated submit behavior
- optimistic updates
- rollback after request failure
- stale data after mutation
- refresh behavior
- navigation after create/update/delete
- race conditions caused by multiple requests

Check that UI permissions match backend permissions.

Do not report purely visual differences unless they affect usability,
accessibility, or application behavior.

---

# Error handling

Never silently swallow errors.

Flag:

- empty catch blocks
- catch blocks that hide failed operations
- promises that are not awaited where required
- errors converted into successful responses
- mutations that continue after a failed prerequisite

Error handling must not expose secrets or sensitive internal information.

---

# Security

Report concrete security issues such as:

- authorization bypass
- IDOR
- injection
- XSS
- unsafe HTML rendering
- CSRF problems
- secrets committed to the repository
- credentials/tokens in logs
- insecure direct database access
- path traversal
- unsafe file upload handling

Avoid speculative security warnings without a realistic attack path.

---

# Tests

For bug fixes, check whether the regression is covered by a test.

For new business logic, expect tests for:

- happy path
- important negative path
- boundary conditions
- permission failures
- relevant concurrency/state-transition cases

A test should verify behavior, not implementation details.

Do not require tests for trivial cosmetic changes.

---

# Review quality

Only report issues that are actionable and supported by the code.

Before reporting a finding:

1. Trace the relevant execution path.
2. Check nearby code and callers.
3. Determine whether an existing validation or invariant already handles it.
4. Confirm that the issue can realistically occur.
5. Explain the user/business impact.

Avoid speculative findings.

Prefer fewer high-confidence findings over many low-value comments.

Each finding should explain:

- what is wrong
- under what conditions it occurs
- what the impact is
- where the problem is located
- how it can be reproduced or reasoned about

Do not propose large refactors unless they are necessary to fix the issue.

---

# Severity

Treat these as high severity:

- data loss
- cross-project unauthorized access
- corrupted Test Run results
- impossible Test Run state
- payment/security credential exposure
- mutations succeeding partially
- production-breaking API regression

Treat these as medium severity:

- reproducible incorrect behavior
- missing validation causing incorrect data
- broken error handling
- stale UI state with meaningful impact
- significant performance regression

Do not report purely subjective style preferences as defects.

---

# Commands

Before concluding that a change is safe, use relevant project checks when
available.

Typical checks may include:

npm run lint
npm run typecheck
npm test
npm run build

Use the actual scripts defined in package.json rather than assuming that
all commands exist.

If tests cannot be executed, do not claim that they passed.
