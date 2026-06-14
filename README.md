# BigQuery Release Notes Tracker & X/Twitter Sharer

A modern, high-fidelity web application built with **Python Flask** and **vanilla HTML, JavaScript, and CSS** to fetch, search, filter, and share Google BigQuery release notes.

The application automatically reads Google Cloud's official Atom release notes feed, parses raw HTML entries into individual, granular update cards (splitting multiple daily features/announcements), and features a visual X (Twitter) Post Composer to compile and publish updates.

---

## ✨ Features

- **🚀 Live Atom XML Parser**: Fetches Google Cloud's BigQuery releases feed and structures daily entries.
- **✂️ Heading-based Card Splitter**: Automatically divides consolidated daily release notes into distinct cards based on category headings (`Feature`, `Deprecation`, `Changed`, `Resolved`, `Note`).
- **💾 Smart JSON Cache**: Prevents rate-limiting and speeds up page load times by caching parsed updates locally (`notes_cache.json`). The cache invalidates after 1 hour. If offline, the app handles network errors gracefully and displays cached data.
- **🎨 Premium Dark & Light UI**: Sleek, modern dark-centric interface (default) with a fluid light mode toggle, smooth hover transitions, and skeleton shimmer loaders.
- **🔍 Real-Time Search & Filtering**: Instantly search the feed by text or filter cards by clicking category filter pills.
- **🐦 Interactive X (Twitter) Composer Drawer**:
  - Select an individual update or compile multiple cards into a thread.
  - Dynamically draft tweets in **Standard**, **Professional**, or **Excited 🚀** tones.
  - Quick-tap hashtag pills (`#BigQuery`, `#GoogleCloud`).
  - Circular SVG progress ring tracking character limits (warns at 20 characters remaining, turns red/blocks post button if above 280).
  - High-fidelity visual mock of an X/Twitter post showing live formatting (hashtags/links highlighted in blue).
  - One-click copy-to-clipboard or direct redirection to X's Share Intent (`https://twitter.com/intent/tweet`).

---

## 📂 Project Directory Structure

```text
bigquery_release_notes/
├── app.py                  # Flask backend (fetching, parsing, cache, routes)
├── requirements.txt        # Backend dependencies
├── README.md               # Project documentation
├── .gitignore              # Files ignored by git
├── notes_cache.json        # Saved local cache (created at runtime)
├── templates/
│   └── index.html          # Semantic HTML page structure
└── static/
    ├── css/
    │   └── style.css       # Complete layout styling and themes
    └── js/
        └── main.js         # State management, API queries, X composer logic
```

---

## 🛠️ Installation & Getting Started

### Prerequisites
- Python 3.8 or higher installed on your system.

### 1. Clone or Navigate to the Directory
```bash
cd /Users/nicolaslauffer/agy-cli-projects/bigquery_release_notes
```

### 2. Create and Activate a Virtual Environment
```bash
# Create venv
python3 -m venv venv

# Activate venv (macOS/Linux)
source venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Run the Development Server
```bash
python app.py
```

Open your browser and navigate to:
👉 **[http://127.0.0.1:5001](http://127.0.0.1:5001)**

---

## 📡 Backend API Endpoints

- **`GET /`**: Renders the main dashboard page.
- **`GET /api/notes`**: Returns structured release notes.
  - **Query Parameters**:
    - `refresh=true`: Bypasses the local cache, forces a live XML fetch from Google's servers, and updates the local cache file.

---

## 💻 Tech Stack

- **Backend**: Python, Flask, Beautiful Soup 4 (HTML parsing), Requests, ElementTree (XML parsing).
- **Frontend**: Vanilla HTML5, Vanilla CSS3 (Custom Variables, CSS Grid/Flexbox), Vanilla ES6+ JavaScript.
- **Icons & Typography**: Google Fonts (Inter & Outfit), Material Symbols.

---

## 📄 License
This project is open-source and available under the MIT License.
