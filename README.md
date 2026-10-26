# Current deployment target

Use [web/README.md](web/README.md) for the Next.js + Firebase application and Vercel setup. The Django application below is the earlier local prototype, retained for reference.

# MCC Fees Management

A Django application for 2025–26 student fees, with separate **College account** and **Our account** collections. This is an initial development version, not a published production service.

## Run locally

```sh
cd /workspace/college-account
python -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python manage.py migrate
.venv/bin/python manage.py createsuperuser
.venv/bin/python manage.py runserver 127.0.0.1:8000
```

Sign in with the user you created. No default credentials are supplied. Keep the existing checkout; cloud tasks are already isolated and do not require a worktree.

## Workflow

1. Sign in and open **Import workbook**. Upload the original `MCC 17_01_2026 Fees.xlsx`.
2. Review each student row, especially blank collections, balance differences and excess payments. Select only rows you have checked, then confirm.
3. Main tables are the source of truth. Pending summaries are deliberately excluded. Source names/row locations are preserved on historical collection records.
4. Generated MCC admission identifiers are temporary. Verify actual admission numbers through Django admin before importing altered workbooks. Identical workbook rows cannot be imported twice; changed workbooks cannot be safely matched using names alone.
5. Add missing semester fees on the student page. Course fee schedules are not automatically assigned; this avoids guessing amounts for students with exceptions or no supplied fees.
6. Record each new payment against a semester and account. The ledger keeps both accounts separate and subtracts their combined payments from the semester fee after concession. Overpayments remain a negative balance (credit); they are not silently moved to another semester.
7. Use Collections for account/date reports, Export ledger for a spreadsheet-compatible CSV, and Print / Save PDF for receipts and collection reports.

The workbook parser is specific to this MCC layout, not a generic Excel importer. It reads 156 student rows from the supplied file, including 87 with fee entries. Some listed students lack sufficient fee data; no missing fee amounts, dates or receipt numbers are invented. `nil`/`nill` become zero; a blank collection becomes no recorded payment and is flagged for review. Text additions such as `30000+35580` are safely summed without executing formulas. Student-only records preserve missing fee information explicitly.

## Access and data

All pages require authentication. Staff users can add students, assign fees, import reviewed data and record payments. Non-staff users can view ledgers and reports. Superusers manage users through `/admin/`. Payment records are read-only in admin. Recorded-by and creation times are retained. Payment corrections, refunds, settlement and full financial audit approval workflows are not implemented.

SQLite is used for this development version. `DATABASE_PATH` can locate it outside the checkout. Back up the database with SQLite's backup API while the application is running, or stop writers before copying it. A production deployment needs a private database/backup plan, HTTPS, `DJANGO_DEBUG=0`, a random `DJANGO_SECRET_KEY`, explicit `DJANGO_ALLOWED_HOSTS`, a production WSGI/ASGI server, static asset serving and deployment security review. Do not expose the development server publicly.

No actual student data, uploaded workbook, login password or generated database is tracked in Git. The original workbook has been parsed for validation but has not been imported into the application database.

## Validate

```sh
.venv/bin/python manage.py check
.venv/bin/python manage.py test -v 2
```

The tests exercise split account totals, credits, payment entry and duplicate submissions, cross-student payment rejection, account/date filtering, access control, CSRF, CSV formula escaping, and reviewed main-table import with duplicate prevention.
