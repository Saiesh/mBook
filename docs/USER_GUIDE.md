# mBook User Guide

## Table of Contents

- [Part 0 — Overview](#part-0--overview)
- [Part 1 — Getting Started (Admin)](#part-1--getting-started-admin)
- [Part 2 — Project Setup (Admin / HO QS)](#part-2--project-setup-admin--ho-qs)
- [Part 3 — BOQ Upload (Admin / HO QS)](#part-3--boq-upload-admin--ho-qs)
- [Part 4 — Measurement Capture (Site QS)](#part-4--measurement-capture-site-qs)
- [Part 5 — Bill Generation (Admin / HO QS)](#part-5--bill-generation-admin--ho-qs)
- [Part 6 — Bill Review, Acceptance & Export (Admin / HO QS)](#part-6--bill-review-acceptance--export-admin--ho-qs)
- [Part 7 — Ongoing Workflow (Recurring RA Bills)](#part-7--ongoing-workflow-recurring-ra-bills)
- [Appendix](#appendix)

---

## Part 0 — Overview

mBook is a landscaping measurement and billing platform that digitises the end-to-end quantity surveying workflow — from on-site dimension capture through to contractor RA bill generation, review, and acceptance.

### Three User Roles

| Role | Also Called | Responsibilities |
|---|---|---|
| **Admin** | Administrator | User management, project creation, system configuration |
| **HO QS** | Head Office Quantity Surveyor | BOQ management, bill review, accept, and Excel export |
| **Site QS** | Site Quantity Surveyor | On-site measurement capture (works offline via PWA) |

> A user can have only one system-level role (`Admin`, `HO QS`, or `Site QS`). Within a project, any user can additionally be assigned a project-level role of **HO QS**, **Site QS**, or **Project Incharge**.

### Typical Project Lifecycle

```
Admin creates project
        │
        ▼
Admin / HO QS uploads BOQ (Excel)
        │
        ▼
Admin configures Areas & assigns Team
        │
        ▼
Site QS captures measurements on-site (offline → sync)
        │
        ▼
Admin / HO QS selects measurements → Generate RA Bill
        │
        ▼
HO QS exports Generated Bill to Excel, shares with contractor
        │
        ▼
HO QS uploads contractor-reviewed Excel → Accept Bill
        │
        ▼
Repeat for each billing period (cumulative quantities carry forward)
```

---

## Part 1 — Getting Started (Admin)

### 1.1 Logging In

Navigate to `/login` in your browser. Enter your **email** and **password** and click **Sign In**.

- If this is your first login, use the temporary password provided by your Admin.
- After signing in you are redirected to the home page (`/`).

### 1.2 Admin Dashboard

Navigate to `/admin`. The Admin dashboard shows top-level navigation tiles:

- **Users** — manage all users in the system
- **Projects** — manage all projects

### 1.3 Creating Users (`/admin/users`)

Only users with the **Admin** role can create new users. All roles (Admin, HO QS, Site QS) are created here.

**Steps:**

1. Go to `/admin/users`.
2. Click **Create User** (top-right).
3. Fill in the dialog:

| Field | Required | Notes |
|---|---|---|
| Name | Yes | Full display name |
| Email | Yes | Used to log in |
| Phone | No | Optional; shown on the team list |
| Role | Yes | `Admin`, `HO QS`, or `Site QS` |
| Temporary Password | — | Auto-generated; click **Copy** before saving |

4. Click **Create User**. The user appears in the table immediately.
5. Share the email and temporary password with the new user out-of-band (e.g. via WhatsApp or email). The user can change their password after first login.

> **Tip:** Click **Regenerate** if you want a fresh password before creating the account.

---

## Part 2 — Project Setup (Admin / HO QS)

### 2.1 Creating a Project (`/admin/projects/new`)

1. From `/admin/projects`, click **New Project**.
2. Fill in the form:

**Basic Information**

| Field | Required | Notes |
|---|---|---|
| Project Code | Yes | Letters, numbers, hyphens, underscores only; auto-uppercased. E.g. `PRJ-001` |
| Project Name | Yes | Free text name |
| Client Name | No | Name of the client / contractor |

**Location** (all optional)

| Field | Notes |
|---|---|
| City | City of the project site |
| State | State / province |
| Address | Street address |

**Schedule & Budget** (all optional)

| Field | Notes |
|---|---|
| Start Date | ISO date picker |
| End Date | Must be on or after Start Date |
| Budget | Positive number (INR) |

**Description** (optional) — freeform notes about scope or context.

3. Click **Create Project**. You are redirected to the project details page.

### 2.2 Viewing the Project List

Navigate to `/admin/projects`. All projects are listed with their code, name, and status. Click any row to open the project.

### 2.3 Project Details Page (`/admin/projects/[id]/details`)

The details page shows all project metadata and quick-links to the four sub-sections:

| Tab / Link | Purpose |
|---|---|
| Areas | Define the site zones for this project |
| Team | Assign users to project roles |
| BOQ | Upload and view the Bill of Quantities |
| Measurements | View captured measurements and generate bills |
| Bills | View all RA bills for this project |

### 2.4 Managing Areas (`/admin/projects/[id]/areas`)

Areas represent the physical zones within a project site (e.g. "North Planter", "East Pathway"). They are used during measurement capture to tag each row.

**Adding an area:**

1. Click **Add Area**.
2. In the modal, fill in:

| Field | Required | Notes |
|---|---|---|
| Code | Yes | Short identifier, e.g. `AREA-A`; auto-uppercased |
| Name | Yes | Descriptive name, e.g. "North Planter" |
| Description | No | Optional notes |

3. Click **Add**. The area is appended to the list.

**Reordering areas:** Use the **↑** / **↓** buttons on each row. The order here determines the order areas appear during capture.

**Editing an area:** Click **Edit** on any row. Change fields and click **Save**.

**Deleting an area:** Click **Delete**. Confirm in the dialog. This is irreversible — only delete areas that have no captured measurements attached.

### 2.5 Managing Team (`/admin/projects/[id]/team`)

Assign system users to project-specific roles so they can access the project in capture and admin views.

**Adding a member:**

1. Type a name or email in the **Search users** field. Results appear in the **User** dropdown.
2. Select the user from the dropdown.
3. Choose a **Role** (radio buttons):
   - **HO QS** — has office access to BOQ and bills
   - **Site QS** — captures measurements on site
   - **Project Incharge** — overall project lead
4. Click **Add Member**.

**Removing a member:** Click **Remove** on the member's row. Confirm in the dialog.

> A user cannot be added twice with the same role. If you select a user and role combination that already exists, the **Add Member** button will be disabled with a warning.

---

## Part 3 — BOQ Upload (Admin / HO QS)

### 3.1 Preparing the Excel BOQ File

The BOQ file must be in `.xlsx` format. The importer reads **sections** and **items** from the spreadsheet. Each row in the sheet corresponds to one BOQ line item with:

- Item number
- Description
- SAP code (optional)
- Unit (e.g. Sqm, Rmt, Nos)
- Quantity (BOQ quantity)
- Rate (unit rate in INR)
- Amount (calculated)

Ensure the sheet follows the expected column layout. Contact your Admin if you need the standard BOQ template.

### 3.2 Uploading the BOQ (`/admin/projects/[id]/boq`)

1. Navigate to the project BOQ page.
2. Click **Upload BOQ** (top-right).
3. Select your `.xlsx` file from disk.
4. The importer runs automatically. On success, a green banner confirms:
   > *"Imported X items in Y sections — ₹Z"*
5. The page refreshes to show the newly imported version.

### 3.3 Reviewing Sections and Items

After upload, the BOQ is displayed in collapsible sections. Each section shows:
- Section name and item count
- A table with columns: **#**, **Description**, **SAP Code**, **Unit**, **Qty**, **Rate**, **Amount**

Use **Expand all** / **Collapse all** to toggle all sections at once. Click a section header to toggle it individually.

### 3.4 BOQ Versions

Every upload creates a new **version**. The most recently uploaded version is automatically marked **Active** and used for all subsequent measurement capture and billing.

If multiple versions exist, a **View version** dropdown appears in the version bar so you can inspect historical uploads without changing the active version.

### 3.5 When to Re-Upload

Re-upload the BOQ when:
- Rates or quantities have been revised
- New line items have been added
- Sections have been restructured

Re-uploading does not delete previous versions. Any measurements captured against items from previous versions continue to reference those item IDs — billing will still work correctly.

---

## Part 4 — Measurement Capture (Site QS)

### 4.1 Navigating to `/measurements`

Site QS users access the capture flow from the home page (`/`) or directly at `/measurements`. The page shows a **Recent Measurements** summary grouped by date and project.

### 4.2 Selecting a Project

Click **Capture Measurements**. A project picker dialog opens. Search for or scroll to the project you are working on, then tap it to proceed.

You are taken to the project overview page at `/measurements/project/[id]`.

### 4.3 Choosing a Date

On the project overview page, tap a date from the calendar or tap **Today** to open today's capture sheet. The URL becomes `/measurements/project/[id]/date/[YYYY-MM-DD]`.

The header shows:
- **Synced** — rows that have been uploaded to the server
- **Pending** — rows saved locally but not yet synced

### 4.4 Entering Measurements

The capture sheet lists all BOQ items from the active BOQ version, grouped by section. Each section is collapsible (open by default).

**To add a measurement row for a BOQ item:**

1. Locate the BOQ item (use the section grouping to navigate).
2. Tap **+ Add** on the item row.
3. Fill in the measurement dialog:

| Field | Required | Notes |
|---|---|---|
| Area Name | Yes | Type or select from suggestions (populated from prior entries) |
| NOS | Yes | Number of units / runs; must be > 0; default `1` |
| L (Length) | No | In metres |
| B (Breadth) | No | In metres |
| D (Depth) | No | In metres |
| Unit | Yes | Pre-filled from BOQ item unit; editable |
| Remarks | No | Free text notes |
| Is deduction | No | Check this box if the row reduces the total quantity |

> **Quantity calculation:** `Qty = NOS × L × B × D`. If L, B, or D are blank, they are treated as 1 for the calculation.

4. Tap **Save Offline**. The row is stored locally in your browser (IndexedDB) and appears immediately under the BOQ item with a **Pending sync** badge.

### 4.5 Offline Capture and Sync

mBook is a Progressive Web App (PWA). You can continue capturing measurements even without an internet connection. All rows are queued locally.

**To sync when back online:**

- Tap **Sync Now** in the header bar.
- The app uploads all pending rows and refreshes the page.
- Pending badges disappear and the Synced count updates.

The app also attempts to auto-sync in the background when it detects a network connection.

> **Important:** Always sync before closing your browser session or switching devices, or your offline-captured rows may be lost.

---

## Part 5 — Bill Generation (Admin / HO QS)

### 5.1 Opening the Measurements View

From the project details page, click **Measurements** to go to `/admin/projects/[id]/measurements`.

This page shows all synced measurements for the project, grouped by date (most recent first). Each date group is expanded by default.

### 5.2 Filtering Measurements

Use the four filter inputs to narrow down the list before selecting:

| Filter | How it works |
|---|---|
| Filter by BOQ item | Partial-match on item number or description |
| Filter by area name | Partial-match on area name |
| Date from | Measurements on or after this date |
| Date to | Measurements on or before this date |

Click **Clear Filters** to reset all four filters.

The summary bar at the top shows:
- **Filtered measurements** — total rows visible after filtering
- **Selected for bill** — how many rows are checked

### 5.3 Selecting Measurements

Each date group has a **group checkbox** in its header. Checking it selects all rows in that date. Checking it again deselects all. An indeterminate state is shown when only some rows in the group are selected.

You can also check / uncheck individual measurement rows. Rows with `is_deduction = true` appear with a red background tint as a visual reminder.

### 5.4 Generating the Bill

Once you have selected the measurements to include:

1. Click **Generate Bill (N)** (where N is the number of selected rows).
2. The system:
   - Creates a new **RA Bill** record with an auto-incremented bill number and sequence.
   - Creates a **Generated** bill version with cumulative line items (one per BOQ item).
   - Links the selected measurement rows to this bill.
3. You are automatically redirected to the bill detail page.

> **Cumulative logic:** Each bill version carries forward the total quantity billed in all previous bills for the same BOQ item. The line items show **Prev Qty**, **Curr Qty**, and **Cum Qty** columns to make this transparent.

---

## Part 6 — Bill Review, Acceptance & Export (Admin / HO QS)

### 6.1 Bill Detail Page (`/admin/projects/[id]/bills/[billId]`)

The bill detail page opens with four information blocks:

**Header summary:**
- Bill number (e.g. `RA-001`)
- Sequence number
- Date created
- Number of linked measurements and total measured quantity

**Version tabs:**
- **Generated Version** — the version created by mBook from the selected measurements
- **Accepted Version** — the version created after contractor review and formal acceptance

### 6.2 Reviewing Line Items

The line item table shows one row per BOQ item billed. Columns:

| Column | Meaning |
|---|---|
| Item | BOQ item number and description (truncated) |
| Prev Qty | Cumulative quantity billed in all prior bills |
| Curr Qty | Quantity from the measurements in this bill |
| Cum Qty | Prev Qty + Curr Qty |
| Rate | Unit rate from the BOQ |
| Curr Amt | Curr Qty × Rate |

Below the line items, three summary boxes show **Sub Total**, **GST** (at the tax rate %), and **Grand Total**.

### 6.3 Reviewing Linked Measurements

Scroll down to the **Linked Measurements** table. This lists every measurement row that was checked when generating the bill, with full dimension detail (Date, Area, BOQ Item, NOS, L, B, D, Qty, Unit). Deduction rows appear with a red tint.

### 6.4 Exporting to Excel

Click **Export Excel** in the Generated Version card header. The app generates an Excel file and triggers a browser download automatically. The filename includes the bill number and version for traceability.

Share this Excel file with the contractor for review and sign-off.

### 6.5 Uploading the Accepted Excel

After the contractor returns the reviewed Excel:

1. In the **Upload Excel (Generated Version)** section at the bottom of the page, click the file input and select the `.xlsx` file.
2. Set the **Tax rate** field (default: `18`% GST).
3. Optionally enter **Notes** in the textarea.
4. Click **Upload Excel**. The file is stored and a new draft version is created, ready for acceptance.

### 6.6 Accepting the Bill

Click **Accept Bill** in the version tab bar. This:
- Creates an **Accepted** bill version snapshot.
- Switches the view to the **Accepted Version** tab.

Once accepted, the bill appears as "Accepted" in the bills list. Accepted quantities are counted as previous quantities in all future bills.

### 6.7 Bills List Page (`/admin/projects/[id]/bills`)

Navigate to `/admin/projects/[id]/bills` to see all RA bills for the project. The page shows three stat cards at the top:

| Card | Meaning |
|---|---|
| Total Bills | Count of all RA bills ever generated for this project |
| Accepted Version Available | Bills that have at least one accepted version |
| Generated Only | Bills that have a generated version but have not yet been accepted |

The table lists each bill with its sequence number, bill number, creation date, and the grand totals for the latest generated and accepted versions.

Click any bill row (or the **View** link) to open the bill detail page.

---

## Part 7 — Ongoing Workflow (Recurring RA Bills)

RA bills in mBook are designed for a recurring billing cycle — typically monthly or per agreed billing period.

### 7.1 Capturing New Measurements for the Next Period

Site QS users continue capturing measurements as usual via `/measurements`. Each measurement is dated to the day it is captured. Measurements already included in a previous bill can be filtered out on the Measurements page using the date range filter.

### 7.2 Generating Subsequent Bills

The process is identical to the first bill:

1. Go to `/admin/projects/[id]/measurements`.
2. Filter to the new period (e.g. set **Date from** to the day after the last bill's period).
3. Select the relevant measurements.
4. Click **Generate Bill (N)**.

The new bill automatically picks up the cumulative quantities from all previously accepted bills. The **Prev Qty** column in the line items will reflect the totals accepted to date.

### 7.3 Bill Sequence Numbering

Bills are numbered sequentially per project. The first bill is sequence `#1`, the second `#2`, and so on. The `bill_number` field is a formatted string (e.g. `RA-001`) derived from the sequence. This sequence cannot be manually changed.

---

## Appendix

### A. URL Reference

| URL | Page | Primary Role |
|---|---|---|
| `/login` | Sign in | All |
| `/` | Home dashboard | All |
| `/admin` | Admin dashboard | Admin |
| `/admin/users` | User management | Admin |
| `/admin/projects` | Project list | Admin, HO QS |
| `/admin/projects/new` | Create project | Admin |
| `/admin/projects/[id]/details` | Project details | Admin, HO QS |
| `/admin/projects/[id]/areas` | Manage areas | Admin, HO QS |
| `/admin/projects/[id]/team` | Manage team | Admin |
| `/admin/projects/[id]/boq` | BOQ upload & view | Admin, HO QS |
| `/admin/projects/[id]/measurements` | Measurements + bill generation | Admin, HO QS |
| `/admin/projects/[id]/bills` | Bills list | Admin, HO QS |
| `/admin/projects/[id]/bills/[billId]` | Bill detail, export, accept | Admin, HO QS |
| `/measurements` | Measurement landing | Site QS |
| `/measurements/project/[id]` | Project overview (date picker) | Site QS |
| `/measurements/project/[id]/date/[date]` | Daily capture sheet | Site QS |

### B. Role Permission Matrix

| Action | Admin | HO QS | Site QS |
|---|---|---|---|
| Create / manage users | Yes | No | No |
| Create projects | Yes | No | No |
| Edit project details | Yes | No | No |
| Manage areas | Yes | Yes | No |
| Manage team | Yes | No | No |
| Upload BOQ | Yes | Yes | No |
| View BOQ | Yes | Yes | No |
| Capture measurements | No | No | Yes |
| View measurements (admin) | Yes | Yes | No |
| Generate RA bill | Yes | Yes | No |
| Export bill to Excel | Yes | Yes | No |
| Upload accepted Excel | Yes | Yes | No |
| Accept bill | Yes | Yes | No |
| Delete bill | Yes | No | No |

> Permissions are enforced server-side via Supabase Row-Level Security (RLS) policies. The UI hides irrelevant buttons but the API enforces access independently.

### C. Project Creation Field Reference

| Field | Required | Validation |
|---|---|---|
| Project Code | Yes | Letters, numbers, `-`, `_` only; auto-uppercased; must be unique |
| Project Name | Yes | Non-empty string |
| Client Name | No | Free text |
| City | No | Free text |
| State | No | Free text |
| Address | No | Free text |
| Start Date | No | ISO date |
| End Date | No | Must be on or after Start Date |
| Budget | No | Positive number (INR) |
| Description | No | Free text |

### D. Glossary

| Term | Definition |
|---|---|
| **RA Bill** | Running Account Bill — a cumulative billing statement issued at regular intervals against a contract. Each RA bill adds the current period's quantities to all prior quantities. |
| **BOQ** | Bill of Quantities — a document listing all work items, their descriptions, units, quantities, and rates. Forms the pricing basis of the contract. |
| **BOQ Version** | A snapshot of the BOQ created each time an Excel file is uploaded. Only the active version is used for measurement capture and billing. |
| **Bill Version** | A snapshot of an RA bill. A bill has a **Generated** version (created by mBook) and optionally an **Accepted** version (created after contractor review and formal sign-off). |
| **HO QS** | Head Office Quantity Surveyor — the office-based QS responsible for reviewing measurements, managing BOQs, and processing bills. |
| **Site QS** | Site Quantity Surveyor — the field-based QS who physically measures work done and records dimensions in mBook on-site. |
| **NOS** | Number of Similar items — the multiplier used in measurement calculations. `Qty = NOS × L × B × D`. |
| **Deduction** | A negative measurement entry that reduces the total quantity for a BOQ item (e.g. openings in a wall, cutouts in paving). |
| **Cumulative Quantity** | The total quantity billed for a BOQ item across all RA bills from the start of the project to the current bill. |
| **Pending sync** | A measurement captured offline (stored locally in the browser) that has not yet been uploaded to the server. |
| **PWA** | Progressive Web App — a web application that can be installed on a device and works offline by caching data locally. |
