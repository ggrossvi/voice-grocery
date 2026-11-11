# Architecture Decision Records (ADR) - VoiceGroceries

This document records the architectural and engineering decisions made during the design and implementation of VoiceGroceries.

---

## ADR 001: Mobile Progressive Web App (PWA) vs. Native App
* **Status**: Accepted
* **Context**: The app must work seamlessly on both Android and Apple iOS devices, be voice-enabled, and launch easily from a phone.
* **Decision**: Build as a mobile-first Progressive Web App (PWA) using Next.js, HTML5 Web Speech API, and standard Web App Manifest (`manifest.json`).
* **Consequences**:
  * Cross-platform: Single codebase runs on Android Chrome and Apple iOS Safari.
  * Instant 1-tap installation to the home screen without app store approval friction.
  * Runs full-screen (`display: standalone`) with custom touch icons and dark theme colors.

---

## ADR 002: Local "Usual Items" Staples Memory Engine
* **Status**: Accepted
* **Context**: Kroger's public developer API does not expose historical receipts or past customer orders due to consumer data privacy regulations.
* **Decision**: Implement a local "Staples & Usuals Memory" database that auto-learns preferences.
* **Consequences**:
  * Solves the missing Kroger past purchases endpoint by tracking usual items locally (`spokenKeyword`, `krogerUpc`, `orderCount`, `lastOrderedAt`).
  * Instant fuzzy matching: Saying *"milk"* immediately suggests the customer's favorite brand and package size.
  * Seamless evolution: Started with local persistent JSON, transitioning to SQLite via Prisma.

---

## ADR 003: Store Identification & Default Location (QFC Crown Hill)
* **Status**: Accepted
* **Context**: Grocery inventory, prices, and aisle stock vary by specific store. Kroger Co. owns multiple retail chains (Kroger, QFC, Fred Meyer, Ralphs, King Soopers) sharing one API.
* **Decision**: Support store lookup via 50-mile radius GPS/Zip code search, support conversational store selection (*"My home store is QFC Crown Hill"*), and set **QFC Crown Hill (`70500872`)** as the primary default.
* **Consequences**:
  * Product queries automatically reflect the user's home store pricing and real shelf inventory.
  * Crown Hill Holman Road QFC is directly recognized by neighborhood name.

---

## ADR 004: Dual-Tier Kroger Authentication
* **Status**: Accepted
* **Context**: The app needs to search products quickly without login barriers, but requires authenticated customer consent to write to an actual shopping cart.
* **Decision**:
  1. **Client Credentials Grant**: Used automatically by the backend to query Kroger's live Product and Location APIs with no user login required.
  2. **Customer Authorization Code Grant (`cart.basic:write`)**: Used when the customer connects their Kroger/QFC account to add items directly to their real cart.
* **Consequences**:
  * Instant browsing and searching with zero friction.
  * Secure, authorized cart modifications complying with Kroger developer policies.

---

## ADR 005: Universal Wake-Word Webhook for "Hey Google" & "Hey Siri"
* **Status**: Accepted
* **Context**: Users want hands-free voice access using native device wake words (*"Hey Google"* on Android, *"Hey Siri"* on iPhone).
* **Decision**: Create a unified webhook endpoint (`/api/assistant/webhook`) compatible with Google Assistant Routines and Apple Siri Shortcuts.
* **Consequences**:
  * Allows hands-free grocery additions from Android phones, iPhones, Apple Watches, AirPods, and Google speakers.
  * Zero third-party cloud AI agent costs or complex Dialogflow setup.

---

## ADR 006: Vanilla CSS Design System over TailwindCSS
* **Status**: Accepted
* **Context**: The user interface needs to feel modern, vibrant, and responsive with glowing voice pulse animations, while keeping code maintainable and flexible.
* **Decision**: Use pure Vanilla CSS with curated CSS custom properties (tokens), glassmorphism effects, and CSS keyframe animations.
* **Consequences**:
  * Zero CSS compiler build overhead.
  * Custom soundwave and radar pulse visualizer animations.
  * Native safe-area insets (`env(safe-area-inset-top)`) for mobile phone notches.

---

## ADR 007: Automated Unit Testing via Vitest
* **Status**: Accepted
* **Context**: Ensure that intent parsing, staples memory, store lookups, and Kroger API mappings never break before pushing to main on GitHub.
* **Decision**: Use Vitest for fast, native TypeScript unit testing.
* **Consequences**:
  * Fast test execution running in milliseconds.
  * High test coverage for core business logic without mocking entire browsers.
