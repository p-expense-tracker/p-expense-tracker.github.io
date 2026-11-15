# Expense Tracker

A personal expense tracker dashboard built with plain HTML, CSS and JavaScript. No build step, no dependencies.

## Files

- `index.html` – page structure (dashboard, transactions, analytics, categories, settings, add/edit modal)
- `style.css` – dark theme and responsive layout
- `script.js` – all app logic (data, charts, filters, import/export)
- `favicon.svg` – tab icon

## Features

- Add, edit and delete income and expense transactions
- Dashboard: total balance, income, expenses with month-over-month change
- 6-month spending bar chart and expenses-by-category donut chart
- Search, filter (type, category, month) and sort transactions
- Analytics: savings rate, average daily spend, income vs expenses, top categories
- Custom categories with colours
- Monthly budget with progress bar in the sidebar
- Export CSV, backup/restore JSON
- Data is saved in the browser (localStorage); nothing leaves the device

## Run locally

Open `index.html` in a browser, or serve the folder:

```
python3 -m http.server 8000
```

## Deploy

Upload the folder to any static host (Netlify, Vercel, GitHub Pages, Cloudflare Pages). The entry point is `index.html`.

## Notes

- First launch loads sample data. Use **Settings → Delete all data** to start clean.
- Data is per browser and per device. Use Settings → Backup to move it.
