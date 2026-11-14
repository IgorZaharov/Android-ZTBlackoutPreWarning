# docs/ios — iOS port package

| File | Purpose |
|---|---|
| [IOS_PORT_PLAN.md](IOS_PORT_PLAN.md) | **Current plan** (2026-11-14): owner decisions (CI-built, monorepo, no roulette, iOS 17+), Liquid Glass design system with fallback, App Review hardening, milestones M0 to M8, what the owner provides |
| [IOS_HANDOVER_v1.4.0.md](IOS_HANDOVER_v1.4.0.md) | 1.4.0 summary, 3-way file mapping (web, Kotlin, Swift), corrected facts, iOS constraints, exact uk/en strings, milestones M0 to M6, decision gates, bootstrap prompt (section 10) |

The contract is [`../../spec/`](../../spec/README.md) and its golden vectors in `spec/vectors/`. This package replaces the iOS parts of the root `IOS_HANDOVER.md` and `ANDROID_UPDATE_SPEC.md`, which contain wrong REM ids, a wrong App Group id and a wrong source layout.

Status: milestone M0 (documents only). The iOS code lives in `https://github.com/IgorZaharov/iOS-ZTPreBlackoutNotification`; nothing in this folder changes it.
