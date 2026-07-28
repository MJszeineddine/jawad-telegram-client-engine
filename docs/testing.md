# Testing Strategy

The local `npm run qa` gate covers deterministic domain rules, state transitions, capacity, referral links, attachment limits, rate/safety primitives, Mini App signature validation, payment mismatches, transaction reuse, watcher ambiguity, expiry, complete mock intake-to-paid flow, static build validation, secret scanning, and repository checks.

Production CI additionally installs pnpm dependencies, builds Next.js, runs package audit, starts PostgreSQL/Redis, applies migrations, and executes browser accessibility/mobile tests when registry and container access are available.

No fixture represents a real client, real payment, or testimonial.
