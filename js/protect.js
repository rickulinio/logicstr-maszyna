(function(){
  const ok = t => t && t.closest && t.closest('input,textarea,.allowsel'); // pola wyszukiwania działają normalnie
  const stop = e => { if(!ok(e.target)) e.preventDefault(); };
  ['contextmenu','selectstart','dragstart','copy','cut'].forEach(ev => document.addEventListener(ev, stop));
  document.addEventListener('keydown', e => {
    const k = e.key.toLowerCase(), c = e.ctrlKey || e.metaKey;
    const devtools = k === 'f12' || (c && e.shiftKey && ['i','j','c','k'].includes(k)) || (c && e.altKey && ['i','j','c'].includes(k));
    const other = c && ['u','s','p'].includes(k) || (c && k === 'a' && !ok(e.target));
    if(devtools || other){ e.preventDefault(); e.stopPropagation(); return false; }
  }, true);
  document.querySelectorAll('img').forEach(i => i.setAttribute('draggable','false'));
  new MutationObserver(() => document.querySelectorAll('img:not([draggable])').forEach(i => i.setAttribute('draggable','false')))
    .observe(document.body, {childList:true, subtree:true});
})();