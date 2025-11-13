# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

URY is an open-source restaurant management ERP built on top of Frappe/ERPNext. It provides comprehensive POS, Kitchen Display System (KDS), and analytics capabilities for restaurant operations.

**Current Version:** 0.2.1 (in active development, backward compatibility not guaranteed)

## Architecture

### Technology Stack

**Backend (Frappe Framework):**
- Python-based backend extending ERPNext
- Uses Frappe's DocType system for data models
- Custom hooks for ERPNext doctypes (POS Invoice, Sales Invoice, Item, Customer, etc.)
- WhiteList API pattern for frontend communication
- Real-time features via Socket.io for KOT notifications

**Frontend Applications (3 separate SPAs):**
1. **POS v2** (`/pos`) - React 19 + TypeScript + Zustand + Vite
   - Newest POS interface for order taking and billing
   - Uses `frappe-js-sdk` for API communication

2. **URY POS v1** (`/urypos`) - Vue 3 + Pinia + Vite
   - Legacy POS system (v1 branch, support ends December 2025)
   - Uses `frappe-js-sdk` for API communication

3. **URY Mosaic** (`/URYMosaic`) - Vue 3 + Vite
   - Kitchen Display System (KDS) for order management
   - Real-time order updates via Socket.io

**Common Frontend Stack:**
- QZ Tray integration for printer management (all frontends)
- Tailwind CSS for styling
- JWT authentication via `jsrsasign`

### Directory Structure

```
ury/
├── ury/                          # Main Python module
│   ├── hooks.py                  # Frappe app hooks and event handlers
│   ├── setup.py                  # Custom field definitions
│   ├── ury/                      # Core module
│   │   ├── doctype/              # Custom DocTypes (URY KOT, URY Order, URY Menu, etc.)
│   │   ├── api/                  # @frappe.whitelist() API endpoints
│   │   ├── hooks/                # DocType event hooks
│   │   ├── report/               # Custom reports
│   │   ├── page/                 # Custom Frappe pages
│   │   └── workspace/            # Custom workspaces
│   ├── public/                   # Static assets
│   │   ├── js/                   # Frappe desk customizations
│   │   ├── pos/                  # Built POS v2 assets
│   │   └── urypos/               # Built POS v1 assets
│   └── www/                      # Web routes
├── pos/                          # POS v2 React app (active development)
├── urypos/                       # POS v1 Vue app (legacy)
├── URYMosaic/                    # KDS Vue app
└── package.json                  # Root build orchestration
```

### Key Frappe Concepts

**DocTypes:** Custom data models in `ury/ury/doctype/`. Each DocType has:
- `.json` - Field definitions and metadata
- `.py` - Controller class with business logic
- `test_*.py` - Unit tests

**Hooks:** Event handlers in `ury/hooks.py` that intercept ERPNext doctype lifecycle:
- `doc_events` - Before/after insert, validate, submit, cancel, trash
- `scheduler_events` - Cron jobs (e.g., KOT validation every minute)
- `page_js` - Custom JS injection into standard pages

**Custom Fields:** Added to ERPNext doctypes via fixtures/setup.py to extend POS Invoice, Sales Invoice, etc. with restaurant-specific fields (waiter, table, order_type, etc.)

**API Pattern:** Backend APIs are in `ury/ury/api/*.py` with `@frappe.whitelist()` decorator. Called from frontend via `frappe.call()` or frappe-js-sdk.

## Development Commands

### Frappe/Bench Commands

**Installation:**
```bash
# Install dependencies for all frontend apps
yarn install
# Or individual apps
cd pos && yarn install
cd urypos && yarn install
cd URYMosaic && yarn install
```

**Build:**
```bash
# Build all frontend apps
yarn build

# Or build individually
yarn ury-pos-build        # POS v2
yarn ury-posv2-build      # POS v2 (same)
yarn ury-mosaic-build     # Mosaic KDS
```

**Frappe Site Operations:**
```bash
# Build after code changes
bench --site [sitename] build

# Migrate database after schema changes
bench --site [sitename] migrate

# Clear cache
bench --site [sitename] clear-cache

# Run tests
bench --site [sitename] run-tests --app ury
```

**Frontend Development:**
```bash
# Run dev servers (from respective directories)
cd pos && yarn dev              # POS v2 on Vite dev server
cd urypos && yarn dev            # POS v1 on Vite dev server
cd URYMosaic && yarn dev         # Mosaic on Vite dev server
```

### Requirements

- **Node.js:** Minimum version 18.20.x+
- **Frappe/ERPNext:** Version 15
- **Dependencies:** ERPNext, Frappe HR (hrms) for employee reports

## Code Architecture Patterns

