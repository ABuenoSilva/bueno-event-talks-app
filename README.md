# BigQuery Release Notes Web Application

A lightweight, responsive web application built with **Python Flask** and **plain vanilla HTML, CSS, and JavaScript** that fetches and parses the official [BigQuery Release Notes Atom Feed](https://docs.cloud.google.com/feeds/bigquery-release-notes.xml), displays formatted updates, and allows selecting any individual release update to compose and publish a tweet directly on 𝕏 / Twitter.

---

## ✨ Features

- **Live Atom Feed Ingestion**: Connects directly to `https://docs.cloud.google.com/feeds/bigquery-release-notes.xml` to parse release dates, update categories, formatted content, and reference documentation links.
- **Refresh Button with Spinner**: One-click refresh with animated SVG/CSS spinner to reload and fetch the latest feed data on demand, with in-memory caching to prevent excessive upstream polling.
- **Select & Tweet Any Update**:
  - Click on any update card or the **"Select to Tweet"** button to load the update into the sticky **Tweet Composer**.
  - Automatically formats a tweet draft with the update category, summary, date, link, and hashtags.
  - Real-time character counter and progress meter (warns if approaching or exceeding 280 characters).
  - Quick hashtag toggles (`#BigQuery`, `#GoogleCloud`, `#GCP`, `#DataEngineering`, `#GenAI`, `#SQL`).
  - **"Tweet on 𝕏"** button opens the official Twitter Web Intent (`https://twitter.com/intent/tweet?text=...`) in a new window with pre-filled content.
  - One-click **"Copy Text"** button with toast notifications.
- **Search & Category Filters**:
  - Instant client-side search across update summaries, headings, and SQL syntax keywords.
  - Filter pills with live item count badges for categories: `All`, `Feature`, `Security`, `Breaking`, `Change`, `Announcement`.
- **Pure Vanilla Stack**: Zero front-end frameworks (no React, no Vue, no jQuery, no Bootstrap). Built with standard ES6 JavaScript, HTML5, and CSS3.

---

## 📁 Project Structure

```text
bq-releases-notes/
├── app.py                 # Flask web application and API endpoints
├── feed_parser.py         # Google Cloud Atom XML feed parser & tweet formatter
├── requirements.txt       # Python dependencies (Flask, requests)
├── .gitignore             # Git ignore file for Python & virtual environment
├── README.md              # Project documentation
├── templates/
│   └── index.html         # Plain vanilla HTML5 UI layout
└── static/
    ├── css/
    │   └── style.css      # Vanilla CSS3 styling, animations, and responsive layout
    └── js/
        └── app.js         # Vanilla ES6 JavaScript for fetching, filtering, and tweeting
```

---

## 🚀 Quickstart

### 1. Prerequisites
- Python 3.10+ installed

### 2. Set Up Virtual Environment & Dependencies

If you haven't created the virtual environment yet:

```bash
# Create virtual environment
python -m venv .venv

# Install dependencies
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

### 3. Run the Web Application

To start the application, run:

```powershell
.\.venv\Scripts\python.exe app.py
```

*(On macOS / Linux: `./.venv/bin/python app.py`)*

Once running, open your browser and navigate to:
```
http://127.0.0.1:5000
```

---

## 🛠️ API Endpoints

- `GET /`: Serves the web application interface.
- `GET /api/feed`: Returns parsed BigQuery release notes in JSON format.
  - `?refresh=true`: Forces a fresh re-fetch bypassing the in-memory cache.
