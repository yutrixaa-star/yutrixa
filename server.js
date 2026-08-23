/**
 * Yutrixa - Express server
 * Serves the static site, appointment booking API, contact form API,
 * careers application API, and the AI chatbot API (Gemini + local fallback).
 */

require('dotenv').config();
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');


const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme123';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

/* ----------------------------------------------------------------------- */
/* Data storage helpers (local JSON files - simple demo persistence layer) */
/* ----------------------------------------------------------------------- */

const DATA_DIR = path.join(__dirname, 'data');
const FILES = {
  appointments: path.join(DATA_DIR, 'appointments.json'),
  contact: path.join(DATA_DIR, 'contact.json'),
  careers: path.join(DATA_DIR, 'careers.json')
};

function ensureDataFiles() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  Object.values(FILES).forEach((file) => {
    if (!fs.existsSync(file)) fs.writeFileSync(file, '[]', 'utf8');
  });
}
ensureDataFiles();

function readJSON(file) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (err) {
    console.error('Failed to read', file, err);
    return [];
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ----------------------------------------------------------------------- */
/* Validation / sanitization helpers                                       */
/* ----------------------------------------------------------------------- */

function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>]/g, '').trim().slice(0, 1000);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone) {
  return /^[0-9+\-\s()]{7,20}$/.test(phone);
}

function isValidDate(dateStr) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !isNaN(new Date(dateStr).getTime());
}

/* ----------------------------------------------------------------------- */
/* Admin auth middleware (simple env-var password, header based)           */
/* ----------------------------------------------------------------------- */

function requireAdmin(req, res, next) {
  const supplied = req.headers['x-admin-password'] || req.query.password;
  if (supplied && supplied === ADMIN_PASSWORD) return next();
  return res.status(401).json({ success: false, error: 'Invalid or missing admin password.' });
}

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (password && password === ADMIN_PASSWORD) {
    return res.json({ success: true });
  }
  return res.status(401).json({ success: false, error: 'Incorrect password.' });
});

/* ----------------------------------------------------------------------- */
/* Appointments API                                                        */
/* ----------------------------------------------------------------------- */

const VALID_SERVICES = [
  'Consultation',
  'AI Automation',
  'Web Development',
  'Custom Software',
  'Other'
];

const VALID_TIMES = ['10:00 AM', '11:30 AM', '2:00 PM', '4:00 PM'];

// Public: get taken slots for a given date (no personal data leaked)
app.get('/api/availability', (req, res) => {
  const { date } = req.query;
  if (!date || !isValidDate(date)) {
    return res.status(400).json({ success: false, error: 'A valid date (YYYY-MM-DD) is required.' });
  }
  const appointments = readJSON(FILES.appointments);
  const taken = appointments
    .filter((a) => a.date === date && a.status !== 'cancelled')
    .map((a) => a.time);
  const available = VALID_TIMES.filter((t) => !taken.includes(t));
  res.json({ success: true, date, allSlots: VALID_TIMES, taken, available });
});

// Public: create appointment
app.post('/api/appointments', (req, res) => {
  const body = req.body || {};
  const name = sanitize(body.name);
  const email = sanitize(body.email);
  const phone = sanitize(body.phone);
  const company = sanitize(body.company);
  const service = sanitize(body.service);
  const message = sanitize(body.message);
  const date = sanitize(body.date);
  const time = sanitize(body.time);

  const errors = [];
  if (!name || name.length < 2) errors.push('Please provide your full name.');
  if (!email || !isValidEmail(email)) errors.push('Please provide a valid email address.');
  if (!phone || !isValidPhone(phone)) errors.push('Please provide a valid phone number.');
  if (!service || !VALID_SERVICES.includes(service)) errors.push('Please select a valid service.');
  if (!date || !isValidDate(date)) errors.push('Please select a valid date.');
  if (!time || !VALID_TIMES.includes(time)) errors.push('Please select a valid time slot.');

  if (errors.length) {
    return res.status(400).json({ success: false, error: errors.join(' ') });
  }

  const appointments = readJSON(FILES.appointments);

  const duplicate = appointments.find(
    (a) => a.date === date && a.time === time && a.status !== 'cancelled'
  );
  if (duplicate) {
    return res.status(409).json({
      success: false,
      error: 'That time slot has just been booked by someone else. Please choose another time.'
    });
  }

  const appointment = {
    id: genId(),
    name,
    email,
    phone,
    company,
    service,
    message,
    date,
    time,
    status: 'confirmed',
    createdAt: new Date().toISOString()
  };

  appointments.push(appointment);
  writeJSON(FILES.appointments, appointments);

  res.status(201).json({ success: true, appointment });
});

// Admin only: list all appointments
app.get('/api/appointments', requireAdmin, (req, res) => {
  const appointments = readJSON(FILES.appointments).sort(
    (a, b) => new Date(a.date + ' ' + a.time) - new Date(b.date + ' ' + b.time)
  );
  res.json({ success: true, appointments });
});

