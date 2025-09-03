
const carousel = document.getElementById('carousel');
const dots = document.getElementById('dots')?.children || [];
function updateDots(){
  if(!carousel || !dots.length) return;
  const w = carousel.clientWidth;
  const i = Math.round(carousel.scrollLeft / w);
  [...dots].forEach((d, idx)=> d.classList.toggle('active', idx===i));
}
carousel?.addEventListener('scroll', ()=> requestAnimationFrame(updateDots));
window.addEventListener('resize', updateDots);
updateDots();
