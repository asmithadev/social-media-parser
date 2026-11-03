# Social Media Evidence Capture and Documentation Tool

A tool that automatically captures and documents the social media accounts of an accused or suspect during an investigation, so examiners don't have to take and organise screenshots by hand.

Built for the National Investigation Agency (NIA), Anti-Cyber Terrorism Division. Problem statement year: 2024. Category: Software (Miscellaneous).

---

## What the project is

When investigators examine a suspect's social media accounts and write up a panchnama, they currently open each account and take screenshots by hand. That is slow, easy to get wrong, and hard to review later. Pages get missed, screenshots end up out of order, and nobody can prove a file wasn't changed afterwards.

This project is a software tool that does the capture for them. The examiner logs in to the account on the platform's own screen, and the tool walks through the account, takes the screenshots, and puts everything into a documented report that can be printed.

Some accounts refuse to open on a desktop even with the right credentials, and examiners end up using a spare phone. So the tool comes in two versions: one for **macOS** and one for **iOS**, both feeding the same backend.

## What the project is supposed to do

- Let an examiner pick a case, a suspect and one of the suspect's accounts, then choose the platform (Facebook, Twitter, Instagram, Telegram, WhatsApp or a Google account).
- Capture each part of the account in a fixed order: account info, posts, messages, timeline, friend list, followers and following.
- Save every screenshot with a SHA-256 hash, a sequence number and a timestamp, so any later change to the file can be detected.
- Read the text and details out of the screenshots and store them so they can be searched and reviewed.
- Produce a printable report in a documented form, with the panchnama number, witnesses and file hashes included.
- Let a reviewer approve the report, and keep a log of who did what.
- Flag any section that could not be captured instead of silently skipping it.

What it deliberately does **not** do: post, send, like or delete anything on the examined account, store passwords or OTPs, or bypass two-factor or platform security. It is read-only, and it is meant to be used only on accounts the agency is legally allowed to examine.

## Modules and features

| Module | What it does |
|---|---|
| Login and roles | Accounts for admins, examiners and reviewers. What you can do depends on your role. |
| Case and suspect management | Create cases and assign examiners. A suspect is stored once and can be linked to several ongoing cases. |
| Social account registry | Records each account (platform, handle, permanent account ID, profile link) against the suspect. Platforms and their capture sections are kept as data, so adding a platform doesn't need a schema change. |
| Panchnama and capture sessions | A panchnama holds the number, place, time, legal authority reference and witnesses. Each account examined in that sitting is one capture session, on a macOS or iOS device. |
| Capture engine | **macOS version:** opens the platform in a controlled browser session and captures section by section. **iOS version:** drives a dummy iPhone connected to the Mac and captures from the official app. |
| Parsing | Reads text out of the screenshots and stores the parsed data (posts, messages, friends and so on) in MongoDB, since the shape differs by platform. |
| Evidence integrity | SHA-256 hash on every screenshot and report. Files are never overwritten; a recapture is saved as a new item. |
| Report generation | Builds the documented PDF report. Reports are versioned, and a reviewer must approve one before it is final. |
| Audit trail | An append-only log of logins, captures, report generation, approvals and prints, with each entry chained to the previous one so tampering shows up. |

## What our team is building

We are building this for the project evaluation, in phases.

**Phase 1 (design) covers:**
- ER diagram: 14 PostgreSQL tables and 1 MongoDB collection
- Data flow diagram
- Technology stack

**Planned tech stack**

| Layer | Choice |
|---|---|
| Frontend | React, Tailwind CSS |
| Backend | Node.js, Express |
| Databases | PostgreSQL (structured records), MongoDB (parsed content) |
| macOS version | Electron, Playwright |
| iOS version | Appium with XCUITest, driven from the Mac |
| OCR and parsing | Python (Tesseract, OpenCV, NumPy) |
| Reports | Puppeteer (HTML to PDF) |
| Version control | Git, GitHub, GitHub Actions |

AI features (Gemini or OpenAI APIs, embeddings for search) are optional and off by default, because sending evidence to an outside service would take it out of the agency's network.

**Status:** design phase. Nothing here is implemented yet; the stack above is the plan, not a finished build.

---

## Repository contents

- `README.md`: this file
- ER diagram, data flow diagram and tech stack document for Phase 1