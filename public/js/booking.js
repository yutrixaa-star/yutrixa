/* Yutrixa Appointment Booking Assistant
   Left: guided chat flow. Right: live calendar + time slots.
   Talks to /api/availability and /api/appointments. */

document.addEventListener('DOMContentLoaded', () => {
  const chatBody = document.getElementById('bookingChatBody');
  const calendarPanel = document.getElementById('calendarPanel');
  if (!chatBody || !calendarPanel) return;

  const SERVICES = ['Consultation', 'AI Automation', 'Web Development', 'Custom Software', 'Other'];

  const booking = {
    step: 'service', // service -> date -> time -> details -> confirmed
    service: null,
    date: null, // YYYY-MM-DD
    time: null,
    calendarMonth: new Date().getMonth(),
    calendarYear: new Date().getFullYear()
  };

  /* ---------------------------- chat helpers ---------------------------- */

  function el(tag, className, html) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (html !== undefined) node.innerHTML = html;
    return node;
  }

  function botMsg(text) {
    chatBody.appendChild(el('div', 'msg msg-bot', text));
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  function userMsg(text) {
    chatBody.appendChild(el('div', 'msg msg-user', text));
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  function optionsRow(options, onSelect) {
    const wrap = el('div', 'booking-options');
    options.forEach((opt) => {
      const btn = el('button', 'option-btn', opt);
      btn.type = 'button';
      btn.addEventListener('click', () => {
        wrap.querySelectorAll('.option-btn').forEach((b) => (b.disabled = true));
        btn.classList.add('selected');
        onSelect(opt);
      });
      wrap.appendChild(btn);
    });
    chatBody.appendChild(wrap);
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  /* ---------------------------- flow steps ------------------------------- */

  function startFlow() {
    botMsg('Hi! I can help you book an appointment. What service would you like?');
    optionsRow(SERVICES, (service) => {
      userMsg(service);
      booking.service = service;
      booking.step = 'date';
      setTimeout(() => {
        botMsg('Great choice. What day would you prefer? Pick a date on the calendar.');
        renderCalendar();
      }, 300);
    });
  }

  function onDateSelected(dateStr, label) {
    userMsg(label);
    booking.date = dateStr;
    booking.step = 'time';
    setTimeout(() => {
      botMsg('Here are the available times for that day:');
      renderTimeSlots(dateStr);
    }, 250);
  }

  function onTimeSelected(time) {
    userMsg(time);
    booking.time = time;
    booking.step = 'details';
    setTimeout(() => {
      botMsg("Perfect. Please share your details to confirm the appointment:");
      renderDetailsForm();
    }, 250);
  }

  /* ---------------------------- calendar --------------------------------- */

  function renderCalendar() {
    calendarPanel.innerHTML = '';
    const wrap = el('div', 'calendar-panel');

    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const head = el('div', 'calendar-head');
    const prevBtn = el('button', '', '&#8592;');
    const nextBtn = el('button', '', '&#8594;');
    const label = el('strong', '', `${monthNames[booking.calendarMonth]} ${booking.calendarYear}`);
    head.append(prevBtn, label, nextBtn);
    wrap.appendChild(head);

    const grid = el('div', 'calendar-grid');
    ['Su','Mo','Tu','We','Th','Fr','Sa'].forEach((d) => grid.appendChild(el('div', 'dow', d)));

    const firstDay = new Date(booking.calendarYear, booking.calendarMonth, 1);
    const startOffset = firstDay.getDay();
    const daysInMonth = new Date(booking.calendarYear, booking.calendarMonth + 1, 0).getDate();
    const today = new Date();
    today.setHours(0,0,0,0);

    for (let i = 0; i < startOffset; i++) grid.appendChild(el('div', 'calendar-day empty'));

    for (let d = 1; d <= daysInMonth; d++) {
      const thisDate = new Date(booking.calendarYear, booking.calendarMonth, d);
      const dateStr = toDateStr(thisDate);
      const btn = el('button', 'calendar-day', String(d));
      btn.type = 'button';

      const isPast = thisDate < today;
      const isSunday = thisDate.getDay() === 0;
      if (isPast || isSunday) {
        btn.disabled = true;
      }
      if (toDateStr(today) === dateStr) btn.classList.add('today');
      if (booking.date === dateStr) btn.classList.add('selected');

      btn.addEventListener('click', () => {
        const label = thisDate.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        onDateSelected(dateStr, label);
      });
      grid.appendChild(btn);
    }

    wrap.appendChild(grid);

    prevBtn.addEventListener('click', () => {
      booking.calendarMonth -= 1;
      if (booking.calendarMonth < 0) { booking.calendarMonth = 11; booking.calendarYear -= 1; }
      renderCalendar();
    });
    nextBtn.addEventListener('click', () => {
      booking.calendarMonth += 1;
      if (booking.calendarMonth > 11) { booking.calendarMonth = 0; booking.calendarYear += 1; }
      renderCalendar();
    });

    const note = el('p', 'small', "We're open Monday to Saturday. Weekend hours vary.");
    note.style.marginTop = '16px';
    wrap.appendChild(note);

    calendarPanel.appendChild(wrap);
  }

  function toDateStr(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  async function renderTimeSlots(dateStr) {
    calendarPanel.innerHTML = '<div class="calendar-panel"><p class="small">Loading available times...</p></div>';
    let data;
    try {
      const res = await fetch(`/api/availability?date=${encodeURIComponent(dateStr)}`);
      data = await res.json();
    } catch (err) {
      calendarPanel.innerHTML = '<div class="calendar-panel"><p class="small">Could not load availability. Please try again.</p></div>';
      return;
    }

    const wrap = el('div', 'calendar-panel');
    wrap.appendChild(el('h3', '', 'Available Times'));
    wrap.appendChild(el('p', 'small', new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })));

    const slotsRow = el('div', 'slots-row');
    (data.allSlots || ['10:00 AM','11:30 AM','2:00 PM','4:00 PM']).forEach((time) => {
      const taken = (data.taken || []).includes(time);
      const btn = el('button', 'slot-btn', time);
      btn.type = 'button';
      if (taken) btn.disabled = true;
      btn.addEventListener('click', () => {
        slotsRow.querySelectorAll('.slot-btn').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        onTimeSelected(time);
      });
      slotsRow.appendChild(btn);
    });
    wrap.appendChild(slotsRow);

    const backBtn = el('button', 'btn btn-outline btn-sm', 'Choose a different date');
    backBtn.style.marginTop = '18px';
    backBtn.type = 'button';
    backBtn.addEventListener('click', () => {
      booking.date = null;
      renderCalendar();
    });
    wrap.appendChild(backBtn);

    calendarPanel.innerHTML = '';
    calendarPanel.appendChild(wrap);
  }

  /* ---------------------------- details form ------------------------------ */

  function renderDetailsForm() {
    const formWrap = el('div', '');
    formWrap.innerHTML = `
      <form id="detailsForm">
        <div class="field"><label for="bName">Full Name</label><input id="bName" name="name" required /></div>
        <div class="field"><label for="bEmail">Email</label><input id="bEmail" name="email" type="email" required /></div>
        <div class="field"><label for="bPhone">Phone</label><input id="bPhone" name="phone" type="tel" required /></div>
        <div class="field"><label for="bCompany">Company (optional)</label><input id="bCompany" name="company" /></div>
        <div class="field"><label for="bMessage">Message (optional)</label><textarea id="bMessage" name="message" rows="3"></textarea></div>
        <div class="notice notice-error" id="bookingError" hidden></div>
        <button type="submit" class="btn btn-primary btn-block" id="bookingSubmit">Confirm Appointment</button>
      </form>
    `;
    chatBody.appendChild(formWrap);
    chatBody.scrollTop = chatBody.scrollHeight;

    const form = formWrap.querySelector('#detailsForm');
    const errorBox = formWrap.querySelector('#bookingError');
    const submitBtn = formWrap.querySelector('#bookingSubmit');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorBox.hidden = true;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Booking...';

      const payload = {
        name: form.name.value.trim(),
        email: form.email.value.trim(),
        phone: form.phone.value.trim(),
        company: form.company.value.trim(),
        service: booking.service,
        date: booking.date,
        time: booking.time,
        message: form.message.value.trim()
      };

      try {
        const res = await fetch('/api/appointments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          errorBox.textContent = data.error || 'Something went wrong. Please try again.';
          errorBox.hidden = false;
          submitBtn.disabled = false;
          submitBtn.textContent = 'Confirm Appointment';
          if (res.status === 409) {
            setTimeout(() => renderTimeSlots(booking.date), 400);
          }
          return;
        }
        userMsg(`${payload.name} — ${payload.email}`);
        showConfirmation(data.appointment);
      } catch (err) {
        errorBox.textContent = 'Network error. Please check your connection and try again.';
        errorBox.hidden = false;
        submitBtn.disabled = false;
        submitBtn.textContent = 'Confirm Appointment';
      }
    });
  }

  /* ---------------------------- confirmation ------------------------------- */

  function showConfirmation(appointment) {
    setTimeout(() => {
      botMsg('Appointment Confirmed! Here are your details:');

      const card = el('div', 'confirmation-card');
      card.innerHTML = `
        <div class="confirmation-check">${checkIcon()}</div>
        <h3>You're all set, ${escapeHTML(appointment.name.split(' ')[0])}!</h3>
        <div class="confirmation-details">
          <div><span>Name</span><span>${escapeHTML(appointment.name)}</span></div>
          <div><span>Date</span><span>${escapeHTML(appointment.date)}</span></div>
          <div><span>Time</span><span>${escapeHTML(appointment.time)}</span></div>
          <div><span>Service</span><span>${escapeHTML(appointment.service)}</span></div>
          <div><span>Email</span><span>${escapeHTML(appointment.email)}</span></div>
        </div>
        <div class="hero-actions" style="justify-content:center;">
          <button class="btn btn-primary" id="addToCalendarBtn">Add to Calendar</button>
          <button class="btn btn-outline" id="bookAnotherBtn">Book Another Appointment</button>
        </div>
      `;
      chatBody.appendChild(card);
      chatBody.scrollTop = chatBody.scrollHeight;

      calendarPanel.innerHTML = '<div class="calendar-panel text-center"><p class="small">Your appointment has been added below.</p></div>';

      card.querySelector('#addToCalendarBtn').addEventListener('click', () => addToCalendar(appointment));
      card.querySelector('#bookAnotherBtn').addEventListener('click', () => {
        booking.step = 'service';
        booking.service = null;
        booking.date = null;
        booking.time = null;
        chatBody.innerHTML = '';
        startFlow();
      });
    }, 300);
  }

  function addToCalendar(appointment) {
    const start = parseSlotToDate(appointment.date, appointment.time);
    const end = new Date(start.getTime() + 30 * 60000);
    const fmt = (d) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const details = `Appointment with Yutrixa (${appointment.service})`;
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(details)}&dates=${fmt(start)}/${fmt(end)}&details=${encodeURIComponent('Booked via yutrixa.com/book')}`;
    window.open(url, '_blank');
  }

  function parseSlotToDate(dateStr, timeStr) {
    const [time, period] = timeStr.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d, hours, minutes);
  }

  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function checkIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="30" height="30"><polyline points="20 6 9 17 4 12"></polyline></svg>';
  }

  startFlow();
});