// Admin only: get single appointment
app.get('/api/appointments/:id', requireAdmin, (req, res) => {
  const appointments = readJSON(FILES.appointments);
  const appointment = appointments.find((a) => a.id === req.params.id);
  if (!appointment) return res.status(404).json({ success: false, error: 'Appointment not found.' });
  res.json({ success: true, appointment });
});

// Admin only: update status (cancel)
app.patch('/api/appointments/:id', requireAdmin, (req, res) => {
  const appointments = readJSON(FILES.appointments);
  const idx = appointments.findIndex((a) => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'Appointment not found.' });
  const { status } = req.body || {};
  if (!['confirmed', 'cancelled'].includes(status)) {
    return res.status(400).json({ success: false, error: 'Invalid status value.' });
  }
  appointments[idx].status = status;
  writeJSON(FILES.appointments, appointments);
  res.json({ success: true, appointment: appointments[idx] });
});

// Admin only: delete appointment
app.delete('/api/appointments/:id', requireAdmin, (req, res) => {
  const appointments = readJSON(FILES.appointments);
  const next = appointments.filter((a) => a.id !== req.params.id);
  if (next.length === appointments.length) {
    return res.status(404).json({ success: false, error: 'Appointment not found.' });
  }
  writeJSON(FILES.appointments, next);
  res.json({ success: true });
});

/* ----------------------------------------------------------------------- */
/* Contact form API                                                        */
/* ----------------------------------------------------------------------- */

app.post('/api/contact', (req, res) => {
  const body = req.body || {};
  const name = sanitize(body.name);
  const email = sanitize(body.email);
  const phone = sanitize(body.phone);
  const company = sanitize(body.company);
  const service = sanitize(body.service);
  const budget = sanitize(body.budget);
  const message = sanitize(body.message);

  const errors = [];
  if (!name || name.length < 2) errors.push('Please provide your name.');
  if (!email || !isValidEmail(email)) errors.push('Please provide a valid email address.');
  if (!message || message.length < 5) errors.push('Please provide a short message.');

  if (errors.length) {
    return res.status(400).json({ success: false, error: errors.join(' ') });
  }

  const submissions = readJSON(FILES.contact);
  const entry = {
    id: genId(),
    name,
    email,
    phone,
    company,
    service,
    budget,
    message,
    createdAt: new Date().toISOString()
  };
  submissions.push(entry);
  writeJSON(FILES.contact, submissions);
  fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${RESEND_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    from: "Yutrixa <onboarding@resend.dev>",
    to: ["yutrixaa@gmail.com"],
    reply_to: email,
    subject: `New Contact Form - ${name}`,
    html: `
      <h2>New Contact Enquiry</h2>
      <p><b>Name:</b> ${name}</p>
      <p><b>Email:</b> ${email}</p>
      <p><b>Phone:</b> ${phone}</p>
      <p><b>Company:</b> ${company}</p>
      <p><b>Service:</b> ${service}</p>
      <p><b>Budget:</b> ${budget}</p>
      <p><b>Message:</b> ${message}</p>
    `,
  }),
}).catch(console.error);

  res.status(201).json({ success: true, message: 'Thanks — your message has been received. We will get back to you shortly.' });
});

/* ----------------------------------------------------------------------- */
/* Careers application API                                                 */
/* ----------------------------------------------------------------------- */

app.post('/api/careers', (req, res) => {
  const body = req.body || {};
  const name = sanitize(body.name);
  const email = sanitize(body.email);
  const linkedin = sanitize(body.linkedin);
  const portfolio = sanitize(body.portfolio);
  const primarySkill = sanitize(body.primarySkill);
  const experience = sanitize(body.experience);
  const resume = sanitize(body.resume);
  const message = sanitize(body.message);
  const role = sanitize(body.role);

  const errors = [];
  if (!name || name.length < 2) errors.push('Please provide your name.');
  if (!email || !isValidEmail(email)) errors.push('Please provide a valid email address.');
  if (!primarySkill) errors.push('Please provide your primary skill.');

  if (errors.length) {
    return res.status(400).json({ success: false, error: errors.join(' ') });
  }

  const applications = readJSON(FILES.careers);
  const entry = {
    id: genId(),
    name,
    email,
    linkedin,
    portfolio,
    primarySkill,
    experience,
    resume,
    message,
    role,
    createdAt: new Date().toISOString()
  };
  applications.push(entry);
  writeJSON(FILES.careers, applications);

  res.status(201).json({ success: true, message: 'Thanks for your interest — we will review your details and be in touch.' });
});

/* ----------------------------------------------------------------------- */
/* AI Chatbot API - Gemini with local fallback                             */
/* ----------------------------------------------------------------------- */

const SYSTEM_CONTEXT = `You are the Yutrixa AI Assistant, embedded on the Yutrixa company website.
Yutrixa is a technology solutions company offering: AI Agents, AI Automation, Workflow Automation,
Web Development, Email Marketing, Social Media Management, LinkedIn Management, E-commerce Solutions,
Business Process Automation, and Custom Digital Solutions. Yutrixa works with startups, SMEs and
growing businesses, delivering through a flexible specialist delivery network.
Rules:
- Answer the user's actual question directly and concisely (2-4 sentences for normal answers).
- Ask a relevant follow-up question when helpful.
- Never invent clients, results, statistics, awards or testimonials - Yutrixa's current portfolio
  consists of demo prototypes only.
- If asked about booking, point the user to the /book page.
- If asked about contacting the team, point the user to the /contact page.
- Keep a professional, helpful, and friendly tone.`;

