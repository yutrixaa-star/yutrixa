document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('contactForm');
  if (!form) return;

  const notice = document.getElementById('contactNotice');
  const submitBtn = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    notice.hidden = true;
    submitBtn.disabled = true;
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Sending...';

    const payload = Object.fromEntries(new FormData(form).entries());

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      notice.hidden = false;
      if (res.ok && data.success) {
        notice.className = 'notice notice-success';
        notice.textContent = data.message || 'Thanks — your message has been received.';
        form.reset();
      } else {
        notice.className = 'notice notice-error';
        notice.textContent = data.error || 'Something went wrong. Please check your details and try again.';
      }
    } catch (err) {
      notice.hidden = false;
      notice.className = 'notice notice-error';
      notice.textContent = 'Network error. Please try again in a moment.';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });
});
