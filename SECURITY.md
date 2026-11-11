# Security Policy - VoiceGroceries

This document outlines the security policies, credential protection guidelines, and authentication standards for VoiceGroceries.

---

## 1. Credential Protection & Git Safety

* **Zero Secrets in Version Control**:
  * Real API keys, Client Secrets, and database credentials must never be committed to Git.
  * The `.gitignore` file explicitly enforces exclusions for:
    ```gitignore
    .env*
    !.env.example
    *.db
    *.sqlite
    /data/
    ```
* **Template Guidance**:
  * Only `.env.example` is committed to GitHub, containing dummy placeholders (`your_kroger_client_id_here`).
* **Diagnostic Script Masking**:
  * The local verification tool (`scripts/test-kroger.mjs`) reads keys via local environment variables and always masks output (e.g. `groc••••••••`), ensuring secrets are never echoed to console logs or shared with AI assistants.

---

## 2. Kroger OAuth2 & Token Storage

* **Customer Access Tokens**:
  * Customer OAuth tokens are stored exclusively in secure, `httpOnly`, `sameSite=lax` cookies to protect against client-side Cross-Site Scripting (XSS) extraction.
* **Separation of Privileges**:
  * Public product catalog searches and location lookups use read-only Client Credentials (`product.compact`).
  * Customer cart additions (`PUT /v1/cart/add`) strictly require explicit customer OAuth consent with `cart.basic:write`.

---

## 3. Browser Microphone Security Context

* **Secure Context Requirement**:
  * The Web Speech Recognition API (`SpeechRecognition` / `webkitSpeechRecognition`) is restricted by modern web browsers (Chrome, Safari, Edge) to **Secure Contexts** (`localhost`, `127.0.0.1`, or `https://`).
  * When running on mobile devices over local Wi-Fi, browsers require an encrypted HTTPS origin to grant microphone access.
* **Cross-Origin Development Protections**:
  * Next.js dev server resources (`/_next/hmr`) are protected by explicit `allowedDevOrigins` configuration to prevent unauthorized cross-origin script injection.

---

## 4. Reporting a Vulnerability

If you discover a potential security vulnerability in this repository, please report it privately:
* Open an issue with the label `security` without including raw credentials or sensitive payloads.
* Or contact the repository maintainer directly via GitHub.
