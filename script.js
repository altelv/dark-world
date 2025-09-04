
document.addEventListener('DOMContentLoaded', () => {
  const carousel = document.getElementById('carousel');
  const dotsWrap = document.getElementById('dots');
  const dots = dotsWrap ? dotsWrap.children : [];
  function updateDots(){
    if(!carousel || !dots.length) return;
    const w = carousel.clientWidth;
    const i = Math.round(carousel.scrollLeft / w);
    [...dots].forEach((d, idx)=> d.classList.toggle('active', idx===i));
  }
  carousel && carousel.addEventListener('scroll', ()=> requestAnimationFrame(updateDots));
  window.addEventListener('resize', updateDots);
  updateDots();

  // Chat send
  const chat = document.getElementById('chat');
  const input = document.getElementById('chatInput');
  const send = document.getElementById('sendBtn');

  function appendBubble(text, cls='player'){
    const msg = document.createElement('div');
    msg.className = `chat-msg ${cls}`;
    msg.textContent = text;
    const before = chat.querySelector('.input-wrap');
    chat.insertBefore(msg, before);
    chat.scrollTop = chat.scrollHeight;
  }

  function sendMsg(){
    const v = (input.value || '').trim();
    if(!v) return;
    appendBubble(v, 'player');
    if (v.includes('_проверка_боя') && window.CombatOverlay && typeof window.CombatOverlay.open === 'function') {
      window.CombatOverlay.open();
    }
    input.value = '';
  }

  if (send) send.addEventListener('click', sendMsg);
  if (input) input.addEventListener('keydown', (e)=>{
    if (e.key === 'Enter' && (e.shiftKey || e.ctrlKey)) {
      e.preventDefault();
      sendMsg();
    }
  });
});
