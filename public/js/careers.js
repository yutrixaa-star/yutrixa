document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('careersForm');
  if (!form) return;

  const notice = document.getElementById('careersNotice');
  const submitBtn = form.querySelector('button[type="submit"]');
  const roleField = form.querySelector('[name="role"]');

  // Pre-fill role from "Express Interest" buttons on the roles list
  document.querySelectorAll('[data-role]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (roleField) roleField.value = btn.getAttribute('data-role');
      document.getElementById('careersFormSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    notice.hidden = true;
    submitBtn.disabled = true;
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Submitting...';

    const payload = Object.fromEntries(new FormData(form).entries());

    try {
      const res = await fetch('/api/careers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      notice.hidden = false;
      if (res.ok && data.success) {
        notice.className = 'notice notice-success';
        notice.textContent = data.message || 'Thanks for your interest — we will be in touch.';
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
