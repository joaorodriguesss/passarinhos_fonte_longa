const chatPanel = document.querySelector('#chat-panel');
const chatLauncher = document.querySelector('#chat-launcher');
const chatClose = document.querySelector('#chat-close');
const chatMessages = document.querySelector('#chat-messages');
const chatForm = document.querySelector('#chat-form');
const chatInput = document.querySelector('#chat-input');
const chatSend = document.querySelector('#chat-send');
const chatSuggestions = document.querySelector('#chat-suggestions');
const conversation = [];

function setChatOpen(isOpen) {
  chatPanel.hidden = !isOpen;
  chatLauncher.setAttribute('aria-expanded', String(isOpen));
  if (isOpen) chatInput.focus();
  else chatLauncher.focus();
}

function addMessage(role, text, pending = false) {
  const message = document.createElement('p');
  message.className = `chat-message ${role === 'user' ? 'user-message' : 'assistant-message'}`;
  if (pending) message.classList.add('is-pending');
  message.textContent = text;
  chatMessages.append(message);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return message;
}

function chatErrorMessage(code) {
  if (code === 'chat_not_configured') return 'O chat ainda está a ser configurado. Contacta-nos pelo WhatsApp ou telefone.';
  if (code === 'rate_limited') return 'Recebemos várias perguntas seguidas. Aguarda um minuto e tenta novamente.';
  return 'Não consegui responder agora. Tenta novamente ou contacta-nos pelo WhatsApp.';
}

chatLauncher.addEventListener('click', () => setChatOpen(chatPanel.hidden));
chatClose.addEventListener('click', () => setChatOpen(false));
chatPanel.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') setChatOpen(false);
});

chatSuggestions.addEventListener('click', (event) => {
  const suggestion = event.target.closest('[data-chat-suggestion]');
  if (!suggestion) return;
  chatInput.value = suggestion.dataset.chatSuggestion;
  chatInput.focus();
});

chatForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const text = chatInput.value.trim();
  if (!text || chatSend.disabled) return;

  conversation.push({ role: 'user', content: text });
  addMessage('user', text);
  chatInput.value = '';
  chatSend.disabled = true;
  chatSend.textContent = 'A enviar';
  const pendingMessage = addMessage('assistant', 'A preparar uma resposta...', true);
  chatSuggestions.hidden = true;

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: conversation.slice(-8) })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'chat_unavailable');
    pendingMessage.textContent = result.answer;
    pendingMessage.classList.remove('is-pending');
    conversation.push({ role: 'assistant', content: result.answer });
    if (conversation.length > 8) conversation.splice(0, conversation.length - 8);
  } catch (error) {
    pendingMessage.textContent = chatErrorMessage(error.message);
    pendingMessage.classList.remove('is-pending');
    conversation.pop();
  } finally {
    chatSend.disabled = false;
    chatSend.textContent = 'Enviar';
    chatInput.focus();
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
});