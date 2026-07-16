# ARKIB Bar Management System — User Manual

**Version:** 1.0  
**Last Updated:** June 2026

---

## Table of Contents

1. [Overview](#1-overview)
2. [Daily Workflow](#2-daily-workflow)
3. [Dashboard](#3-dashboard)
4. [Bar Inventory](#4-bar-inventory)
   - [Overview Tab](#41-overview)
   - [Spirits](#42-spirits)
   - [Infusions](#43-infusions)
   - [Premixes](#44-premixes)
   - [Activity Log](#45-activity-log)
   - [End of Night (EON)](#46-end-of-night-eon)
   - [Receive Stock](#47-receive-stock)
5. [Sales](#5-sales)
6. [Expenses](#6-expenses)
7. [Profit & Loss (P&L)](#7-profit--loss-pl)
8. [Inventory](#8-inventory)
9. [Cocktails](#9-cocktails)
10. [Staff & Salary](#10-staff--salary)
11. [Shifts](#11-shifts)
12. [Receipts](#12-receipts)
13. [Partners](#13-partners)
14. [Suppliers](#14-suppliers)
15. [Rent & Fixed Costs](#15-rent--fixed-costs)
16. [Reports](#16-reports)
17. [Settings](#17-settings)
18. [Roles & Access](#18-roles--access)
19. [Frequently Asked Questions](#19-frequently-asked-questions)

---

## 1. Overview

ARKIB is a bar management system that handles:

- **Inventory** — spirits, infusions, premixes, and general stock
- **Sales** — end-of-night recording, daily revenue tracking
- **Finance** — expenses, P&L, rent, partners
- **People** — staff, shifts, payroll, salary
- **Operations** — cocktail costing, supplier management, receipts

The system is designed so that most data entry happens in two places:
- **Activity Log** (Bar Inventory tab) — when something is *made* (infusions, premixes)
- **End of Night** (Bar Inventory tab) — when sales for the night are recorded

Everything else (expenses, stock deliveries, payroll) has a dedicated section.

---

## 2. Daily Workflow

### During Operations
| Task | Where to do it |
|------|---------------|
| New infusion produced | Bar Inventory → Activity Log → **Infusion Made** |
| New premix batch produced | Bar Inventory → Activity Log → **Premix Made** |
| Stock delivery arrived | Bar Inventory → **Receive Stock** |

### End of Night (Every night)
1. Go to **Bar Inventory → End of Night**
2. Key in quantities sold for each:
   - House cocktails (by premix)
   - Classic cocktails (optionally fill in spirits used per serve)
   - Wine sold (by bottle)
   - Whisky sold (by bottle)
3. Review the revenue and COGS summary
4. Hit **Submit** — this automatically:
   - Creates a cocktail sales record
   - Updates daily sales totals
   - Deducts premix serves from stock
   - Deducts spirit volume for classics
   - Deducts wine/whisky bottles from stock

5. Go to **Sales** and fill in the full night revenue breakdown (cash, credit card, QR, food, beer, etc.) to reconcile the night

### Weekly / Monthly
| Task | Where |
|------|-------|
| Log expenses (suppliers, utilities, wages) | Expenses |
| Mark fixed costs as paid | Rent & Fixed Costs |
| Log staff attendance | Salary or Shifts |
| Process payroll | Salary or Shifts → Payroll |
| Review P&L | Profit & Loss |
| Receive stock delivery | Bar Inventory → Receive Stock |

---

## 3. Dashboard

The Dashboard shows at-a-glance metrics for the current month.

| Card | What it shows |
|------|--------------|
| Today's Sales | Total revenue today, number of transactions, balance status |
| Monthly Revenue | Total sales collected this month |
| Monthly Expenses | Total expenses logged this month |
| Net Profit | Revenue minus expenses (month to date) |
| Revenue Target | Progress bar toward your monthly revenue goal |
| Low Stock Alerts | Premixes and ingredients running low |
| Revenue Chart | Last 30 days daily revenue trend |
| Sales Mix | Cocktail vs beer vs food breakdown (last 7 days) |
| Expense Breakdown | Pie chart of expenses by category |

> **Tip:** Set your monthly revenue target in **Settings** so the progress bar is meaningful.

---

## 4. Bar Inventory

This is the central operations hub. It has 8 tabs.

---

### 4.1 Overview

A quick-glance snapshot of the week:
- Week number and date range
- Which premixes are **LOW** or **OK**
- This week's cocktail sales count
- Low stock alerts for spirits and premixes

---

### 4.2 Spirits

Tracks every bottle of spirit you carry.

**Fields per spirit:**
- Name, Category (Whisky, Gin, Rum, Vodka, Tequila, Brandy, Liqueur, Wine, Beer, Vermouth, Bitters, Other)
- Full bottles (unopened)
- Open bottle volume (ml)
- Used for classics (ml deducted when you submit EON with classic cocktails)

**Actions:**
- **Search** — filter by name
- **Category filter** — narrow by spirit type
- **Edit** — click the edit icon on any row to adjust volumes manually

> **Note:** Spirit volumes are deducted automatically when you submit End of Night (for classic cocktails) or log a Premix Made / Infusion Made activity.

---

### 4.3 Infusions

Tracks house infusions (spirits infused with botanicals, fruit, etc.).

**Fields:**
- Opening volume (ml), Produced this week, Used, Wasted
- Base spirit association
- Serves available (calculated from remaining ml ÷ ml per serve)

**Actions:**
- **Edit** — manually adjust opening/produced/used/wasted volumes

> When you log an **Infusion Made** in the Activity Log, the produced volume updates automatically.

---

### 4.4 Premixes

Tracks pre-made cocktail batches.

**Fields:**
- Opening serves, Produced serves, Sold serves
- ML per serve, Storage location
- Status: **ON MENU** (sufficient stock) or **LOW** (running out)

**Actions:**
- **Edit** — adjust serve counts
- Status updates automatically based on remaining serves

> Sold serves are deducted automatically each time you submit an **End of Night**.

---

### 4.5 Activity Log

Records production activities — what was **made** in the bar.

**Activity Types:**
| Type | Use when |
|------|---------|
| Infusion Made | A new infusion batch is produced |
| Premix Made | A new premix batch is produced |

**What it records:**
- Timestamp, product name, quantity (batches/serves)
- Spirits used and volumes deducted
- Notes

**Actions:**
- **Edit** — modifies inventory figures retroactively
- **Delete** — reverses the inventory changes that entry caused

> **Important:** The Activity Log is for *production* only. Sales are recorded in **End of Night**. Stock deliveries go in **Receive Stock**.

---

### 4.6 End of Night (EON)

This is where you record everything *sold* in a night. Submit once per night after closing.

**Sections:**

#### House Cocktails
- Each row shows a cocktail (linked to a premix)
- Use **+/−** buttons to enter quantity sold
- System shows price and COGS per cocktail

#### Classic Cocktails
- Each row shows a classic on your menu
- Use **+/−** to enter quantity sold
- When qty > 0, an optional **Spirits used** panel appears below the row
  - Enter up to 3 spirits with ml-per-serve for each
  - This deducts spirit volume from your bar_spirits when you submit
  - Leave blank if you don't want to track spirit deduction for that classic

#### Wine / Whisky
- Enter bottles sold per wine/whisky item on menu
- System deducts full bottles from spirit stock on submit

#### Summary Panel
Before submitting, you'll see:
- Total Revenue
- Estimated COGS
- Gross Profit and Margin %
- Number of transactions

#### Submit
Clicking **Submit End of Night** does all of the following in one step:
1. Creates cocktail_sales records for each item sold
2. Updates daily_sales for the date
3. Deducts premix sold_serves
4. Deducts spirit ml for classic cocktails (if spirits entered)
5. Deducts full_bottles for wine/whisky sold
6. Resets the EON form for the next night

> **After submitting EON**, go to **Sales** to log the full revenue breakdown (cash, card, food, beer totals) and check that the night balances.

---

### 4.7 Receive Stock

Use this whenever a spirit delivery arrives.

**Steps:**
1. Search for the spirit name in the search box
2. If found, click **+ Add** — set the quantity of bottles received
3. If new product, click **Create new spirit** — fill in name and category
4. Repeat for each item in the delivery
5. Click **Submit Delivery** — full_bottles count updates for all items

You can add as many spirits as needed in one delivery session before submitting.

---

### Managing Menu Items

To add, edit, or remove cocktails from the EON menu:
- Click the **Manage Menu** button (visible in the End of Night tab)
- Add: enter name, category (classic/wine/whisky), price
- Edit: click edit icon on any existing item
- Delete: removes from EON going forward (does not affect historical records)

---

## 5. Sales

Tracks nightly revenue and payment collections.

### Daily Sales Tab

Each row represents one night's trading.

**Fields:**
- Date
- Revenue by type: Cocktails, Beer, Wine, Food, Others
- Collections: Cash, Credit Card, QR Code, Online
- Transaction count
- **Balance status** — shows ✓ Balanced if revenue = collections, or ⚠ Mismatch + the difference amount

**Actions:**
- **New Entry** — add tonight's full revenue and payment breakdown
- **Edit** — correct a previous entry

> **Balance check:** If your revenue and collections don't match, ARKIB shows you exactly how much is off. Investigate cash discrepancies before closing.

### EON History Tab

Shows every End of Night submission, grouped by date.
- View which cocktails were sold and how much revenue each generated
- **Delete** an EON submission if you need to resubmit — this reverses the contribution to daily_sales so you can resubmit the corrected figures

---

## 6. Expenses

Tracks all business expenses.

**Fields:**
- Date incurred, Expense period (for accrual accounting — use this if you incurred the cost in one month but paid in another)
- Category, Amount, Supplier
- Payment method, Notes

**Categories:** Alcohol, Fresh Ingredients, Salary, Claims, Rental, Utilities, Marketing, Equipment, Others

**Actions:**
- **Add Expense** — log a new expense
- **Edit / Delete** — correct or remove entries
- **Filter by category** — view only one expense type
- **Category grid** — shows running total per category

> **Expense Period tip:** If you received a delivery in May but paid for it in June, enter the date as June (when paid) but set **Expense Period** to May. The P&L will attribute the cost to May — the month you actually incurred it.

---

## 7. Profit & Loss (P&L)

Shows month-by-month financial performance.

**Summary table:**
- Each row = one month
- Columns: Revenue, COGS, Expenses, Net Profit, Margin %

**Month detail view:**
Click any month row to see the breakdown:
- Revenue split: Cocktails, Beer, Wine, Food, Others
- Operating expenses split by category
- Net profit and margin

> P&L uses **expense_period** (not payment date) when that field is filled in, giving you accurate accrual-basis reporting.

---

## 8. Inventory

General ingredients tracking (food, garnishes, packaging, etc. — separate from the bar spirits system).

**Fields:**
- Ingredient name, category, unit, bottle/pack size
- Cost per unit, Current stock, Minimum stock level, Supplier

**Actions:**
- **Add ingredient** — create new stock item
- **Log movement:**
  - Added (delivery received)
  - Used (consumed)
  - Wasted (discarded)
  - Adjusted (manually set to a specific qty)
- **Filter: All / Low Stock** — quickly see what needs reordering

Stock history per ingredient is stored for audit purposes.

---

## 9. Cocktails

Recipe builder and costing calculator.

**Fields per cocktail:**
- Name
- Ingredients (from your inventory) with ml per serve
- Selling price
- Supplementary costs: Garnish, Ice, Other

**What the system calculates:**
- Total cost per serve (ingredients + supplementary costs)
- Gross profit (price − cost)
- Profit margin %
- Color coding: Green ≥70%, Amber ≥50%, Red <50%

**Actions:**
- **Create cocktail** — build the recipe and see live cost breakdown
- **Edit** — adjust recipe or price
- **Delete** — remove cocktail
- **Detail view** — full ingredient-level cost breakdown

> Use this section to decide pricing and evaluate which cocktails are most profitable before adding them to your menu.

---

## 10. Staff & Salary

### Staff Page

Manages employee records.

**Fields:** Name, Position, Phone, Email, Start date, Salary type (Hourly or Fixed Monthly), Rate

**Actions:**
- **Add employee**
- **Edit** — update position, rate, contact details
- Toggle employee **active/inactive** (inactive staff are grayed out and excluded from payroll)

### Salary Page

Tracks attendance and calculates monthly payroll.

**Summary cards:**
- Total payroll for the month
- Amount marked as paid
- Outstanding balance

**Logging attendance:**
- Select employee, date, clock-in and clock-out times
- Mark as Public Holiday (applies 1.5× multiplier)
- Add notes (shift type, reason for PH, etc.)

**Payroll calculation:**
- Hourly staff: hours worked × hourly rate
- Fixed staff: monthly salary amount
- PH bonus: PH hours × rate × 0.5 (the 0.5 extra on top of base)

**Actions:**
- **Log attendance** — add a shift
- **Mark as Paid** — records payment in salary_records
- **View per-employee breakdown** — total hours, base, PH bonus, total due

---

## 11. Shifts

Clock-in/clock-out system, separate from the Salary module.

### Clock In/Out Tab
- Staff click **Clock In** at the start of their shift (records timestamp)
- Staff click **Clock Out** at end of shift (records duration)
- Live timer shows current shift duration in progress
- Admin view shows all currently clocked-in staff

### History Tab
- View all completed shifts with duration and calculated pay
- Filter by staff member or month
- **Edit** a shift (correct clock times, rate, or PH status)
- **Delete** a shift
- **Add manually** (admin only) — for shifts that weren't clocked electronically

### Payroll Tab *(Admin only)*
- Select month
- View breakdown per staff: total hours and total pay
- **Export CSV** — full shift data + payroll summary for payroll processing

---

## 12. Receipts

Upload and manage expense receipts.

**Steps to log a receipt:**
1. Click **Upload** and select image (JPG, PNG) or PDF
2. System attempts to auto-extract amount and vendor from the receipt
3. Review extracted data
4. **Link to existing expense** (if you've already logged the expense) OR
   **Create new expense** (pre-filled from OCR data — set category, payment method)
5. Optionally set **Claimed by** to track who submitted it

**Views:** Grid (thumbnail) or List (compact rows)

**Filters:** Search by name, date range, category

**Actions:**
- **Delete** — removes receipt image and DB record
- **Export** — download receipt data

---

## 13. Partners

Tracks profit distribution among business partners.

**Fields per partner:** Name, ownership %, email, phone, join date

**What the system calculates:**
- Each partner's share = ownership % × net profit for the month
- Total ownership % across all partners (alerts if under/over 100%)

**Actions:**
- **Add partner**
- **Edit** details
- **Mark distribution:** Retain (keep in business) or Pay Out
- View monthly P&L summary and each partner's entitlement

---

## 14. Suppliers

Contact directory for all your suppliers.

**Fields:** Name, Category, Contact person, Phone, Email, Payment terms, Address

**Actions:**
- **Add supplier** — create new record
- **Edit** — update contact or payment terms
- Filter by category (Alcohol, Fresh Ingredients, etc.)

> Suppliers listed here appear as dropdown options in Expenses, making expense entry faster.

---

## 15. Rent & Fixed Costs

Tracks recurring monthly obligations.

**Fields per item:** Name, Category, Amount (RM), Due day of month, Notes

**Categories:** Rental, Electricity, Water, Internet, Software, License, Insurance, Other

**Summary cards:**
- Total fixed costs per month
- Paid total
- Unpaid total

**Actions:**
- **Add fixed cost** — set up a new recurring item
- **Mark as Paid** — logs payment record with date
- View which items are paid vs unpaid this month with color indicators

---

## 16. Reports

Auto-generated business insights for the selected month.

**Sections:**
- Monthly P&L (Revenue, Expenses, Net Profit, Margin)
- Revenue breakdown by type
- Expense breakdown by category
- **Cocktail Performance** — margin % per cocktail with visual bars
- **Auto-insights:**
  - Best and worst performing day of week
  - Weekend vs weekday revenue comparison
  - Highest expense category
  - Highest and lowest margin cocktails

**Actions:**
- Select month to analyze
- **Print / Export** the report

---

## 17. Settings

Configure system-wide options.

**Account:**
- View your display name, email, and role badge

**Monthly Targets:**
- Set **Revenue Target (RM)** for any month/year
- Set **Expense Budget (RM)**
- These feed the Dashboard's progress bar and Reports

**System Info:**
- Version, database status, currency (RM)

---

## 18. Roles & Access

| Role | Access |
|------|--------|
| **Admin** | Full access to all pages and all actions |
| **Manager** | Access to operations (inventory, sales, expenses, staff) — no partner/P&L financials |
| **Staff** | Clock in/out, view own shifts only |
| **Investor** | P&L tab only — read-only view of financial performance |

Role is assigned when the account is created. Contact your Admin to change a role.

---

## 19. Frequently Asked Questions

**Q: I submitted End of Night with the wrong quantities. How do I fix it?**  
Go to **Sales → EON History**, find the date, and click **Delete** on that submission. This reverses all stock deductions and removes the daily_sales entry. Then go back to **Bar Inventory → End of Night** and resubmit with the correct figures.

**Q: A spirit delivery arrived but it's a brand we haven't stocked before. How do I add it?**  
Go to **Bar Inventory → Receive Stock**, type the name in the search box. If it doesn't appear, click **Create new spirit**, fill in the name and category, then enter the bottle quantity and submit.

**Q: Why don't I need to log sales in Activity Log anymore?**  
Sales (cocktail sold, wine sold, classic cocktails sold) are all handled through **End of Night**. The Activity Log is only for production activities — making infusions and premixes. This was simplified to avoid entering the same data twice.

**Q: An expense was incurred in May but I'm paying it in June. How do I handle this?**  
Log it in **Expenses** with today's date (June) as the date paid, but set **Expense Period** to May. The P&L will count it against May's results — the month you actually incurred the cost.

**Q: How do I add a new cocktail to the End of Night menu?**  
Go to **Bar Inventory → End of Night** and click **Manage Menu**. Add the cocktail name, select its category (classic, wine, or whisky), and set the price. It will appear in the EON list from the next time you open it.

**Q: My revenue and collections don't balance in Sales. What do I do?**  
The **⚠ Mismatch** badge shows the exact difference. Check: (a) that all payment types were entered correctly, (b) whether a complimentary or voided transaction was missed, (c) whether there's a float discrepancy in cash. Edit the entry once you've identified the cause.

**Q: How do I track which spirits are used in classic cocktails?**  
When you enter a classic cocktail in **End of Night** and set qty > 0, a **Spirits used (ml per serve)** section appears below it. Select the spirit from the dropdown and enter how many ml per serve it uses (for up to 3 spirits). This is optional — leave blank if you don't need to track spirit deduction for that classic.

**Q: Where do I see profit sharing for each partner?**  
Go to **Partners**. Each partner's row shows their ownership % and their share of the current month's net profit. Use **Mark distribution** to record whether the amount was retained or paid out.

---

*For technical support or bug reports, contact your system administrator.*
