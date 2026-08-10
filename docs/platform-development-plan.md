# Seawave Forwarding \& Logistics — Platform Development Plan

**Prepared for:** Seawave Forwarding \& Logistics Pvt. Ltd.
**Document type:** Master technical and staged execution plan
**Scope:** Full freight forwarding import/export management platform, built via Claude Code

This document is the master reference for building Seawave's freight forwarding platform end to end — the design system, technology stack, file structure, role and field-level access control, the logical data-entry flow for every step in the original process document, a bulk Excel/Sheets migration module, the staged development plan with failover procedures, and a ready-to-use Claude Code prompt for every stage.

\---

## 1\. Executive Summary

The platform is being built for a **single company, multiple branches** structure, covering the full Enquiry → Quotation → Job → Workflow → Delivery lifecycle for both Import and Export freight forwarding, customs clearance, and transportation services, as defined in the original process document — and is intended as the **single system of record**, replacing spreadsheets entirely for day-to-day operations.

\---

## 2\. Design System

### 2.1 Brand foundation

Colors extracted from the Seawave logo:

|Token|Hex|Usage|
|-|-|-|
|`--brand-teal`|`#2FA8B5`|Primary accent — completed states, primary nav highlight, links|
|`--brand-plum`|`#9B4A82`|Secondary accent — active/in-progress states, secondary CTAs|
|`--bg-offwhite`|`#F7F4EF`|App background (all screens)|
|`--surface-white`|`#FFFFFF`|Cards, panels, tables|
|`--border-subtle`|`#E5E1D8`|Hairline borders on off-white|
|`--text-primary`|`#2B2A26`|Primary text (warm charcoal, not pure black)|
|`--text-secondary`|`#8A8578`|Secondary/muted text|
|`--text-tertiary`|`#A6A192`|Placeholder, timestamps, disabled|
|`--status-success`|`#1B6B74` (on `#DCEFF1` bg)|Delivered / completed badges|
|`--status-warning`|Amber (standard)|Pending action / delayed|
|`--status-danger`|Red (standard)|Exception / customs hold / overdue|

**Rule:** Teal = completed / positive progress. Plum = active / in-progress / needs attention. Gray = pending / not started.

### 2.2 Layout structure

**Global shell:** Left sidebar (Dashboard, Enquiries, Quotations, Jobs \[Import/Export], Customers, Documents, Reports, Accounts, Data Import, Settings), top bar (search, notifications, branch selector, profile). One accent-filled primary CTA per screen.

**Dashboard:** Stat cards (Total/Ongoing/Pending Jobs, Revenue), revenue bar chart, on-time vs delayed donut, ongoing jobs list + jobs table.

**Job detail:** Two-pane layout — left: searchable job activity list; right top: vertical step-tracker (or live map for Transportation jobs); right bottom: job summary with horizontal progress bar. See Section 4 for exactly which fields on this screen are visible/editable per role.

### 2.3 Data entry philosophy (replacing Excel/Sheets)

* **No screen requires leaving the platform to track a job.** Every field currently tracked in Excel must have a home in the schema — cross-checked against sample sheets during build.
* **Standard forms, not spreadsheet grids.** Line-item sections (containers, charges, packages) use structured add/edit rows within a form, so validation and permissions can be enforced per field.
* **Every mandatory field from the original process document is a required field in the form.**
* **Autosave on every form** — no lost data on browser crash/network drop.

\---

## 3\. Technology Stack

|Layer|Choice|Rationale|
|-|-|-|
|Frontend|Next.js 14+ (App Router), React, TypeScript|Best fit for Vercel hosting, SSR for dashboards|
|Backend|Next.js API routes / Route Handlers (Node.js)|Single deployable unit on Vercel|
|Database|PostgreSQL via **Neon**|Free-tier friendly, branching for safe migration testing|
|ORM|Prisma|Type-safe schema, easy migrations per stage|
|Auth|NextAuth.js (Auth.js) with role + field-permission claims|Supports 6 roles and the field-level permission model in Section 4|
|File storage|Vercel Blob|HBL/MBL/Invoice PDFs, KYC docs, imported Excel source files|
|Styling|Tailwind CSS + shared token file|Matches brand tokens directly|
|PDF generation|`@react-pdf/renderer` / Puppeteer (decided Stage 7)|HBL, MBL, Freight Certificate, Invoices|
|Bulk import|`xlsx`/SheetJS parsing + column-mapping UI + Prisma batch inserts|Powers the Excel migration wizard|
|Hosting|Vercel|As requested|
|Background jobs|Vercel Cron + Upstash (free tier)|Notifications, scheduled reports|
|Email|Resend (free tier)|Notifications, quotation delivery|

\---

