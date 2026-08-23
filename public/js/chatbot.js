/* Yutrixa AI Assistant — floating chat widget, present on every page.
   Talks to POST /api/chat (Gemini on the backend, with local fallback). */

(function () {
  const SUGGESTIONS = [
    'What services do you offer?',
    'Can you build an AI chatbot?',
    'How can AI automate my business?',
    'I want to book a consultation.'
  ];

  const state = {
    open: false,
    history: [], // { role: 'user' | 'assistant', content: string }
    sending: false
  };

  function el(tag, className, html) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (html !== undefined) node.innerHTML = html;
    return node;
  }

  function buildWidget() {
    const launcher = el('button', 'chat-launcher', chatIcon());
    launcher.setAttribute('aria-label', 'Open Yutrixa AI Assistant');
    launcher.type = 'button';

    const win = el('div', 'chat-window');
    win.innerHTML = `
      <div class="chat-header">
        <div class="chat-header-title"><span class="dot"></span> Yutrixa AI Assistant</div>
        <button class="chat-close" type="button" aria-label="Close chat">${closeIcon()}</button>
      </div>
      <div class="chat-body" id="chatBody"></div>
      <div class="chat-suggestions" id="chatSuggestions"></div>
      <form class="chat-input-row" id="chatForm" autocomplete="off">
        <input type="text" id="chatInput" placeholder="Ask about services, automation, booking..." maxlength="500" />
        <button type="submit" class="chat-send" aria-label="Send message">${sendIcon()}</button>
      </form>
    `;

    document.body.appendChild(launcher);
    document.body.appendChild(win);

    const body = win.querySelector('#chatBody');
    const suggestionsWrap = win.querySelector('#chatSuggestions');
    const form = win.querySelector('#chatForm');
    const input = win.querySelector('#chatInput');
    const closeBtn = win.querySelector('.chat-close');

    function renderSuggestions() {
      suggestionsWrap.innerHTML = '';
      SUGGESTIONS.forEach((s) => {
        const chip = el('button', 'chip', s);
        chip.type = 'button';
        chip.addEventListener('click', () => sendMessage(s));
        suggestionsWrap.appendChild(chip);
      });
    }

    function addMessage(role, text) {
      const bubble = el('div', role === 'user' ? 'msg msg-user' : 'msg msg-bot', escapeHTML(text));
      body.appendChild(bubble);
      body.scrollTop = body.scrollHeight;
    }

    function addTyping() {
      const typing = el('div', 'msg-typing', '<span></span><span></span><span></span>');
      typing.id = 'typingIndicator';
      body.appendChild(typing);
      body.scrollTop = body.scrollHeight;
    }

    function removeTyping() {
      const t = document.getElementById('typingIndicator');
      if (t) t.remove();
    }

    async function sendMessage(text) {
      const message = (text || input.value).trim();
      if (!message || state.sending) return;
      input.value = '';
      addMessage('user', message);
      state.history.push({ role: 'user', content: message });
      state.sending = true;
      addTyping();

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, history: state.history.slice(-10) })
        });
        const data = await res.json();
        removeTyping();
        if (data.success) {
          addMessage('assistant', data.reply);
          state.history.push({ role: 'assistant', content: data.reply });
        } else {
          addMessage('assistant', "Sorry, I couldn't process that. Could you try rephrasing your question?");
        }
      } catch (err) {
        removeTyping();
        addMessage('assistant', "I'm having trouble connecting right now. Please try again in a moment, or use the Contact page.");
      } finally {
        state.sending = false;
      }
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      sendMessage();
    });

    launcher.addEventListener('click', () => {
      state.open = !state.open;
      win.classList.toggle('open', state.open);
      if (state.open) input.focus();
    });
    closeBtn.addEventListener('click', () => {
      state.open = false;
      win.classList.remove('open');
    });

    renderSuggestions();
    addMessage('assistant', "Hi! I'm the Yutrixa AI Assistant. Ask me about our services, AI automation, or how to book a consultation.");
  }

  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function chatIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>';
  }
  function closeIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
  }
  function sendIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>';
  }

  document.addEventListener('DOMContentLoaded', buildWidget);
})();
