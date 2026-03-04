# Finance Tracker

A privacy-first, client-side finance tracker for monitoring your net worth over time across multiple investment and savings accounts.

**Live app:** https://tysonbul.github.io/finance-tracker/

## What it does

- Tracks monthly portfolio values across multiple accounts (TFSA, FHSA, RRSP, RRIF, Non-Registered, Crypto, Cash, and more)
- Displays a net worth dashboard with a line chart showing your total and per-account values over time
- Parses PDF statements to automatically extract the account type, statement period, and portfolio value
- All data is stored locally in your browser — nothing is sent to any server

## Supported institutions

- **Wealthsimple** — investment accounts (TFSA, FHSA, RRSP, RRIF, Non-Registered, Crypto) and chequing statements are auto-detected and parsed
- Any other institution — upload a PDF and manually select from detected dollar amounts

## How to use

### Adding data

1. Click **Upload Statement** in the sidebar
2. Select a PDF statement from your financial institution
3. The app will attempt to auto-detect the institution, account type, statement period, and portfolio value
4. Review the detected values and confirm (or adjust if needed)
5. If it's a new account, give it a name — existing accounts are matched automatically

### Navigation

- **Dashboard** — net worth chart over time + a summary card for each account
- **Accounts** — manage all accounts, view per-account history, upload statements
- **Data** — export your data as JSON, import a previous backup, or clear all data

### Backup & restore

Use the **Data** page to export your history as a JSON file. You can import it back at any time to restore your data (useful when switching browsers or devices).

## Running locally

```bash
npm install
npm run dev
```

Open http://localhost:5173/finance-tracker/

## Tech stack

- React + TypeScript + Vite
- Tailwind CSS
- pdfjs-dist (browser-side PDF parsing)
- recharts (charting)
- localStorage (persistence)
