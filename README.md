# CareerPilot CV Builder

AI-powered CV builder for verified career profiles, Gemini-assisted extraction, job-specific CV generation, editable previews, and PDF/text export.

## Stack

- Next.js App Router
- React and TypeScript
- Tailwind CSS
- PostgreSQL
- Google Gemini API
- Docker Compose

## Local Setup

```bash
npm install
cp .env.example .env
npm run dev
```

The app creates its database tables automatically on first database access. The same schema is also available in `database/schema.sql`.

## Production

Deploy as an isolated Docker app behind Nginx Proxy Manager. The compose file joins the existing `proxy` and `backend` Docker networks and exposes only internal port `3000`.

Do not commit `.env`; put the real database URL, JWT secret, and Gemini API key on the server only.
