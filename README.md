# BigQuery Release Notes Explorer 🚀

A sleek, responsive, and modern web application built with **Python Flask** and **Vanilla HTML, CSS, and JavaScript** that fetches, parses, and styles Google Cloud's BigQuery release notes. It enables users to browse, search, filter, and customize updates to share on X (formerly Twitter).

---

## 🎨 Features

- **Dynamic Feed Fetching & Parsing**: Periodically downloads the official Google Cloud BigQuery Atom RSS feed, splitting combined entries into distinct update cards (Features, Announcements, Fixes, Deprecations, etc.).
- **Smart Backend Caching**: Prevents excessive network requests by caching feed results locally for 1 hour, with a manual force-refresh bypass.
- **Premium Glassmorphic Dark UI**: Utilizes modern CSS custom properties, backdrop filters, custom typography (Outfit & Inter), radial glowing gradients, and smooth animation transitions.
- **Instant Search & Category Filters**: Responsive keyword search and type-specific filter chips allow users to find specific updates instantly.
- **Tweet Composer Modal**: 
  - Generates polished drafts for any release note.
  - Interactive mock Twitter/X card preview.
  - Custom SVG character progress indicator (up to 280 characters).
  - One-click copy utility with temporary "Copied!" checkmark feedback.
  - Direct integration with **X (Twitter) Web Intent** for sharing.

---

## 🛠️ Tech Stack

- **Backend**: Python 3.14.6+, Flask 3.1.3+, Requests
- **Frontend**: Vanilla HTML5, Vanilla CSS3 (Custom Variables, Flexbox, Grid), Vanilla ES6 JavaScript (Async/Fetch API)

---

## 🚀 Getting Started

### Prerequisites

- Python 3.x
- pip (Python package installer)

### Setup & Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/surelyravi/antigravity-event-talks-app.git
   cd antigravity-event-talks-app
   ```

2. **Set up a virtual environment**:
   ```bash
   python -m venv .venv
   ```

3. **Activate the virtual environment**:
   - **Windows (PowerShell)**:
     ```powershell
     .venv\Scripts\Activate.ps1
     ```
   - **macOS/Linux**:
     ```bash
     source .venv/bin/activate
     ```

4. **Install dependencies**:
   ```bash
   pip install flask requests
   ```

### Running the Application

1. **Start the Flask development server**:
   ```bash
   python app.py
   ```

2. **Access the application**:
   Open your browser and navigate to [http://127.0.0.1:5000](http://127.0.0.1:5000).