## 4\. Roles \& Permissions

### 4.1 Role summary

|Role|Primary responsibility|
|-|-|
|**Admin**|Full system access, user/branch management, permission configuration|
|**Branch Manager**|Oversees branch activity; approves quotations, drafts HBL, workflow overrides - Mumbai, Kolkata, Surat, Jogbani, Raxaul, Sounali, Chennai|
|**Doer / Ops Executive**|Enquiry entry, job creation, workflow step updates, document upload|
|**Sales / Enquiry team**|Enquiry capture, customer relationship, quotation drafting|
|**Accounts / Finance**|Charges, billing, invoices, payment status, duty payment tracking|
|**Customer (portal)**|View-only, limited to their own organization's jobs, documents, quotation status|

### Required CXO Dashboard - on screen (YTD, MTD, WTD - with download option into markdown PDF full screen capture)

job creation, timely delivery, revenue generation, overview of all actions in terms of MTD, YTD format - can select custom date range

### 

### 4.2 Screen-level access matrix

|Screen|Admin|Branch Mgr|Doer|Sales|Accounts|Customer|
|-|-|-|-|-|-|-|
|Dashboard|Full|Branch-scoped|Branch-scoped|Branch-scoped|Branch-scoped, financial view|Own org only|
|Customers (Organizations)|Full|Edit|View + create|Create/Edit|View|Own profile, view only|
|Enquiries|Full|Edit/Approve|Create/Edit|Create/Edit|View|No access|
|Quotations|Full|Edit/Approve|View|Create/Edit|View charges|Own quotations, view only|
|Jobs — Import/Export|Full|Edit/Override|Create/Edit workflow steps|View|View + edit billing sections|Own jobs, view only|
|Documents|Full|Approve/View|Upload/View|View (non-financial)|Upload/View (financial docs)|View shared docs only|
|Data Import (bulk migration)|Full|No access|No access|No access|No access|No access|
|Reports|Full|Branch-scoped|No access|Own enquiries/quotations only|Full financial reports|No access|
|Settings|Full|Branch settings only|No access|No access|No access|No access|

### 4.3 Field-level permissions — Job detail screen

