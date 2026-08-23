# Yutrixa — Business Website

AI Solutions | Automation | Digital Growth

A full-stack business website for Yutrixa, built with plain HTML5, CSS3,
vanilla JavaScript, Node.js and Express.js — no frontend frameworks.

## What's included

- Marketing pages: Home, Services, Work, About, Careers, Contact
- A real, working **AI Appointment Booking Assistant** (`/book`) backed by a
  REST API and JSON file storage
- A floating **Yutrixa AI Assistant** chatbot on every page, powered by the
  Gemini API with a built-in local fallback (works with zero configuration)
- Contact and Careers forms with server-side validation and storage
- A password-protected **Admin dashboard** (`/admin`) for managing appointments

## Getting started

```bash
npm install
cp .env.example .env
npm start
```

The site runs at **http://localhost:3000**.

### Environment variables (`.env`)

| Variable          | Required | Description                                                                 |
|-------------------|----------|-------------------------------------------------------------------------------|
| `PORT`            | No       | Port the server runs on (default `3000`)                                     |
| `GEMINI_API_KEY`  | No       | Your Google Gemini API key. If omitted, the chatbot uses a local fallback.   |
| `GEMINI_MODEL`    | No       | Gemini model name (default `gemini-1.5-flash`)                               |
| `ADMIN_PASSWORD`  | Yes      | Password to access `/admin`. Defaults to `changeme123` — change this.        |

The Gemini API key is **only ever used server-side** and is never exposed to
the browser.

## Project structure

```
yutrixa/
├── server.js              Express server + REST API
├── package.json
├── .env.example
├── public/
│   ├── index.html, services.html, work.html, about.html,
│   │   careers.html, contact.html, book.html, admin.html
│   ├── css/style.css
│   ├── js/
│   │   ├── main.js         nav, active links, reveal animation
│   │   ├── chatbot.js       floating AI assistant widget
│   │   ├── booking.js       booking assistant (chat + calendar)
│   │   ├── contact.js       contact form submission
│   │   └── careers.js       careers form submission
│   └── assets/
└── data/
    ├── appointments.json
    ├── contact.json
    └── careers.json
```

## API endpoints

**Appointments**
- `POST /api/appointments` — create an appointment (public)
- `GET /api/appointments` — list all appointments (admin only, header `x-admin-password`)
- `GET /api/appointments/:id` — get one appointment (admin only)
- `PATCH /api/appointments/:id` — update status, e.g. cancel (admin only)
- `DELETE /api/appointments/:id` — delete an appointment (admin only)
- `GET /api/availability?date=YYYY-MM-DD` — public, returns open/taken time slots

**Other**
- `POST /api/contact` — submit the contact form
- `POST /api/careers` — submit a careers application
- `POST /api/chat` — chatbot endpoint (Gemini or local fallback)
- `POST /api/admin/login` — verify the admin password

## Notes

- Appointments, contact submissions and careers applications are stored in
  local JSON files under `data/` for this initial version. The files are
  created automatically on first run.
- Double-booking the same date/time is prevented server-side.
- All portfolio items on `/work` are explicitly labeled **Demo Prototype** —
  there are no fabricated clients, testimonials, or results anywhere on the site.
