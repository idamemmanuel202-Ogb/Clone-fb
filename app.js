(() => {
  'use strict';

  const STORAGE_KEY = 'pluto-workspace-v1';
  const SETTINGS_KEY = 'pluto-settings-v1';
  const now = Date.now();

  const modelCatalog = {
    demo: [
      { value: 'pluto-demo', label: 'PLUTO Demo · instant, no key' }
    ],
    openrouter: [
      { value: 'meta-llama/llama-3.3-8b-instruct:free', label: 'Llama 3.3 8B · free' },
      { value: 'qwen/qwen3-4b:free', label: 'Qwen 3 4B · free' },
      { value: 'google/gemma-3-4b-it:free', label: 'Gemma 3 4B · free' },
      { value: 'deepseek/deepseek-r1-0528:free', label: 'DeepSeek R1 · free' }
    ],
    huggingface: [
      { value: 'Qwen/Qwen2.5-72B-Instruct', label: 'Qwen 2.5 72B Instruct' },
      { value: 'meta-llama/Llama-3.3-70B-Instruct', label: 'Llama 3.3 70B Instruct' },
      { value: 'mistralai/Mistral-7B-Instruct-v0.3', label: 'Mistral 7B Instruct' }
    ],
    ollama: [
      { value: 'llama3.2', label: 'Llama 3.2 · local' },
      { value: 'qwen2.5:7b', label: 'Qwen 2.5 7B · local' },
      { value: 'gemma3:4b', label: 'Gemma 3 4B · local' }
    ],
    custom: [{ value: 'your-model', label: 'Your model' }]
  };

  const providerLabels = {
    demo: 'No-key demo',
    openrouter: 'OpenRouter',
    huggingface: 'Hugging Face',
    ollama: 'Ollama',
    custom: 'Custom endpoint'
  };

  const defaultPrompts = [
    { id: 'p1', title: 'Clarity editor', description: 'Turn a rough thought into a clear, confident piece of writing.', prompt: 'Act as a clarity editor. Keep my voice, remove fluff, and give me a polished version plus a short note on the biggest improvements.' },
    { id: 'p2', title: 'Idea architect', description: 'Shape a raw idea into a useful plan with milestones and trade-offs.', prompt: 'Be my idea architect. Ask only the most important questions, then turn my idea into a practical plan with milestones, risks, and a first action.' },
    { id: 'p3', title: 'Socratic tutor', description: 'Learn difficult topics through questions, examples, and retrieval.', prompt: 'Be a patient Socratic tutor. Teach me this topic from first principles, check my understanding with one question at a time, and use memorable examples.' },
    { id: 'p4', title: 'Code reviewer', description: 'Find bugs, explain them plainly, and suggest the smallest good fix.', prompt: 'Review the code I provide. Identify correctness issues, security concerns, and maintainability problems. Explain why each matters and show a focused patch.' }
  ];

  const sampleConversations = [
    { id: 'sample-1', title: 'A second brain for your ideas', updatedAt: now - 1000 * 60 * 22, messages: [] },
    { id: 'sample-2', title: 'Build a better morning routine', updatedAt: now - 1000 * 60 * 60 * 4, messages: [] },
    { id: 'sample-3', title: 'Notes from the future', updatedAt: now - 1000 * 60 * 60 * 21, messages: [] }
  ];

  const defaultState = {
    conversations: sampleConversations,
    selectedId: null,
    files: [],
    prompts: defaultPrompts,
    settings: {
      provider: 'demo',
      model: 'pluto-demo',
      endpoint: '',
      apiKey: '',
      theme: 'dark',
      compact: false,
      rail: true,
      web: false,
      thinking: false
    }
  };

  let state = loadState();
  let isGenerating = false;
  let attachedFiles = [];
  let visibleChatCount = 8;
  let toastTimer;
  let recognition;
  let commandSelection = 0;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const elements = {
    shell: $('#appShell'),
    messageList: $('#messageList'),
    welcome: $('#welcomeBlock'),
    composerShell: $('#composerShell'),
    composer: $('#promptInput'),
    send: $('#sendButton'),
    attachments: $('#attachmentStrip'),
    conversationList: $('#conversationList'),
    search: $('#chatSearch'),
    storage: $('#storageUsed'),
    rail: $('#insightRail'),
    sidebar: $('#sidebar'),
    topbarContext: $('#topbarContext'),
    fileInput: $('#fileInput'),
    library: $('#libraryGrid'),
    promptLab: $('#promptLabGrid'),
    toast: $('#toast'),
    settingsModal: $('#settingsModal'),
    commandModal: $('#commandModal'),
    commandInput: $('#commandInput'),
    commandList: $('#commandList'),
    provider: $('#providerSelect'),
    model: $('#modelSelect'),
    endpoint: $('#endpointInput'),
    apiKey: $('#apiKeyInput'),
    endpointField: $('#endpointField'),
    apiKeyField: $('#apiKeyField'),
    providerHelp: $('#providerHelp'),
    connectionStatus: $('#connectionStatus'),
    compact: $('#compactToggle'),
    railToggle: $('#railToggle')
  };

  function loadState() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!stored) return structuredClone(defaultState);
      return {
        ...structuredClone(defaultState),
        ...stored,
        settings: { ...defaultState.settings, ...(stored.settings || {}) },
        conversations: Array.isArray(stored.conversations) ? stored.conversations : [],
        files: Array.isArray(stored.files) ? stored.files : [],
        prompts: Array.isArray(stored.prompts) && stored.prompts.length ? stored.prompts : defaultPrompts
      };
    } catch (error) {
      return structuredClone(defaultState);
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      updateStorageMeter();
    } catch (error) {
      showToast('Your browser storage is full. Export your data to keep a backup.');
    }
  }

  function escapeHTML(value = '') {
    return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  }

  function renderMarkdown(value = '') {
    let text = escapeHTML(value);
    const codeBlocks = [];
    text = text.replace(/```([\w-]*)\n?([\s\S]*?)```/g, (_, language, code) => {
      const index = codeBlocks.push(`<pre><code>${code.trim()}</code></pre>`) - 1;
      return `@@CODE_BLOCK_${index}@@`;
    });
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    const blocks = text.split(/\n{2,}/).map((block) => {
      if (/^@@CODE_BLOCK_\d+@@$/.test(block.trim())) return block.trim();
      const lines = block.split('\n');
      if (lines.every((line) => /^[-*] /.test(line))) {
        return `<ul>${lines.map((line) => `<li>${line.slice(2)}</li>`).join('')}</ul>`;
      }
      if (/^### /.test(block)) return `<h4>${block.replace(/^### /, '')}</h4>`;
      if (/^## /.test(block)) return `<h3>${block.replace(/^## /, '')}</h3>`;
      return `<p>${block.replace(/\n/g, '<br>')}</p>`;
    }).join('');
    return blocks.replace(/@@CODE_BLOCK_(\d+)@@/g, (_, index) => codeBlocks[Number(index)]);
  }

  function formatTime(timestamp) {
    const delta = Math.max(0, Date.now() - timestamp);
    if (delta < 60 * 1000) return 'now';
    if (delta < 60 * 60 * 1000) return `${Math.floor(delta / (60 * 1000))}m`;
    if (delta < 24 * 60 * 60 * 1000) return `${Math.floor(delta / (60 * 60 * 1000))}h`;
    return new Date(timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  function currentConversation() {
    return state.conversations.find((conversation) => conversation.id === state.selectedId) || null;
  }

  function makeId(prefix = 'id') {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function deriveTitle(text) {
    const cleaned = text.replace(/\s+/g, ' ').trim();
    return cleaned.length > 34 ? `${cleaned.slice(0, 34).trim()}…` : (cleaned || 'New conversation');
  }

  function renderConversationList() {
    const query = elements.search.value.trim().toLowerCase();
    const filtered = [...state.conversations]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .filter((conversation) => !query || conversation.title.toLowerCase().includes(query));
    const visible = filtered.slice(0, visibleChatCount);
    elements.conversationList.innerHTML = visible.length ? visible.map((conversation) => `
      <button class="conversation-item ${conversation.id === state.selectedId ? 'active' : ''}" data-conversation-id="${escapeHTML(conversation.id)}">
        <span class="conversation-symbol">${conversation.id.startsWith('sample') ? '◌' : '✦'}</span>
        <span class="conversation-title">${escapeHTML(conversation.title)}</span>
        <span class="conversation-time">${formatTime(conversation.updatedAt)}</span>
      </button>`).join('') : `<div class="empty-side-state">${query ? 'No matching chats' : 'Your chats will appear here'}</div>`;
    $('#showMoreChats').hidden = filtered.length <= visibleChatCount;
  }

  function renderMessages() {
    const conversation = currentConversation();
    const messages = conversation?.messages || [];
    elements.welcome.style.display = messages.length ? 'none' : '';
    elements.messageList.innerHTML = messages.map((message, index) => renderMessage(message, index)).join('');
    elements.rail.style.display = state.settings.rail && !messages.length ? '' : 'none';
    if (messages.length) {
      requestAnimationFrame(() => { elements.messageList.scrollTop = elements.messageList.scrollHeight; });
    }
  }

  function renderMessage(message, index) {
    const isUser = message.role === 'user';
    const body = isUser ? escapeHTML(message.content).replace(/\n/g, '<br>') : renderMarkdown(message.content);
    const fileNote = message.attachments?.length ? `<div class="message-files">${message.attachments.map((file) => `<span>⌁ ${escapeHTML(file.name)}</span>`).join('')}</div>` : '';
    return `<article class="message ${isUser ? 'user' : 'assistant'}" data-message-index="${index}">
      ${isUser ? '' : '<div class="message-avatar">✦</div>'}
      <div class="message-bubble"><div class="message-content"><div class="message-head"><strong>${isUser ? 'You' : 'PLUTO'}</strong><time>${formatTime(message.timestamp || Date.now())}</time></div><div class="message-text">${body}</div>${fileNote}<div class="message-actions">
        <button data-message-action="copy">Copy</button>${isUser ? '<button data-message-action="edit">Edit</button>' : '<button data-message-action="speak">Read aloud</button><button data-message-action="regenerate">Regenerate</button>'}
      </div></div></div>
    </article>`;
  }

  function renderAttachments() {
    elements.attachments.hidden = !attachedFiles.length;
    elements.attachments.innerHTML = attachedFiles.map((file, index) => `<div class="attachment-chip"><span>⌁ ${escapeHTML(file.name)}</span><button data-remove-attachment="${index}" aria-label="Remove ${escapeHTML(file.name)}">×</button></div>`).join('');
  }

  function renderLibrary() {
    if (!state.files.length) {
      elements.library.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⌁</div><h3>Your library is waiting</h3><p>Attach notes, code, or images from a conversation to see them here.</p></div>`;
      return;
    }
    elements.library.innerHTML = state.files.map((file) => `<article class="library-card"><div class="file-icon">${escapeHTML(file.extension || 'FILE').slice(0, 5).toUpperCase()}</div><div><strong title="${escapeHTML(file.name)}">${escapeHTML(file.name)}</strong><small>${formatBytes(file.size)} · ${formatTime(file.addedAt)}</small></div></article>`).join('');
  }

  function renderPromptLab() {
    elements.promptLab.innerHTML = state.prompts.map((prompt) => `<article class="saved-prompt"><div class="saved-prompt-top"><span>✦</span><button data-delete-prompt="${escapeHTML(prompt.id)}" aria-label="Delete ${escapeHTML(prompt.title)}">×</button></div><h3>${escapeHTML(prompt.title)}</h3><p>${escapeHTML(prompt.description)}</p><button class="use-prompt" data-use-prompt="${escapeHTML(prompt.id)}">Use prompt <span>→</span></button></article>`).join('');
  }

  function formatBytes(bytes = 0) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function updateStorageMeter() {
    try {
      const bytes = new Blob([localStorage.getItem(STORAGE_KEY) || '']).size;
      elements.storage.textContent = formatBytes(bytes);
    } catch (error) { elements.storage.textContent = '0.0 MB'; }
  }

  function setView(viewName) {
    $$('.view').forEach((view) => view.classList.toggle('active', view.id === `${viewName}View`));
    $$('.side-nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === viewName));
    if (viewName === 'library') renderLibrary();
    if (viewName === 'prompts') renderPromptLab();
  }

  function createConversation() {
    state.selectedId = null;
    attachedFiles = [];
    renderAttachments();
    setView('chat');
    renderMessages();
    elements.composer.focus();
    if (window.innerWidth < 701) elements.sidebar.classList.remove('open');
  }

  function selectConversation(id) {
    state.selectedId = id;
    saveState();
    renderConversationList();
    renderMessages();
    setView('chat');
  }

  function ensureConversation(firstMessage) {
    let conversation = currentConversation();
    if (!conversation) {
      conversation = { id: makeId('chat'), title: deriveTitle(firstMessage), updatedAt: Date.now(), messages: [] };
      state.conversations.push(conversation);
      state.selectedId = conversation.id;
    }
    if (!conversation.messages.length) conversation.title = deriveTitle(firstMessage);
    return conversation;
  }

  function buildContext(conversation) {
    const context = conversation.messages.map((message) => ({ role: message.role, content: message.content }));
    if (state.settings.thinking) context.unshift({ role: 'system', content: 'Think carefully and show concise reasoning summaries, but do not reveal private chain-of-thought.' });
    context.unshift({ role: 'system', content: 'You are PLUTO, a capable, direct, and creative AI workspace assistant. Be honest about uncertainty. Give useful structure and ask a clarifying question only when it materially improves the result.' });
    return context;
  }

  function getAttachmentContext(files) {
    return files.map((file) => file.text ? `\n\nAttached file: ${file.name}\n${file.text.slice(0, 10000)}` : `\n\nAttached file: ${file.name} (${file.type || 'binary file'})`).join('');
  }

  async function sendMessage() {
    if (isGenerating) return;
    const text = elements.composer.value.trim();
    if (!text && !attachedFiles.length) return;
    const prompt = text || 'Please take a look at the attached file.';
    const filesForMessage = attachedFiles.map(({ name, size, type }) => ({ name, size, type }));
    const conversation = ensureConversation(prompt);
    conversation.messages.push({ role: 'user', content: prompt + getAttachmentContext(attachedFiles), attachments: filesForMessage, timestamp: Date.now() });
    conversation.updatedAt = Date.now();
    const filesToSave = attachedFiles;
    attachedFiles = [];
    elements.composer.value = '';
    resizeComposer();
    renderAttachments();
    saveState();
    renderConversationList();
    renderMessages();
    setView('chat');
    isGenerating = true;
    elements.send.disabled = true;
    const typing = addTypingMessage();
    try {
      const answer = await callProvider(buildContext(conversation), prompt, filesToSave);
      typing.remove();
      conversation.messages.push({ role: 'assistant', content: answer, timestamp: Date.now() });
      conversation.updatedAt = Date.now();
      saveState();
      renderConversationList();
      renderMessages();
    } catch (error) {
      typing.remove();
      const friendly = error?.message || 'The provider did not return a response.';
      conversation.messages.push({ role: 'assistant', content: `I couldn't connect to that provider.\n\n**${friendly}**\n\nOpen **Settings → Connection** to check the provider, endpoint, and key. You can switch back to **PLUTO Demo** for an instant no-key response.`, timestamp: Date.now() });
      saveState();
      renderMessages();
      showToast(friendly);
    } finally {
      isGenerating = false;
      elements.send.disabled = false;
      elements.composer.focus();
    }
  }

  function addTypingMessage() {
    const node = document.createElement('article');
    node.className = 'message assistant typing-message';
    node.innerHTML = '<div class="message-avatar">✦</div><div class="message-content"><div class="message-head"><strong>PLUTO</strong><time>thinking</time></div><div class="typing-dots"><i></i><i></i><i></i></div></div>';
    elements.messageList.appendChild(node);
    requestAnimationFrame(() => { elements.messageList.scrollTop = elements.messageList.scrollHeight; });
    return node;
  }

  async function callProvider(messages, prompt, files) {
    const provider = state.settings.provider;
    if (provider === 'demo') return demoResponse(prompt, files);
    if (provider === 'ollama') {
      const endpoint = state.settings.endpoint.trim();
      if (!endpoint) throw new Error('Add your Ollama endpoint in Settings first.');
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: state.settings.model, messages, stream: false }) });
      if (!response.ok) throw new Error(`Ollama returned ${response.status}.`);
      const data = await response.json();
      return data.message?.content || data.response || 'The model returned an empty response.';
    }
    const endpoint = provider === 'openrouter'
      ? 'https://openrouter.ai/api/v1/chat/completions'
      : provider === 'huggingface'
        ? 'https://router.huggingface.co/v1/chat/completions'
        : state.settings.endpoint.trim();
    if (!endpoint) throw new Error('Add an OpenAI-compatible endpoint in Settings first.');
    if (!state.settings.apiKey.trim() && provider !== 'custom') throw new Error(`Add your ${providerLabels[provider]} API key in Settings first.`);
    const headers = { 'Content-Type': 'application/json' };
    if (state.settings.apiKey.trim()) headers.Authorization = `Bearer ${state.settings.apiKey.trim()}`;
    if (provider === 'openrouter') { headers['HTTP-Referer'] = window.location.origin; headers['X-Title'] = 'PLUTO AI workspace'; }
    const response = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ model: state.settings.model, messages, temperature: .7, stream: false }) });
    if (!response.ok) {
      let detail = '';
      try { detail = (await response.json()).error?.message || ''; } catch (_) { /* empty response */ }
      throw new Error(`${providerLabels[provider]} returned ${response.status}${detail ? `: ${detail}` : '.'}`);
    }
    const data = await response.json();
    return data.choices?.[0]?.message?.content || data.choices?.[0]?.text || data.generated_text || 'The model returned an empty response.';
  }

  async function demoResponse(prompt, files) {
    await new Promise((resolve) => setTimeout(resolve, 650 + Math.random() * 550));
    const lower = prompt.toLowerCase();
    const attachmentLine = files.length ? ` I can also work from ${files.length === 1 ? 'that attachment' : 'those attachments'} once you tell me what outcome you want.` : '';
    if (/plan|roadmap|steps|organize|routine/.test(lower)) return `## A clear way forward\n\nHere’s a practical first pass:\n\n- **Define the finish line** — describe what “done” looks like in one sentence.\n- **Choose the smallest useful milestone** — something you can complete in the next 30–60 minutes.\n- **Sequence the work** — put prerequisites before polish, and leave room for feedback.\n- **Set a review point** — decide when you will pause, measure progress, and adjust.\n\n**Your next move:** write the one-sentence finish line, then I’ll turn it into a focused plan.${attachmentLine}`;
    if (/explain|understand|teach|beginner|what is/.test(lower)) return `## Let’s make it simple\n\nStart with the core idea: **every complicated system is made of smaller parts that interact**. We can name the parts, see how they connect, and then use one concrete example.\n\nTell me the topic, your current level, and what you want to be able to do with it. I’ll explain it in plain language, then check your understanding with a quick example.`;
    if (/code|javascript|python|html|bug|function|program/.test(lower)) return `## Code mode\n\nI can help you design, debug, review, or explain code. For the strongest result, include the smallest reproducible snippet and what you expected to happen.\n\n\`\`\`js\n// Paste your snippet here\nconst goal = 'make it work';\n\`\`\`\n\nI’ll return the diagnosis, a focused fix, and any edge cases worth testing.`;
    if (/write|draft|email|story|copy|create/.test(lower)) return `## Let’s get the first draft down\n\nGive me the audience, the feeling you want to create, and any must-include points. I can make the result sharp, warm, persuasive, playful, or deliberately strange — and I’ll explain the choices if you want.${attachmentLine}`;
    return `I’m PLUTO in **Demo mode** — a fast, private way to explore the workspace with no API key.\n\nI can help you think, write, research from material you provide, plan projects, explain difficult ideas, review code, or turn rough notes into something useful.\n\nFor live model responses, open **Settings → Connection** and choose a provider. Your key stays in this browser and is sent only to the provider you select.${attachmentLine}`;
  }

  function openModal(modal) { modal.hidden = false; document.body.style.overflow = 'hidden'; }
  function closeModals() { $$('.modal-backdrop').forEach((modal) => { modal.hidden = true; }); document.body.style.overflow = ''; }

  function openSettings(tab = 'connection') {
    elements.provider.value = state.settings.provider;
    elements.endpoint.value = state.settings.endpoint || '';
    elements.apiKey.value = state.settings.apiKey || '';
    elements.compact.checked = !!state.settings.compact;
    elements.railToggle.checked = state.settings.rail !== false;
    updateProviderFields();
    switchSettingsTab(tab);
    openModal(elements.settingsModal);
  }

  function switchSettingsTab(tab) {
    $$('.settings-tab').forEach((item) => item.classList.toggle('active', item.dataset.settingsTab === tab));
    $$('[data-settings-panel]').forEach((panel) => panel.classList.toggle('active', panel.dataset.settingsPanel === tab));
  }

  function updateProviderFields() {
    const provider = elements.provider.value;
    const options = modelCatalog[provider] || modelCatalog.custom;
    elements.model.innerHTML = options.map((option) => `<option value="${escapeHTML(option.value)}">${escapeHTML(option.label)}</option>`).join('');
    const modelStillExists = options.some((option) => option.value === state.settings.model);
    elements.model.value = modelStillExists ? state.settings.model : options[0].value;
    elements.endpointField.hidden = !['ollama', 'custom'].includes(provider);
    elements.apiKeyField.hidden = !['openrouter', 'huggingface', 'custom'].includes(provider);
    const help = {
      demo: 'Instant local demo mode. No requests leave this browser.',
      openrouter: 'Connect to OpenRouter and choose one of its free models. Free availability can change.',
      huggingface: 'Use a Hugging Face Router model with your own access token.',
      ollama: 'Point PLUTO at an Ollama server running on a machine you control.',
      custom: 'Use any CORS-enabled OpenAI-compatible chat completions endpoint.'
    };
    elements.providerHelp.textContent = help[provider];
    elements.connectionStatus.textContent = provider === 'demo' ? 'Running in no-key demo mode' : `${providerLabels[provider]} configured locally`;
  }

  function persistSettings() {
    state.settings.provider = elements.provider.value;
    state.settings.model = elements.model.value;
    state.settings.endpoint = elements.endpoint.value.trim();
    state.settings.apiKey = elements.apiKey.value;
    state.settings.compact = elements.compact.checked;
    state.settings.rail = elements.railToggle.checked;
    document.documentElement.dataset.theme = state.settings.theme;
    elements.shell.classList.toggle('compact', state.settings.compact);
    elements.rail.style.display = state.settings.rail && !currentConversation()?.messages?.length ? '' : 'none';
    saveState();
    updateTopbar();
  }

  function updateTopbar() {
    elements.topbarContext.innerHTML = `<span class="context-dot"></span><span>${escapeHTML(providerLabels[state.settings.provider])} · Private workspace</span>`;
  }

  function setTheme(theme) {
    state.settings.theme = theme;
    document.documentElement.dataset.theme = theme === 'system' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : theme;
    $$('.segmented button').forEach((button) => button.classList.toggle('active', button.dataset.themeChoice === theme));
    persistSettings();
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add('show');
    toastTimer = setTimeout(() => elements.toast.classList.remove('show'), 3000);
  }

  function resizeComposer() {
    elements.composer.style.height = 'auto';
    elements.composer.style.height = `${Math.min(elements.composer.scrollHeight, 180)}px`;
    elements.composer.style.overflowY = elements.composer.scrollHeight > 180 ? 'auto' : 'hidden';
  }

  function handleFiles(fileList) {
    const files = [...fileList];
    if (!files.length) return;
    Promise.all(files.slice(0, 6).map(async (file) => {
      let text = '';
      if (file.type.startsWith('text/') || /\.(md|txt|csv|json|js|ts|py|html|css)$/i.test(file.name)) {
        try { text = await file.text(); } catch (_) { /* binary or unreadable */ }
      }
      return { name: file.name, size: file.size, type: file.type, extension: file.name.includes('.') ? file.name.split('.').pop() : 'file', text, addedAt: Date.now() };
    })).then((newFiles) => {
      attachedFiles.push(...newFiles);
      const seen = new Set();
      attachedFiles = attachedFiles.filter((file) => !seen.has(file.name) && seen.add(file.name));
      newFiles.forEach((file) => {
        if (!state.files.some((saved) => saved.name === file.name && saved.size === file.size)) state.files.push({ ...file, text: undefined });
      });
      saveState();
      renderAttachments();
      showToast(`${newFiles.length} file${newFiles.length === 1 ? '' : 's'} ready to attach`);
    });
  }

  function downloadFile(filename, content, type = 'text/plain') {
    const blob = new Blob([content], { type });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 500);
  }

  function exportConversation(format = 'html') {
    const conversation = currentConversation();
    if (!conversation || !conversation.messages.length) { showToast('Start a conversation before exporting it.'); return; }
    const baseName = conversation.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pluto-conversation';
    if (format === 'json') return downloadFile(`${baseName}.json`, JSON.stringify(conversation, null, 2), 'application/json');
    if (format === 'md') {
      const markdown = `# ${conversation.title}\n\n${conversation.messages.map((message) => `## ${message.role === 'user' ? 'You' : 'PLUTO'}\n\n${message.content}`).join('\n\n')}`;
      return downloadFile(`${baseName}.md`, markdown, 'text/markdown');
    }
    if (format === 'txt') {
      const plain = `${conversation.title}\n\n${conversation.messages.map((message) => `${message.role === 'user' ? 'You' : 'PLUTO'}:\n${message.content}`).join('\n\n')}`;
      return downloadFile(`${baseName}.txt`, plain, 'text/plain');
    }
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHTML(conversation.title)} · PLUTO</title><style>body{margin:0;padding:40px;max-width:760px;font:16px/1.7 system-ui,sans-serif;color:#20232d}h1{font-size:32px;line-height:1.1}h2{margin-top:32px;font-size:13px;color:#e86652;text-transform:uppercase;letter-spacing:.1em}pre{padding:14px;background:#f1f2f5;border-radius:8px;overflow:auto}p{white-space:pre-wrap}</style></head><body><h1>${escapeHTML(conversation.title)}</h1>${conversation.messages.map((message) => `<h2>${message.role === 'user' ? 'You' : 'PLUTO'}</h2><p>${escapeHTML(message.content)}</p>`).join('')}</body></html>`;
    downloadFile(`${baseName}.html`, html, 'text/html');
    showToast('HTML export downloaded');
  }

  function exportAllData() {
    downloadFile('pluto-workspace.json', JSON.stringify({ ...state, settings: { ...state.settings, apiKey: state.settings.apiKey ? '[stored locally — redacted in export]' : '' } }, null, 2), 'application/json');
    showToast('Workspace backup downloaded');
  }

  function copyToClipboard(text) {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
    const area = document.createElement('textarea'); area.value = text; document.body.appendChild(area); area.select(); document.execCommand('copy'); area.remove(); return Promise.resolve();
  }

  function speak(text) {
    if (!('speechSynthesis' in window)) { showToast('Read aloud is not supported in this browser.'); return; }
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = .98;
    speechSynthesis.speak(utterance);
  }

  function startVoiceInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { showToast('Voice input is not supported in this browser.'); return; }
    if (recognition) { recognition.stop(); recognition = null; return; }
    recognition = new SpeechRecognition();
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onstart = () => { $('.mic-btn').classList.add('active'); showToast('Listening…'); };
    recognition.onresult = (event) => {
      const result = [...event.results].map((item) => item[0].transcript).join('');
      elements.composer.value = result;
      resizeComposer();
    };
    recognition.onerror = () => showToast('Voice input could not start. Check your browser permission.');
    recognition.onend = () => { $('.mic-btn').classList.remove('active'); recognition = null; };
    recognition.start();
  }

  function commandItems() {
    return [
      { id: 'new', icon: '+', title: 'New conversation', hint: 'Start with a blank canvas', key: '⌘ N', action: createConversation },
      { id: 'settings', icon: '⚙', title: 'Open settings', hint: 'Provider, model, theme, and privacy', action: () => openSettings() },
      { id: 'html', icon: '↧', title: 'Download current chat as HTML', hint: 'Save a readable web page', action: () => exportConversation('html') },
      { id: 'markdown', icon: 'M', title: 'Download current chat as Markdown', hint: 'Portable plain-text format', action: () => exportConversation('md') },
      { id: 'json', icon: '{}', title: 'Download current chat as JSON', hint: 'Keep the full conversation data', action: () => exportConversation('json') },
      { id: 'library', icon: '▤', title: 'Open library', hint: 'Browse attached files', action: () => setView('library') },
      { id: 'prompts', icon: '✦', title: 'Open Prompt lab', hint: 'Reuse your best workflows', action: () => setView('prompts') }
    ];
  }

  function renderCommands(filter = '') {
    const query = filter.toLowerCase();
    const items = commandItems().filter((item) => `${item.title} ${item.hint}`.toLowerCase().includes(query));
    commandSelection = Math.min(commandSelection, Math.max(0, items.length - 1));
    elements.commandList.innerHTML = items.length ? items.map((item, index) => `<button class="command-item ${index === commandSelection ? 'selected' : ''}" data-command-id="${item.id}"><span class="command-item-icon">${item.icon}</span><span class="command-item-copy"><strong>${item.title}</strong><small>${item.hint}</small></span>${item.key ? `<kbd>${item.key}</kbd>` : ''}</button>`).join('') : '<div class="empty-side-state">No commands found</div>';
  }

  function openCommand() {
    commandSelection = 0;
    renderCommands();
    openModal(elements.commandModal);
    elements.commandInput.value = '';
    setTimeout(() => elements.commandInput.focus(), 20);
  }

  function runCommand(id) {
    const item = commandItems().find((command) => command.id === id);
    closeModals();
    item?.action();
  }

  function newPrompt() {
    const title = window.prompt('Name this prompt');
    if (!title?.trim()) return;
    const instruction = window.prompt('What should PLUTO do?');
    if (!instruction?.trim()) return;
    state.prompts.unshift({ id: makeId('prompt'), title: title.trim(), description: instruction.trim().slice(0, 110), prompt: instruction.trim() });
    saveState();
    renderPromptLab();
    showToast('Prompt saved to your lab');
  }

  function handleMessageAction(button) {
    const messageNode = button.closest('.message');
    const conversation = currentConversation();
    const index = Number(messageNode?.dataset.messageIndex);
    const message = conversation?.messages[index];
    if (!message) return;
    const action = button.dataset.messageAction;
    if (action === 'copy') copyToClipboard(message.content).then(() => showToast('Copied to clipboard'));
    if (action === 'speak') speak(message.content);
    if (action === 'edit') { elements.composer.value = message.content; resizeComposer(); elements.composer.focus(); showToast('Message moved to composer'); }
    if (action === 'regenerate') regenerate(index);
  }

  async function regenerate(index) {
    const conversation = currentConversation();
    if (!conversation || isGenerating || index < 1) return;
    const previousUser = [...conversation.messages.slice(0, index)].reverse().find((message) => message.role === 'user');
    if (!previousUser) return;
    conversation.messages.splice(index);
    renderMessages();
    isGenerating = true; elements.send.disabled = true;
    const typing = addTypingMessage();
    try {
      const answer = await callProvider(buildContext(conversation), previousUser.content, []);
      typing.remove(); conversation.messages.push({ role: 'assistant', content: answer, timestamp: Date.now() }); saveState(); renderMessages();
    } catch (error) { typing.remove(); showToast(error.message); }
    finally { isGenerating = false; elements.send.disabled = false; }
  }

  function clearLocalData() {
    if (!window.confirm('Clear conversations, files, prompts, and connection settings from this browser?')) return;
    localStorage.removeItem(STORAGE_KEY);
    state = structuredClone(defaultState);
    attachedFiles = [];
    closeModals();
    applyState();
    showToast('Local workspace cleared');
  }

  function applyState() {
    const theme = state.settings.theme === 'system' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : state.settings.theme;
    document.documentElement.dataset.theme = theme;
    elements.shell.classList.toggle('compact', state.settings.compact);
    elements.rail.style.display = state.settings.rail ? '' : 'none';
    updateTopbar();
    renderConversationList(); renderMessages(); renderAttachments(); renderLibrary(); renderPromptLab(); updateStorageMeter();
  }

  document.addEventListener('click', (event) => {
    const actionElement = event.target.closest('[data-action]');
    if (actionElement) {
      const action = actionElement.dataset.action;
      if (action === 'new-chat') createConversation();
      if (action === 'toggle-sidebar') {
        if (window.innerWidth < 701) elements.sidebar.classList.toggle('open');
        else elements.shell.classList.toggle('sidebar-collapsed');
      }
      if (action === 'open-settings') openSettings();
      if (action === 'close-modal') closeModals();
      if (action === 'open-command') openCommand();
      if (action === 'toggle-theme') setTheme(state.settings.theme === 'light' ? 'dark' : 'light');
      if (action === 'attach') elements.fileInput.click();
      if (action === 'send') sendMessage();
      if (action === 'toggle-web') { state.settings.web = !state.settings.web; actionElement.classList.toggle('active', state.settings.web); $('#webStatus').textContent = state.settings.web ? 'ON' : 'OFF'; saveState(); showToast(state.settings.web ? 'Web access marked ON for connected providers' : 'Web access OFF'); }
      if (action === 'toggle-thinking') { state.settings.thinking = !state.settings.thinking; actionElement.classList.toggle('active', state.settings.thinking); $('#thinkStatus').textContent = state.settings.thinking ? 'ON' : 'OFF'; saveState(); }
      if (action === 'voice-input') startVoiceInput();
      if (action === 'toggle-secret') { elements.apiKey.type = elements.apiKey.type === 'password' ? 'text' : 'password'; actionElement.textContent = elements.apiKey.type === 'password' ? 'Show' : 'Hide'; }
      if (action === 'test-connection') { persistSettings(); showToast(state.settings.provider === 'demo' ? 'Demo is ready — no connection needed' : 'Settings saved. Send a message to test the provider.'); }
      if (action === 'export-all') exportAllData();
      if (action === 'clear-data') clearLocalData();
      return;
    }
    const viewButton = event.target.closest('[data-view]');
    if (viewButton) { setView(viewButton.dataset.view); return; }
    const targetView = event.target.closest('[data-view-target]');
    if (targetView) { setView(targetView.dataset.viewTarget); return; }
    const promptCard = event.target.closest('[data-prompt]');
    if (promptCard) { elements.composer.value = promptCard.dataset.prompt; resizeComposer(); elements.composer.focus(); return; }
    const conversationButton = event.target.closest('[data-conversation-id]');
    if (conversationButton) { selectConversation(conversationButton.dataset.conversationId); return; }
    const messageButton = event.target.closest('[data-message-action]');
    if (messageButton) { handleMessageAction(messageButton); return; }
    const removeAttachment = event.target.closest('[data-remove-attachment]');
    if (removeAttachment) { attachedFiles.splice(Number(removeAttachment.dataset.removeAttachment), 1); renderAttachments(); return; }
    const settingsTab = event.target.closest('[data-settings-tab]');
    if (settingsTab) { switchSettingsTab(settingsTab.dataset.settingsTab); return; }
    const themeChoice = event.target.closest('[data-theme-choice]');
    if (themeChoice) { setTheme(themeChoice.dataset.themeChoice); return; }
    const command = event.target.closest('[data-command-id]');
    if (command) { runCommand(command.dataset.commandId); return; }
    const deletePrompt = event.target.closest('[data-delete-prompt]');
    if (deletePrompt) { state.prompts = state.prompts.filter((prompt) => prompt.id !== deletePrompt.dataset.deletePrompt); saveState(); renderPromptLab(); return; }
    const usePrompt = event.target.closest('[data-use-prompt]');
    if (usePrompt) { const prompt = state.prompts.find((item) => item.id === usePrompt.dataset.usePrompt); if (prompt) { setView('chat'); elements.composer.value = prompt.prompt; resizeComposer(); elements.composer.focus(); } return; }
    if (event.target.classList.contains('modal-backdrop')) closeModals();
  });

  elements.composer.addEventListener('input', resizeComposer);
  elements.composer.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); sendMessage(); }
  });
  elements.search.addEventListener('input', () => { visibleChatCount = 8; renderConversationList(); });
  $('#showMoreChats').addEventListener('click', () => { visibleChatCount += 8; renderConversationList(); });
  elements.fileInput.addEventListener('change', (event) => { handleFiles(event.target.files); event.target.value = ''; });
  ['dragenter', 'dragover'].forEach((type) => elements.composerShell.addEventListener(type, (event) => { event.preventDefault(); document.body.classList.add('drag-active'); }));
  ['dragleave', 'drop'].forEach((type) => elements.composerShell.addEventListener(type, (event) => { event.preventDefault(); document.body.classList.remove('drag-active'); }));
  elements.composerShell.addEventListener('drop', (event) => handleFiles(event.dataTransfer.files));
  elements.provider.addEventListener('change', () => { state.settings.provider = elements.provider.value; state.settings.model = ''; updateProviderFields(); persistSettings(); });
  elements.model.addEventListener('change', persistSettings);
  elements.endpoint.addEventListener('change', persistSettings);
  elements.apiKey.addEventListener('change', persistSettings);
  elements.compact.addEventListener('change', persistSettings);
  elements.railToggle.addEventListener('change', persistSettings);
  elements.commandInput.addEventListener('input', () => { commandSelection = 0; renderCommands(elements.commandInput.value); });
  elements.commandInput.addEventListener('keydown', (event) => {
    const items = $$('.command-item', elements.commandList);
    if (event.key === 'ArrowDown') { event.preventDefault(); commandSelection = Math.min(commandSelection + 1, items.length - 1); renderCommands(elements.commandInput.value); }
    if (event.key === 'ArrowUp') { event.preventDefault(); commandSelection = Math.max(commandSelection - 1, 0); renderCommands(elements.commandInput.value); }
    if (event.key === 'Enter' && items[commandSelection]) runCommand(items[commandSelection].dataset.commandId);
  });

  document.addEventListener('keydown', (event) => {
    const modifier = event.metaKey || event.ctrlKey;
    if (modifier && event.key.toLowerCase() === 'k') { event.preventDefault(); openCommand(); }
    if (modifier && event.key === '/') { event.preventDefault(); elements.search.focus(); }
    if (event.key === 'Escape') closeModals();
  });

  window.matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', () => { if (state.settings.theme === 'system') setTheme('system'); });
  applyState();
})();
