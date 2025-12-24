
// Content script for Prompt Formatter - Rich Text Editor Version

let activeTextarea = null;
let overlayContainer = null;
let shadowRoot = null;
let richEditor = null;

function init() {
  createOverlay();
  document.addEventListener('focusin', handleFocus);
}

function handleFocus(e) {
  const target = e.target;
  if (!target) return;
  const isEditable = target.matches('textarea') ||
    target.matches('input[type="text"]') ||
    target.isContentEditable;

  if (isEditable) {
    activeTextarea = target;
    showFloatingButton(target);
  }
}

// --- Floating Button ---
let floatingBtn = null;

function showFloatingButton(target) {
  if (floatingBtn) floatingBtn.remove();

  floatingBtn = document.createElement('div');
  floatingBtn.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
    </svg>
  `;

  Object.assign(floatingBtn.style, {
    position: 'absolute',
    cursor: 'pointer',
    background: '#1a1a1a',
    color: '#fff',
    borderRadius: '8px',
    padding: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
    zIndex: '9999',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'opacity 0.2s',
    opacity: '0.8'
  });

  const Rect = target.getBoundingClientRect();
  const top = Rect.top + window.scrollY - 40;
  const left = Rect.left + window.scrollX + Rect.width - 40;

  floatingBtn.style.top = `${Math.max(0, top)}px`;
  floatingBtn.style.left = `${Math.max(0, left)}px`;

  floatingBtn.addEventListener('mouseenter', () => floatingBtn.style.opacity = '1');
  floatingBtn.addEventListener('mouseleave', () => floatingBtn.style.opacity = '0.8');
  floatingBtn.addEventListener('click', openEditor);
  floatingBtn.addEventListener('mousedown', (e) => e.preventDefault());

  document.body.appendChild(floatingBtn);

  target.addEventListener('blur', () => {
    setTimeout(() => {
      // If we are navigating to the button or overlay, don't remove
      const inOverlay = overlayContainer && overlayContainer.shadowRoot && overlayContainer.shadowRoot.activeElement;
      if (floatingBtn && document.activeElement !== floatingBtn && !inOverlay) {
        if (floatingBtn) floatingBtn.remove();
        floatingBtn = null;
      }
    }, 200);
  }, { once: true });
}

// --- Shortcut ---
document.addEventListener('keydown', (e) => {
  if (e.altKey && e.code === 'KeyA') {
    const target = e.target;
    if (target.matches('textarea') || target.matches('input[type="text"]') || target.isContentEditable) {
      activeTextarea = target;
      e.preventDefault();
      openEditor();
    }
  }
});

// --- Overlay UI ---
function createOverlay() {
  overlayContainer = document.createElement('div');
  Object.assign(overlayContainer.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100vw',
    height: '100vh',
    pointerEvents: 'none',
    zIndex: '2147483647',
    display: 'none',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0, 0, 0, 0.4)',
    backdropFilter: 'blur(4px)'
  });

  shadowRoot = overlayContainer.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = `
    .editor-card {
      background: rgba(23, 23, 23, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.1);
      width: 800px;
      max-width: 90vw;
      height: 60vh;
      border-radius: 16px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.5);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      animation: fadeIn 0.2s ease-out;
    }
    @keyframes fadeIn {
        from { opacity: 0; transform: scale(0.95); }
        to { opacity: 1; transform: scale(1); }
    }
    .toolbar {
      padding: 12px 20px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      gap: 10px;
      align-items: center;
      background: rgba(255,255,255,0.03);
    }
    .btn {
      background: transparent;
      border: none;
      color: #aaa;
      cursor: pointer;
      padding: 6px;
      border-radius: 6px;
      transition: all 0.2s;
    }
    .btn:hover {
      background: rgba(255,255,255,0.1);
      color: #fff;
    }
    .btn.active {
      background: rgba(255,255,255,0.2);
      color: #fff;
    }
    .btn svg {
      width: 18px;
      height: 18px;
    }
    .editor-area {
      flex: 1;
      padding: 20px;
      color: #eee;
      outline: none;
      overflow-y: auto;
      font-size: 16px;
      line-height: 1.6;
      white-space: pre-wrap;
    }
    .editor-area ul { padding-left: 20px; }
    .editor-area code { 
      background: rgba(255,255,255,0.1); 
      padding: 2px 4px; 
      border-radius: 4px; 
      font-family: monospace; 
    }
    .editor-area h1 { font-size: 1.6em; font-weight: bold; margin: 0.5em 0; border-bottom: 1px solid rgba(255,255,255,0.1); }
    .editor-area h2 { font-size: 1.4em; font-weight: bold; margin: 0.5em 0; }
    .editor-area h3 { font-size: 1.2em; font-weight: bold; margin: 0.5em 0; }
    
    .footer {
      padding: 15px 20px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
    .action-btn {
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: 500;
      cursor: pointer;
      border: none;
      font-size: 14px;
    }
    .cancel {
      background: transparent;
      color: #aaa;
    }
    .cancel:hover { color: #fff; }
    .insert {
      background: #3b82f6;
      color: white;
      box-shadow: 0 0 15px rgba(59, 130, 246, 0.4);
    }
    .insert:hover {
      background: #2563eb;
    }
  `;

  // Template
  const wrapper = document.createElement('div');
  wrapper.className = 'editor-card';
  wrapper.innerHTML = `
    <div class="toolbar">
       <button class="btn" id="h1" title="Heading 1"><b>H1</b></button>
       <button class="btn" id="h2" title="Heading 2"><b>H2</b></button>
       <button class="btn" id="h3" title="Heading 3"><b>H3</b></button>
       <div style="width: 1px; height: 16px; background: rgba(255,255,255,0.1); margin: 0 4px;"></div>
       <button class="btn" id="bold" title="Bold">
         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path></svg>
       </button>
       <button class="btn" id="italic" title="Italic">
         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="4" x2="10" y2="4"></line><line x1="14" y1="20" x2="5" y2="20"></line><line x1="15" y1="4" x2="9" y2="20"></line></svg>
       </button>
       <button class="btn" id="list" title="Bullet List">
         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
       </button>
       <div style="flex:1"></div>
       <div style="font-size:12px; color:#666;">Prompt Editor</div>
    </div>
    <div class="editor-area" contenteditable="true" spellcheck="false"></div>
    <div class="footer">
      <button class="action-btn cancel" id="close">Close</button>
      <button class="action-btn insert" id="send">Insert Prompt</button>
    </div>
  `;

  shadowRoot.appendChild(style);
  shadowRoot.appendChild(wrapper);
  document.body.appendChild(overlayContainer);

  richEditor = shadowRoot.querySelector('.editor-area');

  // Toolbar state updater
  const updateToolbar = () => {
    // Simple state checking
    const bold = document.queryCommandState('bold');
    const italic = document.queryCommandState('italic');
    const list = document.queryCommandState('insertUnorderedList');

    // Headings (block format)
    const block = document.queryCommandValue('formatBlock') || '';
    const h1 = block.includes('h1');
    const h2 = block.includes('h2');
    const h3 = block.includes('h3');

    shadowRoot.getElementById('bold').classList.toggle('active', bold);
    shadowRoot.getElementById('italic').classList.toggle('active', italic);
    shadowRoot.getElementById('list').classList.toggle('active', list);

    shadowRoot.getElementById('h1').classList.toggle('active', h1);
    shadowRoot.getElementById('h2').classList.toggle('active', h2);
    shadowRoot.getElementById('h3').classList.toggle('active', h3);
  };

  richEditor.addEventListener('keyup', updateToolbar);
  richEditor.addEventListener('mouseup', updateToolbar);
  richEditor.addEventListener('click', updateToolbar);

  richEditor.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      document.execCommand('insertText', false, '    ');
    }
  });

  shadowRoot.getElementById('h1').onclick = () => execCmd('formatBlock', '<h1>');
  shadowRoot.getElementById('h2').onclick = () => execCmd('formatBlock', '<h2>');
  shadowRoot.getElementById('h3').onclick = () => execCmd('formatBlock', '<h3>');

  shadowRoot.getElementById('bold').onclick = () => execCmd('bold');
  shadowRoot.getElementById('italic').onclick = () => execCmd('italic');
  shadowRoot.getElementById('list').onclick = () => execCmd('insertUnorderedList');

  shadowRoot.getElementById('close').onclick = closeEditor;
  shadowRoot.getElementById('send').onclick = insertIntoPrompt;

  wrapper.addEventListener('click', e => e.stopPropagation());

  // Privacy Shield
  wrapper.addEventListener('keydown', e => e.stopPropagation());
  wrapper.addEventListener('keypress', e => e.stopPropagation());
  wrapper.addEventListener('keyup', e => e.stopPropagation());
  wrapper.addEventListener('input', e => e.stopPropagation());

  overlayContainer.addEventListener('click', closeEditor);
}

function execCmd(cmd, arg = null) {
  document.execCommand(cmd, false, arg);
  richEditor.focus();
  // Trigger update manually after click
  setTimeout(() => {
    // We can't easily call updateToolbar here since it's scoped, but the click/keyup listeners on editor will handle it
    // when user types. To handle immediate feedback on button click, we could make updateToolbar global or pass it.
    // For now relying on user typing/clicking in editor.
    // Actually, let's force a click event dispatch or focus logic.
    const evt = new Event('click');
    richEditor.dispatchEvent(evt);
  }, 10);
}

function openEditor() {
  if (!activeTextarea) return;
  overlayContainer.style.display = 'flex';
  overlayContainer.style.pointerEvents = 'auto';
  const existingText = activeTextarea.value || activeTextarea.innerText || '';
  richEditor.innerText = existingText;
  richEditor.focus();
}

function closeEditor() {
  overlayContainer.style.display = 'none';
  overlayContainer.style.pointerEvents = 'none';
}

function insertIntoPrompt() {
  const markdown = htmlToMarkdown(richEditor.innerHTML);
  if (activeTextarea) {
    if (activeTextarea.setRangeText) {
      activeTextarea.value = markdown;
      activeTextarea.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      activeTextarea.focus();
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, markdown);
    }
  }
  closeEditor();
}

function htmlToMarkdown(html) {
  let text = html;
  text = text.replace(/<div[^>]*>/g, '\n').replace(/<\/div>/g, '');
  text = text.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n');
  text = text.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n');
  text = text.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n');
  text = text.replace(/<b>(.*?)<\/b>/gi, '**$1**');
  text = text.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');
  text = text.replace(/<i>(.*?)<\/i>/gi, '*$1*');
  text = text.replace(/<em>(.*?)<\/em>/gi, '*$1*');
  text = text.replace(/<ul>/gi, '\n');
  text = text.replace(/<\/ul>/gi, '\n');
  text = text.replace(/<li>/gi, '- ');
  text = text.replace(/<\/li>/gi, '\n');
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  const txt = document.createElement("textarea");
  txt.innerHTML = text;
  return txt.value.trim();
}

init();