|Section / field group|Admin|Branch Mgr|Doer|Sales|Accounts|Customer|
|-|-|-|-|-|-|-|
|Shipper / Consignee / Notify Party details|Edit|Edit|Edit|View|View|View|
|Port / vessel / container details|Edit|Edit|Edit|View|View|View (summary only)|
|Workflow step status \& dates|Edit|Edit/Override|Edit|View|View|View (their job's tracker only)|
|Freight / Customs / Transport charges|Edit|Edit|View|View (quoted amount only)|Edit|View (final invoice total only)|
|Duty payment details (own vs consignee account)|Edit|Edit|View|No access|Edit|View (if their liability)|
|Internal notes / audit trail|Edit|Edit|Edit (own entries)|No access|No access|No access|
|Documents (HBL/MBL/DO)|Edit|Approve|Upload|View (non-financial docs)|Upload (invoices)|View (shared docs only)|

Enforced server-side (not just UI-hidden) via a field-permission check in the API layer, so a role without access cannot retrieve restricted fields even via direct API calls.

\---

## 5\. Logical Data-Entry Flow

### 5.1 Organization creation (prerequisite, one-time per customer)

1. Sales or Doer searches the Customer directory before creating anything new.
2. If new: Sales enters Customer Name, Contact Person Details, Company KYC (GST/PAN/TDS).
3. Validation: GST format checked; duplicate GST number blocked with a warning pointing to the existing record.
4. On save, organization becomes selectable in the Enquiry form. No approval gate at this step.

### 5.2 Enquiry capturing

1. Sales or Doer starts a new Enquiry, selects Branch, Customer, Contact Person, Mobile, Email.
2. Selects Shipment Type (Import/Export) — determines which workflow track becomes available later.
3. Selects Type of Service (Freight Forwarding / Customs Clearance / Transportation / Warehousing / Exim Consultancy) — drives which conditional detail section appears next.
4. Enters RFQ reason and the relevant conditional fields.
5. Validation: required fields depend on the selected Service Type.
6. On submit, Enquiry status becomes "Open" and appears on the Sales/Doer dashboard and the Branch Manager's review queue.
7. Branch Manager reviews and marks it "Ready for Quotation" or flags it back for correction — the first approval gate.

### 5.3 Quotation

1. Sales builds a Quotation against a "Ready for Quotation" Enquiry: Freight Charges, Customs Clearance Charges, Transportation Charges, Reimbursement Charges as line items.
2. Branch Manager reviews and approves before it can be marked "Sent."
3. Quotation is generated as a PDF.
4. Customer approval recorded manually by Sales (checkbox + note field).
5. On approval, one click converts the Quotation into a Job — Job Creation auto-inherits every field already captured.

### 5.4 Consignment / Job creation

1. Doer completes fields not inherited from the Quotation: Shipper/Consignee/Notify Party details, Agent, Place of Receipt, POL, POD, Place of Delivery, Shipping Line, CFS, Vessel/Voyage, Free Days at POD, container count/type, weights, packages, CBM.
2. Validation: field set differs for Import vs Export, adapting automatically based on the Shipment Type chosen at Enquiry stage.
3. Branch Manager does a final review before the Job is locked into a workflow track — Incoterm selection determines which workflow template attaches.
4. Job appears on the branch Job dashboard with status "Workflow in progress."

### 5.5 Import workflow — Ex-Works track

Entered by Doer, with Branch Manager override/approval on flagged steps (\*):

1. ETD from POL
2. SO Details
3. Container Pickup Date
4. Cargo Loading Date
5. Draft HBL Checking \& Approval\* (Branch Manager approves)
6. Handover at Port
7. On-Board HBL Details
8. Vessel Sail Date
9. MBL Details
10. Freight Certificate Preparation\* (Accounts verifies figures before complete)
11. ETA to discharge port
12. IGM Status
13. Bill Preparation (Accounts enters directly)
14. Delivery Order Release
15. Customs Clearance Status
16. Delivery Date
17. Delivered Status — triggers final notification to Sales and Accounts

### 5.6 Import workflow — FOB track

Same data owners as 5.5: ETD from POL, SO Details, Cargo Loading Date (no separate pickup step), Draft HBL Checking \& Approval\*, Handover at Port, On-Board HBL, Vessel Sail Date, MBL Details, Freight Certificate Preparation\*, ETA, IGM Status, Bill Preparation, Delivery Order Release, Customs Clearance Status, Delivery Date, Delivered Status.

### 5.7 Export workflow — CIF / DDP / DDU tracks

Shared steps (Doer, Branch Manager approval on BL Release\*): Booking Confirmation, Vessel Cutoff Details, SI Filing, Form-13 Approval, Empty Yard Amendment (if required), BL Type selection, BL Release\*, Bill Preparation (Accounts), ETA to POD.

Divergent by Incoterm:

* **CIF:** Customs Clearance handled by Seawave; standard Delivery Order \& Delivery.
* **DDP:** Duty Payment tracked and paid by Seawave on the Customer's behalf — Accounts owns this field; Customer sees only the final landed cost.
* **DDU:** Duty Payment is the Consignee's responsibility — Accounts tracks for reconciliation only.

### 5.8 Export sub-type — Dock Stuffing vs Factory Stuffing

* **Dock Stuffing:** Pickup from Shipper Factory → Vehicle arrival \& unload at CFS → Empty Container Pickup Instruction to CFS → Customs Clearance at CFS → Stuffing at CFS → Instruction to CFS for Movement.
* **Factory Stuffing:** Empty container pickup per Gate Opening Date → Stuffing at Plant → Customs Clearance → Handover at Port.

Both write into the same job workflow progress structure as the main Export track, running in parallel with the main sequence.

\---

## 6\. Bulk Data Migration (Excel/Google Sheets Import Wizard)

Admin-only access, to keep migration controlled.

1. Admin uploads an Excel/CSV export from the existing sheet(s).
2. The system parses column headers and presents a mapping screen — each source column matched to a platform field, with automatic suggestions based on header text similarity.
3. A validation pass flags rows with missing required fields, malformed GST numbers, duplicate customers, or ambiguous Incoterms.
4. Admin imports valid rows only, or fixes and reimports flagged rows.
5. Import runs as a background job; Admin gets a completion summary and a downloadable error log.
6. Every import run is logged (file name, uploaded by, row counts, timestamp) for traceability.

Built in Stage 1, extended in Stage 4 to support historical/open Jobs.

\---

## 7\. Repository \& File Structure

```
seawave-platform/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   ├── (dashboard)/
│   │   │   ├── dashboard/
│   │   │   ├── enquiries/
│   │   │   ├── quotations/
│   │   │   ├── jobs/
│   │   │   │   ├── import/
│   │   │   │   └── export/
│   │   │   ├── customers/
│   │   │   ├── documents/
│   │   │   ├── reports/
│   │   │   ├── accounts/
│   │   │   ├── data-import/
│   │   │   └── settings/
│   │   ├── (customer-portal)/
│   │   └── api/
│   │       ├── auth/
│   │       ├── enquiries/
│   │       ├── quotations/
│   │       ├── jobs/
│   │       ├── documents/
│   │       ├── data-import/
│   │       ├── integrations/
│   │       └── webhooks/
│   ├── components/
│   │   ├── ui/
│   │   ├── workflow/
│   │   └── layout/
│   ├── lib/
│   │   ├── auth/
│   │   ├── permissions/
│   │   ├── db/
│   │   ├── integrations/
│   │   ├── import/
│   │   └── validation/
│   ├── styles/
│   │   └── tokens.css
│   └── types/
├── tests/
├── docs/
│   └── stage-checklists/
├── .env.example
└── README.md
```

`lib/permissions/` is central: every API route checks both role and, for the Job entity, field group, against the matrix in Section 4.3.

`docs/stage-checklists/` holds one short markdown file per completed stage, summarizing what was built and confirming acceptance criteria — this is what keeps later-stage prompts cheap to run (see Section 9).

\---

## 8\. Staged Development Plan

### Stage 0 — Foundation \& Design System

**Scope:** Repo setup, Next.js + Prisma + Neon wiring, Auth.js with 6 roles and field-permission scaffolding, shared component library, base layout shell.
**DB changes:** `User`, `Role`, `Branch`, `Session`, `FieldPermission`.
**Acceptance criteria:** Each role sees only its permitted sidebar items; a test API call confirms field-level restriction works.
**Failover:** Tag a release before Stage 1. Local Docker Postgres fallback if Neon has issues.

### Stage 1 — Master Data + Bulk Import Wizard

**Scope:** Organization/KYC, Branch management, User management, Customer directory, and the Excel/Sheets bulk import wizard.
**DB changes:** `Organization`, `KycDetail`, `ImportBatch`, `ImportRowError`.
**Acceptance criteria:** A sample Excel sheet of \~200 dummy customer rows imports correctly with the mapping UI, flags broken rows, produces a downloadable error report.
**Failover:** Soft deletes only. Import runs transactional per batch — a failed batch rolls back entirely with a full error log for retry.

### Stage 2 — Enquiry Capturing

**Scope:** Enquiry form matching Section 5.2's flow, including the Branch Manager review gate.
**DB changes:** `Enquiry`, `EnquiryFreightDetail`, `EnquiryCustomsDetail`, `EnquiryTransportDetail`.
**Acceptance criteria:** All Service Type combinations capture the right conditional fields; review queue works; draft autosave confirmed.
**Failover:** Autosave debounced writes prevent data loss; instant rollback for bad deploys.

### Stage 3 — Quotation Module

**Scope:** Quotation builder with four charge categories as line items, Branch Manager approval gate, versioning, PDF generation, one-click Job conversion.
**DB changes:** `Quotation`, `QuotationLineItem`, `QuotationVersion`, `QuotationStatus`.
**Acceptance criteria:** Section 5.3's flow works end-to-end including the approval gate; converted Job inherits 100% of quotation data.
**Failover:** Versioning preserves history; PDF failure falls back to HTML preview.

### Stage 4 — Consignment / Job Creation + Historical Job Import

**Scope:** Full Job entity per Section 5.4, plus extending the import wizard to support historical/open Job migration.
**DB changes:** `Job`, `ShipperDetail`, `ConsigneeDetail`, `NotifyPartyDetail`, `ContainerDetail`; extend `ImportBatch` for Job-type imports.
**Acceptance criteria:** Jobs created from Quotations retain all data with zero re-entry; a batch of historical Jobs imports correctly with mapped workflow status.
**Failover:** All Job writes wrapped in a single DB transaction across related detail tables.

### Stage 5 — Import Workflow Engine

**Scope:** Ex-Works and FOB tracks per Sections 5.5–5.6, including step ownership split and approval gates.
**DB changes:** `WorkflowTemplate`, `WorkflowStep`, `JobWorkflowProgress`, `JobAuditLog`.
**Acceptance criteria:** Correct step sequence per track; step ownership enforced; approval gates block progression until approved.
**Failover:** Workflow templates are data, not code — corrections are admin-screen edits. Append-only audit log for full history.

### Stage 6 — Export Workflow Engine

**Scope:** CIF/DDP/DDU tracks per Section 5.7, plus Dock Stuffing/Factory Stuffing sub-flows, including duty-payment field-level visibility.
**DB changes:** Extends `WorkflowTemplate`/`WorkflowStep` — no new core tables.
**Acceptance criteria:** All three Incoterm tracks render correctly with duty-payment field restricted per the permission matrix; both stuffing sub-types log correctly.
**Failover:** Regression tests against Stage 5 workflows before marking complete; rollback if an issue surfaces.

### Stage 7 — Document Generation \& Management

**Scope:** HBL, MBL, Freight Certificate, Delivery Order, Invoices — generated and permission-scoped per Section 4.3.
**DB changes:** `Document`, `DocumentVersion`, `DocumentType`.
**Acceptance criteria:** Each document generates with correct Job data; access respects the field/document permission matrix.
**Failover:** Source-data snapshot retained per document for safe regeneration; async generation with retry.

### Stage 8 — Real Integrations

**Scope:** ICEGATE, shipping line APIs, accounting sync, GST e-Invoicing — adapter pattern with manual-entry fallback.
**DB changes:** `IntegrationConfig`, `IntegrationSyncLog`.
**Acceptance criteria:** Each live integration round-trips correctly in staging; manual entry always available as fallback.
**Failover:** Circuit-breaker pattern per adapter; sync failures never block core workflow. See Section 10 for prerequisites.

### Stage 9 — Customer Portal

**Scope:** View-only access per Section 4.2, scoped strictly to the customer's own organization.
**DB changes:** Extend `User` role enum; row-level scoping by `Organization`.
**Acceptance criteria:** Direct-link access to another organization's Job is blocked and logged.
**Failover:** Fully isolated route group; disable via feature flag without affecting internal app.

### Stage 10 — Reporting, Notifications \& Polish

**Scope:** Branch performance dashboards, revenue/pending reports, email/SMS notifications, audit trail viewer, performance/security hardening.
**DB changes:** `Notification`, `NotificationPreference`.
**Acceptance criteria:** Reports match manually verified totals; notifications fire on correct transitions; OWASP Top 10 spot-check passes.
**Failover:** Full DB backup before hardening changes; notifications non-blocking/queued.

### Stage 11 — Full Excel/Sheets Cutover Validation

**Scope:** A parallel-run stage: key branches enter data into both the platform and their existing sheets side by side for an agreed period, and results are reconciled before Seawave fully retires the spreadsheets.
**Deliverables:** A reconciliation checklist per branch confirming every field previously tracked in Excel has a working equivalent in the platform.
**Acceptance criteria:** Zero data points identified as "only in the sheet, not in the platform" across a full operating cycle.
**Failover:** Any gap found is logged as a scoped addition to the relevant earlier stage rather than a rushed patch, since the schema is additive.

\---

## 9\. Claude Code Execution Prompts

Stages 0–10 are technical builds and are handed to Claude Code as sequential prompts, one per stage, only after the previous stage's acceptance criteria have been confirmed. Stage 11 is an operational/organizational process (parallel-running with existing sheets) rather than a code-build stage, so no code prompt is included for it.

### 9.1 Token-conservation clause (included in every prompt below)

Every stage prompt includes this instruction so Claude Code does not re-read or re-audit the entire codebase each time a new stage begins:

> Do not re-review, re-read in full, or re-audit the entire codebase before starting this task. Treat all previously completed stages as correct and finished — their acceptance criteria were already verified. Only read the specific files and directories listed under "Relevant paths" below. If you need to confirm the shape of something from an earlier stage (a Prisma model, a component prop, a permission rule), search for that specific symbol/name rather than opening full files or directories outside this stage's scope. At the end of this task, write a short summary to `docs/stage-checklists/stage-N.md` (model shapes added, endpoints added, key decisions made) so the next stage's prompt can reference it without needing to re-read your code.

### 9.2 Stage prompts

**Stage 0 — Foundation \& Design System**

```
Build Stage 0 of the Seawave freight forwarding platform.

Relevant paths: entire repo (this is the initial scaffold — no prior stages exist yet).

Scope:
- Initialize a Next.js 14+ App Router project with TypeScript and Tailwind CSS.
- Set up Prisma with a Neon Postgres connection (use .env.example for the connection string placeholder).
- Create the User, Role, Branch, Session, and FieldPermission models per the schema direction in Section 4 and Section 7 of the attached plan.
- Implement Auth.js (NextAuth) with 6 roles: Admin, Branch Manager, Doer/Ops Executive, Sales/Enquiry, Accounts/Finance, Customer.
- Build the shared component library in src/components/ui (Button, Card, Badge, StepTracker \\\[vertical + horizontal variants], DataTable, form inputs, modal) using the brand tokens from Section 2.1 as CSS variables in src/styles/tokens.css.
- Build the base layout shell: sidebar, top bar with branch selector, role-based route guards.
- Implement the permissions engine in src/lib/permissions that checks role AND field-group access before returning or accepting data on any API route.

Acceptance criteria:
- A test user of each role can log in and sees only their permitted sidebar items.
- A test API call confirms a role without access to a field group cannot retrieve that field.
- Component library renders correctly against the brand tokens.

Failover requirement: tag this commit as the foundation release before any further work begins.

\\\[Include the token-conservation clause from Section 9.1]
```

**Stage 1 — Master Data + Bulk Import Wizard**

```
Build Stage 1 of the Seawave freight forwarding platform.

Relevant paths: src/app/(dashboard)/customers, src/app/(dashboard)/data-import, src/app/api/data-import, src/lib/import, prisma/schema.prisma (append only).

Scope:
- Build Organization creation with KYC fields (GST, PAN, TDS) with GST format validation and duplicate-GST detection.
- Build Branch management and User management screens (Admin/Branch Manager access per Section 4.2).
- Build the Customer directory with search/filter.
- Build the Admin-only bulk import wizard (Section 6): Excel/CSV upload, column-to-field mapping screen with auto-suggested matches, a validation pass that flags missing/malformed/duplicate rows, an import-valid-rows-only option, background job processing, and a completion summary with a downloadable error log.
- Add ImportBatch and ImportRowError models.

Acceptance criteria:
- A sample sheet of \\\~200 dummy customer rows imports correctly through the mapping UI.
- Intentionally broken rows (bad GST, missing name) are flagged and excluded, with a downloadable error report.
- All destructive actions (delete/deactivate) are soft deletes only.

Failover requirement: each import batch runs as a single transaction — a failed batch must roll back entirely and be marked "failed" with its full error log, not leave partial data.

\\\[Include the token-conservation clause from Section 9.1]
```

**Stage 2 — Enquiry Capturing**

```
Build Stage 2 of the Seawave freight forwarding platform.

Relevant paths: src/app/(dashboard)/enquiries, src/app/api/enquiries, prisma/schema.prisma (append only).

Scope:
- Build the Enquiry creation flow per Section 5.2 of the attached plan: Doer/Branch/Customer/Contact selection, Shipment Type (Import/Export), Type of Service (Freight Forwarding/Customs Clearance/Transportation/Warehousing/Exim Consultancy) with the correct conditional detail section appearing per service type, and RFQ reason.
- Add Enquiry, EnquiryFreightDetail, EnquiryCustomsDetail, EnquiryTransportDetail models.
- Build the Enquiry list/dashboard with status and filters.
- Build the Branch Manager review queue: an enquiry can be marked "Ready for Quotation" or flagged back for correction.
- Implement autosave on the enquiry form (debounced) so no data is lost on browser crash or network drop.

Acceptance criteria:
- Every Shipment Type + Service Type combination from the source process document captures the correct fields with no missing fields.
- An enquiry can be saved as a draft and resumed after a refresh.
- The Branch Manager review queue correctly filters to enquiries pending review.

Failover requirement: confirm this stage's schema changes are additive only (no columns dropped or renamed from Stage 0/1 models).

\\\[Include the token-conservation clause from Section 9.1]
```

**Stage 3 — Quotation Module**

```
Build Stage 3 of the Seawave freight forwarding platform.

Relevant paths: src/app/(dashboard)/quotations, src/app/api/quotations, prisma/schema.prisma (append only).

Scope:
- Build the Quotation builder linked to a "Ready for Quotation" Enquiry, per Section 5.3: Freight Charges, Customs Clearance Charges, Transportation Charges, Reimbursement Charges as separate line items.
- Add Quotation, QuotationLineItem, QuotationVersion, QuotationStatus models.
- Build the Branch Manager approval gate (a quotation cannot be marked "Sent" without approval).
- Implement quotation versioning so edits after approval create a new version rather than overwriting history.
- Build PDF generation for the quotation document.
- Build the "convert to Job" action that will be consumed by Stage 4 (a Job model does not exist yet — store the converted data on the Quotation record as a JSON snapshot for now, to be picked up when Stage 4 builds the Job model).

Acceptance criteria:
- A quotation can be built, revised (creating a new version), approved, and marked ready for conversion.
- PDF generation produces an accurate document from the quotation data.

Failover requirement: if PDF generation fails, fall back to an HTML preview so the approval workflow is not blocked.

\\\[Include the token-conservation clause from Section 9.1]
```

**Stage 4 — Consignment / Job Creation + Historical Job Import**

```
Build Stage 4 of the Seawave freight forwarding platform.

Relevant paths: src/app/(dashboard)/jobs, src/app/api/jobs, src/lib/import (extend, do not rebuild), prisma/schema.prisma (append only).

Scope:
- Build the Job model and creation flow per Section 5.4: consume the JSON snapshot from an approved Quotation (Stage 3) to pre-fill the Job, then let the Doer complete Shipper/Consignee/Notify Party details, Agent, Place of Receipt, POL, POD, Place of Delivery, Shipping Line, CFS, Vessel/Voyage, Free Days at POD, container details, weights, packages, CBM.
- Add Job, ShipperDetail, ConsigneeDetail, NotifyPartyDetail, ContainerDetail models.
- Build the Branch Manager final-review gate before a Job locks into a workflow track.
- Build the central Job dashboard with branch/status/customer search and filters.
- Extend the Stage 1 import wizard (do not duplicate its logic — import and reuse it) to support importing historical/open Jobs from Excel.

Acceptance criteria:
- A Job created from a Quotation retains all relevant data with zero re-entry.
- Job dashboard search returns correct results across a seeded set of 1,000+ dummy Job records.
- A batch of historical Jobs imports correctly with mapped workflow status.

Failover requirement: every Job write (across Job + its detail tables) must be wrapped in a single database transaction — a partial failure must not leave an inconsistent Job record.

\\\[Include the token-conservation clause from Section 9.1]
```

**Stage 5 — Import Workflow Engine**

```
Build Stage 5 of the Seawave freight forwarding platform.

Relevant paths: src/components/workflow, src/app/(dashboard)/jobs/import, src/app/api/jobs (extend), prisma/schema.prisma (append only).

Scope:
- Build a configurable workflow engine (WorkflowTemplate, WorkflowStep, JobWorkflowProgress, JobAuditLog models) — templates are stored as data, not hardcoded logic.
- Implement the Ex-Works track per Section 5.5 and the FOB track per Section 5.6, with the exact step sequence, step ownership (Doer/Branch Manager/Accounts as specified), and the two approval gates (Draft HBL Checking \\\& Approval, Freight Certificate Preparation).
- Build the vertical step-tracker UI component (reuse from Stage 0's component library, do not rebuild) wired to real workflow data.
- Every step completion writes an append-only entry to JobAuditLog (who, when, what changed); a completed step can only be reverted through an explicit logged action.

Acceptance criteria:
- An Ex-Works job and an FOB job each show the correct distinct step sequence.
- Only the assigned role can complete a given step (e.g. only Accounts can complete Bill Preparation).
- Approval-gated steps block progression until approved.

Failover requirement: workflow template corrections must be possible via an admin data screen, not a code deploy.

\\\[Include the token-conservation clause from Section 9.1]
```

**Stage 6 — Export Workflow Engine**

```
Build Stage 6 of the Seawave freight forwarding platform.

Relevant paths: src/components/workflow (extend, do not rebuild the engine), src/app/(dashboard)/jobs/export, src/app/api/jobs (extend), prisma/schema.prisma (append only, ideally no new tables — reuse Stage 5's WorkflowTemplate/WorkflowStep).

Scope:
- Add Export workflow templates for CIF, DDP, and DDU per Section 5.7, reusing the exact same workflow engine built in Stage 5.
- Implement the duty-payment field-level visibility rule from Section 4.3: DDP shows Accounts the full payment detail and shows the Customer only the final landed cost; DDU marks the field "Consignee account" and restricts Customer visibility to their own liability only.
- Add the Dock Stuffing and Factory Stuffing sub-flows per Section 5.8, writing into the same JobWorkflowProgress structure as parallel steps rather than a separate engine.

Acceptance criteria:
- All three Incoterm tracks render correctly with shared steps deduplicated and divergent steps clearly distinguished.
- Duty-payment field visibility matches the permission matrix exactly for each role.
- Both stuffing sub-types log correctly against the same Job.
- Run the existing Stage 5 test suite and confirm zero regressions on Import workflows before marking this stage complete.

Failover requirement: if a regression is found after this stage deploys, the rollback path is reverting to the last Stage-5-only deployment.

\\\[Include the token-conservation clause from Section 9.1]
```

**Stage 7 — Document Generation \& Management**

```
Build Stage 7 of the Seawave freight forwarding platform.

Relevant paths: src/app/(dashboard)/documents, src/app/api/documents, src/lib (new pdf-generation module), prisma/schema.prisma (append only).

Scope:
- Build PDF generation for HBL, MBL, Freight Certificate, Delivery Order, and Invoices, pulling data from the Job record.
- Add Document, DocumentVersion, DocumentType models.
- Build the document repository UI per Job (upload, version, view).
- Enforce the document visibility rules from Section 4.3 (e.g. Sales cannot see financial documents; Customer sees only shared, non-internal documents) at the API layer.
- Store a JSON snapshot of the source data alongside each generated document for safe regeneration.

Acceptance criteria:
- Each document type generates correctly with accurate Job data.
- Regenerating a document does not destroy the prior version.
- Document access respects the field/document permission matrix for every role.

Failover requirement: document generation must run as an async job with retry logic (3 attempts) before surfacing a failure to the user.

\\\[Include the token-conservation clause from Section 9.1]
```

**Stage 8 — Real Integrations**

```
Build Stage 8 of the Seawave freight forwarding platform.

Relevant paths: src/lib/integrations, src/app/api/integrations, prisma/schema.prisma (append only).

Scope:
- Build the integration adapter pattern: a common interface that any external system (ICEGATE, a shipping line, an accounting tool) implements.
- Add IntegrationConfig and IntegrationSyncLog models.
- Implement a circuit breaker per adapter: if an external API is down or rate-limited, the platform automatically falls back to manual entry for that specific integration without blocking any other part of the platform.
- Build whichever specific integrations have been confirmed and credentialed by this point (see Section 10 of the attached plan for prerequisites) — for any integration not yet available, ensure the manual-entry fallback path is fully functional on its own.

Acceptance criteria:
- Each live integration round-trips real data correctly in a staging environment before being enabled in production.
- Manual entry remains fully functional as a fallback for every integrated field.
- All sync attempts and failures are logged to IntegrationSyncLog.

Failover requirement: an integration outage must never block core workflow actions (job creation, step completion, document generation).

\\\[Include the token-conservation clause from Section 9.1]
```

**Stage 9 — Customer Portal**

```
Build Stage 9 of the Seawave freight forwarding platform.

Relevant paths: src/app/(customer-portal), src/app/api (customer-scoped endpoints only), prisma/schema.prisma (extend User role enum only).

Scope:
- Build the customer-facing portal in its own route group with its own limited layout.
- Extend the User role enum with Customer; implement row-level scoping so a Customer user only ever sees Jobs, documents, and quotations linked to their own Organization.
- Reuse existing UI components from src/components/ui — do not rebuild the design system for this route group.
- Add a feature flag that can disable the entire portal without affecting the internal operations app.

Acceptance criteria:
- A Customer user cannot access another organization's Job data even via direct link/URL manipulation — test this explicitly and log any attempted violation.
- Disabling the feature flag removes portal access without any impact on internal screens.

Failover requirement: confirm this route group has zero shared state or shared API logic with the internal dashboard beyond the read-only, organization-scoped queries.

\\\[Include the token-conservation clause from Section 9.1]
```

**Stage 10 — Reporting, Notifications \& Polish**

```
Build Stage 10 of the Seawave freight forwarding platform.

Relevant paths: src/app/(dashboard)/reports, src/app/api (notifications, reports), src/lib (new notifications module), prisma/schema.prisma (append only).

Scope:
- Build branch performance dashboards, pending-shipment reports, and revenue reports, scoped per the access matrix in Section 4.2 (Accounts gets full financial reports; Branch Manager gets branch-scoped; Sales gets their own enquiries/quotations only).
- Add Notification and NotificationPreference models.
- Build email (and optionally SMS) notifications on workflow status changes, run as non-blocking queued jobs with retry.
- Build the audit trail viewer surfacing JobAuditLog and IntegrationSyncLog entries.
- Run a performance pass under realistic seeded data volumes and a basic OWASP Top 10 security review (auth checks, role checks, input validation/SQL injection via Prisma's parameterized queries, XSS sweep).

Acceptance criteria:
- Report totals match manually verified totals from the underlying data.
- Notifications fire reliably on the correct status transitions.
- The security review turns up no critical findings.

Failover requirement: take a full database backup (Neon point-in-time restore point) before applying any performance or security changes, so a regression can be reverted without data loss. Notifications must never block a core workflow action if they fail.

\\\[Include the token-conservation clause from Section 9.1]
```

\---

## 10\. Open Items — Required Before Stage 8

1. Shipping lines/carriers to prioritize for API integration.
2. ICEGATE / customs broker credentials or partner arrangement.
3. Accounting software currently in use (Tally / Zoho / QuickBooks / other) and API access status.
4. GST e-Invoicing — covered by item 3, or separate?

\---

## 11\. Summary Timeline View

|Stage|Module|Key Risk Area|
|-|-|-|
|0|Foundation \& Design System|Low|
|1|Master Data + Bulk Import Wizard|Medium (data quality from legacy sheets)|
|2|Enquiry Capturing|Low|
|3|Quotation Module|Medium (PDF generation)|
|4|Job Creation + Historical Import|Medium (data integrity across linked entities)|
|5|Import Workflow Engine|High (core business logic + step ownership)|
|6|Export Workflow Engine|Medium (reuses Stage 5 engine)|
|7|Document Generation|Medium (external PDF tooling)|
|8|Real Integrations|Highest (external dependencies)|
|9|Customer Portal|Low (isolated route group)|
|10|Reporting \& Polish|Medium (performance/security hardening)|
|11|Excel/Sheets Cutover Validation|Medium (organizational change, not technical)|

\---

*End of document.*

