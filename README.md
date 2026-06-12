# The Pitch Report

A production-ready **article platform** built with FastAPI, following the Absolute AI Assistant architecture.

## Features

- 🔑 **JWT Authentication** — Secure admin login with bcrypt password hashing
- 📰 **Full Article CRUD** — Create, read, update, delete articles with category filtering
- 📝 **Markdown Support** — Client-side markdown editor with live preview
- 🗄️ **Async SQLAlchemy** — SQLite (dev) / PostgreSQL (prod) via the same interface
- 🎨 **Premium Frontend** — Editorial design with Inter + Merriweather typography
- 📊 **Admin Dashboard** — Stats, article management, and PDF upload

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Copy and configure environment
cp .env.example .env

# Start the server
uvicorn app.main:app --reload --port 8001
```

Open **http://localhost:8001/** for the frontend.
Open **http://localhost:8001/docs** for the interactive Swagger UI.

## Default Admin

- **Email:** `admin@pitchreport.com`
- **Password:** `admin`

## API Flow

```
1. POST /api/v1/auth/register     → Create account
2. POST /api/v1/auth/login        → Get JWT token
3. GET  /api/v1/articles           → List published articles (public)
4. GET  /api/v1/articles/{slug}    → Get single article (public)
5. POST /api/v1/articles           → Create article (auth required)
6. PUT  /api/v1/articles/{id}      → Update article (auth required)
7. DELETE /api/v1/articles/{id}    → Delete article (auth required)
8. GET  /api/v1/articles/stats     → Dashboard stats (auth required)
```

## Architecture

```
Request → Auth (JWT) → API Router → SQLAlchemy ORM → Response
                                         ↓
                                    SQLite / PostgreSQL
```

## Project Structure

```
article-api/
├── app/
│   ├── main.py              # FastAPI entrypoint
│   ├── config.py             # pydantic-settings
│   ├── database.py           # Async SQLAlchemy
│   ├── api/
│   │   ├── deps.py           # Auth dependency
│   │   ├── auth.py           # Login / register
│   │   └── articles.py       # Article CRUD
│   ├── core/
│   │   └── security.py       # JWT + password hashing
│   ├── models/
│   │   ├── user.py
│   │   └── article.py
│   └── schemas/
│       ├── user.py
│       └── article.py
├── static/                    # Frontend files
│   ├── index.html
│   ├── article.html
│   ├── admin.html
│   ├── site.css
│   ├── site.js
│   ├── admin.js
│   └── markdown-parser.js
├── .env.example
├── .gitignore
├── requirements.txt
└── README.md
```

## Tech Stack

- **FastAPI** — Async web framework
- **SQLAlchemy** (async) — ORM with SQLite/PostgreSQL
- **JWT** — Stateless authentication
- **Pydantic** — Request/response validation
- **Vanilla JS** — Frontend with no framework dependencies

## License

MIT