// Very small local knowledge base used when no Gemini key is configured,
// or if the Gemini request fails for any reason.
function localFallbackResponse(message, history) {
  const msg = (message || '').toLowerCase();

  const has = (...words) => words.some((w) => msg.includes(w));

  if (has('hello', 'hi', 'hey')) {
    return "Hi! I'm the Yutrixa AI Assistant. I can help with questions about our services, AI automation, or booking a consultation. What would you like to know?";
  }
  if (has('service', 'services', 'offer', 'what do you do')) {
    return 'Yutrixa offers AI Agents, AI Automation, Workflow Automation, Web Development, Email Marketing, Social Media & LinkedIn Management, E-commerce Solutions, Business Process Automation, and Custom Digital Solutions. Is there a specific area you would like to explore?';
  }
  if (has('chatbot', 'build a bot', 'ai agent', 'ai agents')) {
    return 'Yes — we design and build AI agents and chatbots for tasks like customer support, lead qualification, and appointment booking, similar to this assistant. Would you like to see a demo or discuss your use case?';
  }
  if (has('automat')) {
    return 'We help automate repetitive tasks — think follow-ups, data entry, lead routing, and connecting the tools you already use. We start by understanding your current workflow, then design an automation that fits it. What process is taking up the most time for your team?';
  }
  if (has('web', 'website', 'site')) {
    return 'We build fast, modern business websites and web apps — from marketing sites to more complex systems with booking or dashboards, like this one. Do you need a new site, or improvements to an existing one?';
  }
  if (has('book', 'appointment', 'consult', 'schedule', 'meeting')) {
    return "You can book a consultation directly on our Book a Consultation page — pick a service, choose a time, and you're set. Would you like me to point you there?";
  }
  if (has('contact', 'email', 'reach', 'talk to someone')) {
    return "You can reach the team through our Contact page — just share a few details about your project and we'll follow up. Would you like help with anything else first?";
  }
  if (has('price', 'cost', 'pricing', 'budget', 'how much')) {
    return "Pricing depends on the scope of the project. The best next step is booking a short consultation so we can understand what you need and give you an accurate picture. Would you like to book one?";
  }
  if (has('portfolio', 'work', 'project', 'example', 'demo')) {
    return 'Our Work page includes demo prototypes such as an AI customer support chatbot, an appointment booking assistant, and workflow automation examples. These are labeled as demo prototypes so you can see how they work. Want a link?';
  }
  if (has('who are you', 'company', 'about yutrixa', 'what is yutrixa')) {
    return 'Yutrixa is a technology solutions company focused on practical AI, automation, and digital growth for startups and growing businesses. We build AI agents, automate workflows, and develop websites and digital systems. What are you hoping to improve or build?';
  }

  return "Good question — could you tell me a bit more about what you're trying to achieve? I can help with AI automation, AI agents, web development, or booking a consultation.";
}

async function callGemini(message, history) {
  const contents = [];
  (history || []).slice(-8).forEach((turn) => {
    contents.push({
      role: turn.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: turn.content }]
    });
  });
  contents.push({ role: 'user', parts: [{ text: message }] });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_CONTEXT }] },
      contents,
      generationConfig: { maxOutputTokens: 300, temperature: 0.6 }
    })
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Gemini API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
  if (!text) throw new Error('Empty response from Gemini');
  return text.trim();
}

app.post('/api/chat', async (req, res) => {
  const { message, history } = req.body || {};
  const cleanMessage = sanitize(message);

  if (!cleanMessage) {
    return res.status(400).json({ success: false, error: 'Message is required.' });
  }

  if (GEMINI_API_KEY) {
    try {
      const reply = await callGemini(cleanMessage, Array.isArray(history) ? history : []);
      return res.json({ success: true, reply, source: 'gemini' });
    } catch (err) {
      console.error('Gemini call failed, using local fallback:', err.message);
    }
  }

  const reply = localFallbackResponse(cleanMessage, history);
  res.json({ success: true, reply, source: 'fallback' });
});

/* ----------------------------------------------------------------------- */
/* Static site + clean page routes                                         */
/* ----------------------------------------------------------------------- */

app.use(express.static(path.join(__dirname, 'public')));

const pageRoutes = {
  '/': 'index.html',
  '/services': 'services.html',
  '/work': 'work.html',
  '/about': 'about.html',
  '/careers': 'careers.html',
  '/contact': 'contact.html',
  '/book': 'book.html',
  '/admin': 'admin.html'
};

Object.entries(pageRoutes).forEach(([route, file]) => {
  app.get(route, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', file));
  });
});

// 404 handler for unknown routes
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, error: 'API endpoint not found.' });
  }
  res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Yutrixa server running at http://localhost:${PORT}`);
  if (!GEMINI_API_KEY) {
    console.log('No GEMINI_API_KEY set - chatbot is running in local fallback mode.');
  }
});
