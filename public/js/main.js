/* Shared behavior across all pages: mobile nav, active link highlighting,
   sticky header shadow, reveal-on-scroll for cards. */

document.addEventListener('DOMContentLoaded', () => {
  // Mobile nav toggle
  const hamburger = document.querySelector('.hamburger');
  const mobileNav = document.querySelector('.mobile-nav');
  if (hamburger && mobileNav) {
    hamburger.addEventListener('click', () => {
      mobileNav.classList.toggle('open');
      const expanded = mobileNav.classList.contains('open');
      hamburger.setAttribute('aria-expanded', String(expanded));
    });
    mobileNav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => mobileNav.classList.remove('open'));
    });
  }

  // Highlight active nav link based on current path
  const path = window.location.pathname === '/' ? '/' : window.location.pathname.replace(/\/$/, '');
  document.querySelectorAll('.nav-links a, .mobile-nav a').forEach((link) => {
    const href = link.getAttribute('href');
    if (href === path || (href !== '/' && path.startsWith(href))) {
      link.classList.add('active');
    }
  });

  // Simple reveal animation for cards/sections as they scroll into view
  const revealTargets = document.querySelectorAll('.card, .step, .demo-card, .flow-node');
  if ('IntersectionObserver' in window) {
    revealTargets.forEach((el) => { el.style.opacity = '0'; el.style.transform = 'translateY(14px)'; el.style.transition = 'opacity 0.5s ease, transform 0.5s ease'; });
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    revealTargets.forEach((el) => io.observe(el));
  }
});