### Backend Patterns

**Custom Fields vs DocTypes:**
- Use Custom Fields (in `setup.py`) to extend ERPNext core doctypes (POS Invoice, Sales Invoice, Item, Customer, etc.)
- Create new DocTypes in `ury/ury/doctype/` for URY-specific entities (URY KOT, URY Order, URY Menu, URY Table, etc.)

**API Structure:**
All whitelisted APIs follow the pattern:
```python
# In ury/ury/api/module_name.py
import frappe

@frappe.whitelist()
def function_name(param1, param2):
    # Validate inputs
    # Check permissions
    # Business logic
    return result
```

**Hook Pattern:**
Event handlers in `ury/ury/hooks/ury_[doctype_name].py`:
```python
import frappe

def before_insert(doc, method):
    # Modify doc before insert
    pass

def validate(doc, method):
    # Validation logic
    pass
```

**Key DocTypes:**
- `URY KOT` - Kitchen Order Tickets with status tracking
- `URY Order` - Main order document
- `URY Menu` - Restaurant menu configuration
- `URY Table` - Table management
- `URY Restaurant` - Restaurant/outlet configuration
- `URY Daily P and L` - Profit & Loss reporting

### Frontend Patterns

**POS v2 (React + TypeScript):**
- State management: Zustand stores in `src/store/slices/`
- API calls: frappe-js-sdk
- Routing: React Router
- Component library: Shadcn/ui patterns in `src/components/ui/`

**POS v1 & Mosaic (Vue 3):**
- State management: Pinia stores in `src/stores/`
- API calls: frappe-js-sdk + axios
- Routing: Vue Router
- Component library: Flowbite Vue

**Build Output:**
All frontend apps build to `ury/public/[app-name]/` and copy index.html to `ury/www/[app-name].html` for Frappe routing.

### Printing Architecture

URY uses QZ Tray for printer management across all apps:
- POS profiles have printer settings (table vs parcel KOT routing)
- KOT printing via `ury/ury/api/ury_kot_generate.py` and `ury_print.py`
- Invoice printing through QZ Tray or browser print

### Real-time Features

Socket.io integration for KOT notifications:
- Backend: `ury/ury/api/ury_kot_notification.py`
- Frontend: Socket.io clients in all apps
- Triggered on KOT status changes (preparing, ready, served)

## Important Conventions

**Internationalization:**
- ALL user-facing strings must be wrapped in translation functions
- Python: `_("string")` from frappe
- JavaScript: `__("string")` in Frappe context
- Never hardcode UI text

**Code Comments:**
- ALL code comments must be written in English
- No French or other languages in comments

**Security:**
- All API inputs must be validated
- User permission checks via `frappe.has_permission()` or role-based access
- Never trust client-side data

**Testing:**
- Tests are in each doctype directory as `test_*.py`
- Run with `bench --site [sitename] run-tests --app ury`

## Common Workflows

**Adding a New API Endpoint:**
1. Create function in `ury/ury/api/[module_name].py`
2. Add `@frappe.whitelist()` decorator
3. Validate inputs and check permissions
4. Run `bench --site [sitename] clear-cache`

**Adding Custom Field to ERPNext DocType:**
1. Add field definition to appropriate dict in `ury/setup.py` `get_custom_fields()`
2. Run `bench --site [sitename] migrate`
3. Run `bench --site [sitename] build`

**Creating New DocType:**
1. Use Frappe desk UI to create DocType or manually create .json/.py in `ury/ury/doctype/[name]/`
2. Implement controller logic in `[name].py`
3. Add to fixtures in `ury/hooks.py` if needed
4. Run `bench --site [sitename] migrate`

**Modifying Frontend:**
1. Make changes in respective app directory (`pos/`, `urypos/`, `URYMosaic/`)
2. Test with `yarn dev` in that directory
3. Build with `yarn build` or root `yarn build`
4. Run `bench --site [sitename] build` to include in Frappe

**Working with KOT System:**
- KOT generation: `ury/ury/api/ury_kot_generate.py`
- KOT validation (cron): `ury/ury/api/ury_kot_validation.py`
- Order numbers: `ury/ury/api/ury_kot_order_number.py`
- KDS display: `ury/ury/api/ury_kot_display.py`

## Branch Strategy

- `develop` - Main development branch (default)
- `v1` - Legacy branch for separate POS/Mosaic/Pulse apps (support ends December 2025)
- Current codebase integrates all apps into single URY app

## Multi-App Context

URY previously consisted of separate apps (POS, Mosaic, Pulse) accessible on v1 branch. Current version (v2+) integrates all functionality into a single Frappe app with multiple frontend SPAs embedded within.
