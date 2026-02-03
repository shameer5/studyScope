/* StudyScribe UI behaviors.
 * This file is intentionally monolithic to avoid bundlers/npm in the project.
 */

// ---- Shared UI constants & helpers ----
const TOAST_TIMEOUTS = {
  success: 2400,
  info: 2600,
  warning: 3500,
  error: 6000,
};

const TOAST_KEY = "studyscribeQueuedToast";
const FILE_RULES = {
  audio: {
    extensions: [".wav", ".mp3", ".m4a", ".aac", ".flac", ".ogg"],
    label: "audio",
    message: "Unsupported audio file. Please upload WAV, MP3, M4A, AAC, FLAC, or OGG.",
  },
  attachment: {
    extensions: [".pdf", ".ppt", ".pptx", ".doc", ".docx"],
    label: "attachment",
    message: "Unsupported attachment. Please upload PDF, PPT/PPTX, or DOC/DOCX.",
  },
};

// Track generated heading slugs to avoid duplicates in the DOM.
const _usedHeadingSlugs = new Set();

const toastIconSvg = (tone) => {
  if (tone === "success") {
    return `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M6.5 12.5l3.2 3.2L17.5 8.8"></path>
      </svg>
    `;
  }
  if (tone === "warning") {
    return `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 7.5v6"></path>
        <path d="M12 16.5h.01"></path>
      </svg>
    `;
  }
  if (tone === "error") {
    return `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 8l8 8"></path>
        <path d="M16 8l-8 8"></path>
      </svg>
    `;
  }
  return `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 10.5v6"></path>
      <path d="M12 7.5h.01"></path>
    </svg>
  `;
};

const safeJsonParse = (value, fallback = null) => {
  try {
    return JSON.parse(value);
  } catch (err) {
    return fallback;
  }
};

const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  return { response, data };
};

const escapeHtml = (value) => {
  const div = document.createElement("div");
  div.textContent = value || "";
  return div.innerHTML;
};

const renderMarkdown = (markdown, { cite = false, anchors = false } = {}) => {
  const lines = (markdown || "").replace(/\r\n/g, "\n").split("\n");
  let html = "";
  let inList = false;
  let listType = null;
  let inCodeBlock = false;
  let codeLang = "";
  const slugifyHeading = (value) => {
    const base = String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const safeBase = base || "section";
    let slug = safeBase;
    let idx = 1;
    while (_usedHeadingSlugs.has(slug)) {
      slug = `${safeBase}-${idx}`;
      idx += 1;
    }
    _usedHeadingSlugs.add(slug);
    return slug;
  };

  const renderInline = (value) => {
    let escaped = escapeHtml(value || "");
    const codeSegments = [];
    escaped = escaped.replace(/`([^`]+)`/g, (_match, code) => {
      const token = `__CODE_${codeSegments.length}__`;
      codeSegments.push(`<code>${escapeHtml(code)}</code>`);
      return token;
    });
    escaped = escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    escaped = escaped.replace(/(^|[^*])\*(?!\*)([^*]+)\*(?!\*)/g, "$1<em>$2</em>");
    escaped = escaped.replace(/(^|[^_])_([^_]+)_/g, "$1<em>$2</em>");
    if (cite) {
      escaped = escaped.replace(/\[(\d+)\]/g, '<sup class="citation">[$1]</sup>');
    }
    codeSegments.forEach((segment, index) => {
      escaped = escaped.replace(`__CODE_${index}__`, segment);
    });
    return escaped;
  };

  const closeList = () => {
    if (inList && listType) {
      html += `</${listType}>`;
      inList = false;
      listType = null;
    }
  };

  const closeCodeBlock = () => {
    if (inCodeBlock) {
      html += "</code></pre>";
      inCodeBlock = false;
      codeLang = "";
    }
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      closeList();
      if (!inCodeBlock) {
        codeLang = trimmed.replace(/```/, "").trim();
        const langClass = codeLang ? ` class="language-${escapeHtml(codeLang)}"` : "";
        html += `<pre><code${langClass}>`;
        inCodeBlock = true;
      } else {
        closeCodeBlock();
      }
      return;
    }
    if (inCodeBlock) {
      html += `${escapeHtml(line)}\n`;
      return;
    }
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      closeList();
      const level = headingMatch[1].length;
      if (anchors) {
        const slug = slugifyHeading(headingMatch[2]);
        const anchor = `ai-notes-h${level}-${slug}`;
        html += `<h${level} id="${anchor}" data-anchor="${anchor}" data-jump-kind="ai_notes" data-anchor-id="${anchor}">${renderInline(headingMatch[2])}</h${level}>`;
      } else {
        html += `<h${level}>${renderInline(headingMatch[2])}</h${level}>`;
      }
      return;
    }
    const orderedMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (orderedMatch) {
      if (!inList || listType !== "ol") {
        closeList();
        html += "<ol>";
        inList = true;
        listType = "ol";
      }
      html += `<li>${renderInline(orderedMatch[2])}</li>`;
      return;
    }
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      if (!inList || listType !== "ul") {
        closeList();
        html += "<ul>";
        inList = true;
        listType = "ul";
      }
      html += `<li>${renderInline(trimmed.replace(/^[-*]\s+/, ""))}</li>`;
      return;
    }
    if (!trimmed) {
      closeList();
      return;
    }
    closeList();
    html += `<p>${renderInline(trimmed)}</p>`;
  });

  closeList();
  closeCodeBlock();
  return html;
};

const runTypewriter = (el, text, { chunk = 2, onComplete, onUpdate, render } = {}) => {
  if (!el) return { skip: () => {} };
  const content = text || "";
  const token = String(Date.now());
  let done = false;
  el.dataset.typewriterToken = token;
  el.textContent = "";
  el.classList.remove("markdownContent");
  let index = 0;
  const applyRender = (value) => {
    if (typeof render === "function") {
      render(value);
    } else {
      el.textContent = value;
    }
  };

  const finish = () => {
    if (done) return;
    done = true;
    if (el.dataset.typewriterToken !== token) return;
    applyRender(content);
    if (typeof onComplete === "function") {
      onComplete(content);
    }
  };

  const step = () => {
    if (el.dataset.typewriterToken !== token) return;
    index = Math.min(index + chunk, content.length);
    const slice = content.slice(0, index);
    applyRender(slice);
    if (typeof onUpdate === "function") {
      onUpdate(slice);
    }
    if (index < content.length) {
      window.requestAnimationFrame(step);
    } else {
      finish();
    }
  };

  window.requestAnimationFrame(step);

  return {
    skip: () => {
      if (el.dataset.typewriterToken !== token) return;
      finish();
    },
  };
};

const getScrollParent = (el) => {
  if (!el) return document.scrollingElement || document.documentElement;
  let current = el.parentElement;
  while (current && current !== document.body) {
    const styles = window.getComputedStyle(current);
    if (/(auto|scroll)/.test(styles.overflowY)) {
      return current;
    }
    current = current.parentElement;
  }
  return document.scrollingElement || document.documentElement;
};

const createAutoScroller = (el, { threshold = 60 } = {}) => {
  const container = getScrollParent(el);
  if (!container) {
    return { maybeScroll: () => {}, isPinned: () => true };
  }
  let pinned = true;
  const updatePinned = () => {
    const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
    pinned = distance <= threshold;
  };
  updatePinned();
  container.addEventListener("scroll", updatePinned);
  return {
    maybeScroll: () => {
      if (!pinned) return;
      container.scrollTop = container.scrollHeight;
    },
    isPinned: () => pinned,
  };
};

const parseSessionMeta = () => {
  const el = document.getElementById("sessionMeta");
  if (!el) return null;
  const parsed = safeJsonParse(el.textContent || "{}", {});
  return parsed && typeof parsed === "object" ? parsed : null;
};

const queueToastForNextLoad = (tone, message, title) => {
  const payload = { tone, message, title };
  sessionStorage.setItem(TOAST_KEY, JSON.stringify(payload));
};

const consumeQueuedToast = (showToast) => {
  const raw = sessionStorage.getItem(TOAST_KEY);
  if (!raw) return;
  sessionStorage.removeItem(TOAST_KEY);
  const payload = safeJsonParse(raw, null);
  if (!payload || !payload.message) return;
  showToast(payload.tone || "info", payload.message, { title: payload.title });
};

const getToastStack = () => {
  return document.getElementById("toastStack") || document.querySelector(".toast-stack");
};

const trimToasts = (stack) => {
  if (!stack) return;
  const toasts = Array.from(stack.querySelectorAll(".toast"));
  if (toasts.length <= 3) return;
  const overflow = toasts.length - 3;
  toasts.slice(0, overflow).forEach((toast) => toast.remove());
};

const setupToast = (toast, stack) => {
  if (!toast || toast.dataset.toastReady === "true") return;
  toast.dataset.toastReady = "true";
  const close = toast.querySelector(".toastClose");
  const toneMatch = Array.from(toast.classList).find((cls) => cls.startsWith("toast--"));
  const tone = toneMatch ? toneMatch.replace("toast--", "") : "info";
  const timeout = Number(toast.dataset.timeout || TOAST_TIMEOUTS[tone] || TOAST_TIMEOUTS.info);
  let timer = null;

  const removeToast = () => {
    toast.classList.add("toastHidden");
    window.setTimeout(() => {
      toast.remove();
    }, 200);
  };

  if (close) {
    close.addEventListener("click", removeToast);
  }

  if (timeout > 0) {
    timer = window.setTimeout(removeToast, timeout);
    toast.addEventListener("mouseenter", () => {
      if (timer) window.clearTimeout(timer);
    });
    toast.addEventListener("mouseleave", () => {
      timer = window.setTimeout(removeToast, timeout);
    });
  }

  trimToasts(stack);
};

const buildToast = (tone, message, title) => {
  const toast = document.createElement("div");
  toast.className = `toast toast--${tone}`;
  toast.dataset.timeout = String(TOAST_TIMEOUTS[tone] || TOAST_TIMEOUTS.info);
  const toastTitle = title || tone.charAt(0).toUpperCase() + tone.slice(1);
  toast.innerHTML = `
    <div class="toastIcon" aria-hidden="true">
      <div class="toastIconBadge">
        ${toastIconSvg(tone)}
      </div>
    </div>
    <div class="toastContent">
      <div class="toastTitle">${toastTitle}</div>
      <div class="toastMsg"></div>
    </div>
    <button class="toastClose" type="button" aria-label="Dismiss toast">&times;</button>
  `;
  const msgEl = toast.querySelector(".toastMsg");
  if (msgEl) {
    msgEl.textContent = message;
  }
  return toast;
};

const setupToastSystem = () => {
  const stack = getToastStack();
  if (!stack) {
    return {
      showToast: () => {},
    };
  }

  const showToast = (tone, message, options = {}) => {
    const safeTone = tone && TOAST_TIMEOUTS[tone] ? tone : "info";
    const toast = buildToast(safeTone, message, options.title);
    stack.appendChild(toast);
    setupToast(toast, stack);
  };

  const initialToasts = Array.from(stack.querySelectorAll(".toast"));
  initialToasts.forEach((toast) => setupToast(toast, stack));
  trimToasts(stack);
  consumeQueuedToast(showToast);

  return { showToast };
};

const getExtension = (filename) => {
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex === -1) return "";
  return filename.slice(dotIndex).toLowerCase();
};

const renderFileChips = (container, files) => {
  if (!container) return;
  container.innerHTML = "";
  const list = Array.from(files || []);
  if (!list.length) return;
  list.forEach((file) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = file.name;
    container.appendChild(chip);
  });
};

const validateFiles = (files, rule) => {
  const list = Array.from(files || []);
  if (!list.length) return { ok: true };
  const invalid = list.find((file) => !rule.extensions.includes(getExtension(file.name)));
  if (invalid) {
    return { ok: false, file: invalid };
  }
  return { ok: true };
};

const setupFilePickers = (showToast) => {
  const inputs = Array.from(document.querySelectorAll("[data-file-input]"));
  if (!inputs.length) return;

  const handleUpdate = (input) => {
    const kind = input.dataset.fileKind || "attachment";
    const rule = FILE_RULES[kind] || FILE_RULES.attachment;
    const chips = input.closest(".filePicker")?.querySelector("[data-file-chips]");
    const result = validateFiles(input.files, rule);
    if (!result.ok) {
      showToast("error", rule.message);
      input.value = "";
      renderFileChips(chips, []);
      return false;
    }
    renderFileChips(chips, input.files);
    return true;
  };

  inputs.forEach((input) => {
    input.addEventListener("change", () => handleUpdate(input));
    const form = input.closest("form");
    if (form) {
      form.addEventListener("submit", (event) => {
        if (!handleUpdate(input)) {
          event.preventDefault();
        }
      });
    }
  });
};

const notesSlashCommands = [
  { key: "/h1", label: "Heading 1", type: "heading", level: 1 },
  { key: "/h2", label: "Heading 2", type: "heading", level: 2 },
  { key: "/h3", label: "Heading 3", type: "heading", level: 3 },
  { key: "/bullet", label: "Bullet list", type: "list", listType: "ul" },
  { key: "/quote", label: "Quote", type: "blockquote" },
  { key: "/divider", label: "Divider", type: "divider" },
];

const blockTriggers = [
  { prefix: "###", type: "heading", level: 3 },
  { prefix: "##", type: "heading", level: 2 },
  { prefix: "#", type: "heading", level: 1 },
  { prefix: "1.", type: "list", listType: "ol" },
  { prefix: "-", type: "list", listType: "ul" },
];

const blockTagNames = new Set(["DIV", "P", "H1", "H2", "H3", "LI", "BLOCKQUOTE"]);

const getSelectionRange = () => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  return selection.getRangeAt(0);
};

const selectionWithin = (container) => {
  const range = getSelectionRange();
  if (!range) return false;
  const node = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
    ? range.commonAncestorContainer
    : range.commonAncestorContainer.parentElement;
  return !!(node && container.contains(node));
};

const ensureEditorHasBlock = (editor) => {
  if (!editor) return;
  const hasContent = editor.textContent.replace(/\u200b/g, "").trim().length > 0;
  const hasBlocks = editor.querySelector("div, p, h1, h2, h3, ul, ol, blockquote, hr");
  if (!hasContent && !hasBlocks) {
    editor.innerHTML = "<div><br></div>";
  }
};

const findCurrentBlock = (editor) => {
  const range = getSelectionRange();
  if (!range) {
    return editor.firstElementChild || editor;
  }
  let node = range.endContainer.nodeType === Node.TEXT_NODE
    ? range.endContainer.parentElement
    : range.endContainer;
  while (node && node !== editor) {
    if (node.nodeType === Node.ELEMENT_NODE && blockTagNames.has(node.tagName)) {
      return node;
    }
    node = node.parentElement;
  }
  return editor.firstElementChild || editor;
};

const getTextBeforeCaret = (block, range) => {
  if (!block || !range) return "";
  const clone = range.cloneRange();
  clone.selectNodeContents(block);
  clone.setEnd(range.endContainer, range.endOffset);
  return clone.toString();
};

const resolveTextPosition = (root, offset) => {
  const doc = root.ownerDocument || document;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  let remaining = Math.max(offset, 0);

  while (current) {
    const length = current.textContent ? current.textContent.length : 0;
    if (remaining <= length) {
      return { node: current, offset: remaining };
    }
    remaining -= length;
    current = walker.nextNode();
  }

  const textNode = doc.createTextNode("");
  root.appendChild(textNode);
  return { node: textNode, offset: 0 };
};

const setCaretAtOffset = (root, offset) => {
  const selection = window.getSelection();
  if (!selection) return;
  const position = resolveTextPosition(root, offset);
  const range = document.createRange();
  range.setStart(position.node, position.offset);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
};

const deleteTextRange = (block, startOffset, endOffset) => {
  const start = resolveTextPosition(block, startOffset);
  const end = resolveTextPosition(block, Math.max(endOffset, startOffset));
  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  range.deleteContents();
  setCaretAtOffset(block, startOffset);
};

const replaceBlock = (oldBlock, newBlock) => {
  const parent = oldBlock.parentNode;
  if (!parent) return;
  parent.replaceChild(newBlock, oldBlock);
};

const cleanTriggerPrefix = (text, prefix) => {
  if (!text) return "";
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`^${escaped}\\s*`);
  return text.replace(regex, "").trimStart();
};

const transformToHeading = (block, level, prefix) => {
  const next = document.createElement(`h${level}`);
  const text = cleanTriggerPrefix(block.textContent || "", prefix || "");
  if (text) {
    next.textContent = text;
  } else {
    next.innerHTML = "<br>";
  }
  replaceBlock(block, next);
  const caretOffset = text.length;
  setCaretAtOffset(next, caretOffset);
  return next;
};

const transformToList = (block, listType, prefix) => {
  const list = document.createElement(listType);
  const item = document.createElement("li");
  const text = cleanTriggerPrefix(block.textContent || "", prefix || "");
  if (text) {
    item.textContent = text;
  } else {
    item.innerHTML = "<br>";
  }
  list.appendChild(item);
  replaceBlock(block, list);
  const caretOffset = text.length;
  setCaretAtOffset(item, caretOffset);
  return item;
};

const transformToBlockquote = (block) => {
  const next = document.createElement("blockquote");
  const text = (block.textContent || "").trim();
  if (text) {
    next.textContent = text;
  } else {
    next.innerHTML = "<br>";
  }
  replaceBlock(block, next);
  const caretOffset = text.length;
  setCaretAtOffset(next, caretOffset);
  return next;
};

const transformToDivider = (block) => {
  const divider = document.createElement("hr");
  const parent = block.parentNode;
  if (!parent) return block;
  parent.replaceChild(divider, block);
  const nextBlock = document.createElement("div");
  nextBlock.innerHTML = "<br>";
  divider.insertAdjacentElement("afterend", nextBlock);
  setCaretAtOffset(nextBlock, 0);
  return nextBlock;
};

const applyCommandToBlock = (block, command, prefix) => {
  if (!block || !command) return block;
  if (command.type === "heading") {
    return transformToHeading(block, command.level, prefix);
  }
  if (command.type === "list") {
    return transformToList(block, command.listType, prefix);
  }
  if (command.type === "blockquote") {
    return transformToBlockquote(block);
  }
  if (command.type === "divider") {
    return transformToDivider(block);
  }
  return block;
};

const detectBlockTrigger = (textBeforeCaret) => {
  const normalized = textBeforeCaret.replace(/\u00a0/g, " ").trim();
  return blockTriggers.find((trigger) => trigger.prefix === normalized) || null;
};

const getCaretRect = (block, caretOffset) => {
  const selection = window.getSelection();
  if (!selection) return null;
  const range = document.createRange();
  const position = resolveTextPosition(block, caretOffset);
  range.setStart(position.node, position.offset);
  range.collapse(true);

  const marker = document.createElement("span");
  marker.textContent = "\u200b";
  range.insertNode(marker);
  const rect = marker.getBoundingClientRect();
  marker.remove();
  setCaretAtOffset(block, caretOffset);
  return rect;
};

const htmlToMarkdown = (html) => {
  if (!html || !html.trim()) return "";
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const blocks = [];

  const pushBlock = (value) => {
    const text = (value || "").trim();
    if (text) blocks.push(text);
  };

  const renderList = (node, ordered) => {
    const items = Array.from(node.querySelectorAll(":scope > li"));
    if (!items.length) return;
    items.forEach((li, index) => {
      const prefix = ordered ? `${index + 1}. ` : "- ";
      pushBlock(prefix + (li.textContent || "").trim());
    });
  };

  Array.from(doc.body.childNodes).forEach((node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) {
      pushBlock(node.textContent);
      return;
    }
    const tag = node.tagName;
    if (tag === "H1") {
      pushBlock(`# ${(node.textContent || "").trim()}`);
      return;
    }
    if (tag === "H2") {
      pushBlock(`## ${(node.textContent || "").trim()}`);
      return;
    }
    if (tag === "H3") {
      pushBlock(`### ${(node.textContent || "").trim()}`);
      return;
    }
    if (tag === "UL") {
      renderList(node, false);
      return;
    }
    if (tag === "OL") {
      renderList(node, true);
      return;
    }
    if (tag === "BLOCKQUOTE") {
      pushBlock(`> ${(node.textContent || "").trim()}`);
      return;
    }
    if (tag === "HR") {
      pushBlock("---");
      return;
    }
    pushBlock(node.textContent);
  });

  return blocks.join("\n\n").trim();
};

const isEditorEmpty = (editor) => {
  if (!editor) return true;
  const text = editor.textContent.replace(/\u200b/g, "").trim();
  return text.length === 0;
};

const normalizeEditorHtml = (editor) => {
  if (!editor || isEditorEmpty(editor)) {
    return "";
  }
  return editor.innerHTML.trim();
};

const setupNotesEditor = (editor) => {
  if (!editor) return;
  const container = editor.closest("[data-notes-container]");
  const menu = container ? container.querySelector("[data-notes-slash-menu]") : null;
  const htmlInput = container ? container.querySelector("[data-notes-html-input]") : null;
  const markdownInput = container ? container.querySelector("[data-notes-markdown-input]") : null;
  const form = editor.closest("form");

  if (!container || !menu || !form || !htmlInput || !markdownInput) {
    return;
  }

  const slashState = {
    items: [],
    activeIndex: 0,
    startOffset: null,
    block: null,
    caretOffset: null,
  };

  const closeMenu = () => {
    menu.classList.add("is-hidden");
    menu.innerHTML = "";
    slashState.items = [];
    slashState.activeIndex = 0;
    slashState.startOffset = null;
    slashState.block = null;
    slashState.caretOffset = null;
  };

  const renderMenu = () => {
    if (!slashState.items.length || slashState.startOffset == null || !slashState.block) {
      closeMenu();
      return;
    }
    menu.innerHTML = "";
    slashState.items.forEach((item, index) => {
      const entry = document.createElement("div");
      entry.className = "slashItem";
      if (index === slashState.activeIndex) {
        entry.classList.add("slashItemActive");
      }
      entry.dataset.index = String(index);
      entry.innerHTML = `<span>${item.key} ${item.label}</span><small></small>`;
      menu.appendChild(entry);
    });
  };

  const positionMenu = () => {
    if (!slashState.block || slashState.caretOffset == null) return;
    const rect = getCaretRect(slashState.block, slashState.caretOffset);
    if (!rect) return;
    const containerRect = container.getBoundingClientRect();
    const top = rect.bottom - containerRect.top + container.scrollTop + 8;
    const left = rect.left - containerRect.left + container.scrollLeft;
    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;
  };

  const openMenu = () => {
    renderMenu();
    positionMenu();
    if (slashState.items.length) {
      menu.classList.remove("is-hidden");
    }
  };

  const applySlashCommand = (command) => {
    if (!slashState.block || slashState.startOffset == null || slashState.caretOffset == null) {
      closeMenu();
      return;
    }
    deleteTextRange(slashState.block, slashState.startOffset, slashState.caretOffset);
    const block = findCurrentBlock(editor);
    applyCommandToBlock(block, command);
    closeMenu();
  };

  const updateSlashMenu = () => {
    if (!selectionWithin(editor)) {
      closeMenu();
      return;
    }
    const range = getSelectionRange();
    if (!range) {
      closeMenu();
      return;
    }
    const block = findCurrentBlock(editor);
    const textBeforeCaret = getTextBeforeCaret(block, range);
    const slashIndex = textBeforeCaret.lastIndexOf("/");
    if (slashIndex === -1) {
      closeMenu();
      return;
    }

    const query = textBeforeCaret.slice(slashIndex + 1).trim().toLowerCase();
    const caretOffset = textBeforeCaret.length;
    const items = notesSlashCommands.filter((command) =>
      command.key.slice(1).startsWith(query),
    );

    if (!items.length) {
      closeMenu();
      return;
    }

    slashState.items = items;
    slashState.activeIndex = Math.min(slashState.activeIndex, items.length - 1);
    slashState.startOffset = slashIndex;
    slashState.block = block;
    slashState.caretOffset = caretOffset;
    openMenu();
  };

  const syncInputs = () => {
    const html = normalizeEditorHtml(editor);
    htmlInput.value = html;
    markdownInput.value = htmlToMarkdown(html);
  };

  editor.addEventListener("focus", () => ensureEditorHasBlock(editor));

  editor.addEventListener("input", () => {
    ensureEditorHasBlock(editor);
    updateSlashMenu();
    syncInputs();
  });

  editor.addEventListener("click", () => {
    ensureEditorHasBlock(editor);
    updateSlashMenu();
  });

  editor.addEventListener("keydown", (event) => {
    if (!selectionWithin(editor)) return;

    const menuOpen = !menu.classList.contains("is-hidden");
    if (menuOpen) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        slashState.activeIndex = (slashState.activeIndex + 1) % slashState.items.length;
        openMenu();
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        slashState.activeIndex = (slashState.activeIndex - 1 + slashState.items.length) % slashState.items.length;
        openMenu();
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const command = slashState.items[slashState.activeIndex];
        if (command) {
          applySlashCommand(command);
          syncInputs();
        }
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
        return;
      }
    }

    if (event.key === " ") {
      const range = getSelectionRange();
      const block = findCurrentBlock(editor);
      const textBeforeCaret = getTextBeforeCaret(block, range);
      const trigger = detectBlockTrigger(textBeforeCaret);
      if (trigger) {
        event.preventDefault();
        applyCommandToBlock(block, trigger, trigger.prefix);
        closeMenu();
        syncInputs();
      }
    }

    if (event.key === "Escape") {
      closeMenu();
    }
  });

  menu.addEventListener("click", (event) => {
    const target = event.target.closest(".slashItem");
    if (!target) return;
    const index = Number(target.dataset.index);
    const command = slashState.items[index];
    if (command) {
      applySlashCommand(command);
      syncInputs();
    }
  });

  document.addEventListener("click", (event) => {
    if (!container.contains(event.target)) {
      closeMenu();
    }
  });

  form.addEventListener("submit", () => {
    syncInputs();
  });

  ensureEditorHasBlock(editor);
  syncInputs();
};

const parseFilenameFromDisposition = (header) => {
  if (!header) return null;
  const match = header.match(/filename\*?=(?:UTF-8''|\")?([^";]+)/i);
  if (!match) return null;
  return decodeURIComponent(match[1].replace(/\"/g, "").trim());
};

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || "studyscribe_export.zip";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const setupExportModal = (showToast) => {
  const openBtn = document.getElementById("exportOpen");
  const backdrop = document.getElementById("exportBackdrop");
  const modal = document.getElementById("exportModal");
  const form = document.querySelector("[data-export-form]");
  const closeButtons = document.querySelectorAll("[data-export-close]");
  const submitBtn = document.querySelector("[data-export-submit]");
  const optionInputs = Array.from(document.querySelectorAll("[data-export-option]"));
  const hasModal = !!(openBtn && backdrop && modal && form && submitBtn && optionInputs.length);

  const setOpen = (isOpen) => {
    if (!modal || !backdrop) return;
    modal.classList.toggle("is-hidden", !isOpen);
    backdrop.classList.toggle("is-hidden", !isOpen);
    if (isOpen) {
      const firstOption = optionInputs.find((input) => !input.disabled);
      if (firstOption) {
        firstOption.focus();
      }
      updateSubmitState();
    }
  };

  const isOpen = () => !modal.classList.contains("is-hidden");
  const close = () => setOpen(false);

  if (openBtn) {
    openBtn.addEventListener("click", () => {
      console.log("Export clicked");
      if (!hasModal) {
        showToast("error", "Export unavailable.");
        return;
      }
      setOpen(true);
    });
  }

  if (!hasModal) {
    return {
      isOpen: () => false,
      close: () => {},
    };
  }

  const updateSubmitState = () => {
    const anyChecked = optionInputs.some((input) => input.checked);
    submitBtn.disabled = !anyChecked;
    submitBtn.setAttribute("aria-disabled", String(!anyChecked));
  };

  optionInputs.forEach((input) => {
    input.addEventListener("change", updateSubmitState);
  });

  backdrop.addEventListener("click", close);
  closeButtons.forEach((btn) => btn.addEventListener("click", close));

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    updateSubmitState();
    if (submitBtn.disabled) {
      showToast("info", "Select at least one item to export.");
      return;
    }

    const formData = new FormData(form);
    try {
      console.log("request sent");
      const response = await fetch(form.action, {
        method: "POST",
        body: formData,
        headers: {
          Accept: "application/zip, application/json",
        },
      });
      console.log(`status ${response.status}`);

      if (!response.ok) {
        const responseClone = response.clone();
        const data = await responseClone.json().catch(() => null);
        let message = "Export failed.";
        if (data && data.error) {
          message = data.error;
        } else {
          const text = await response.text().catch(() => "");
          if (text) {
            message = text;
          }
        }
        showToast("error", message);
        return;
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition");
      const filename = parseFilenameFromDisposition(disposition) || "studyscribe_export.zip";
      downloadBlob(blob, filename);
      showToast("success", `Exported ${filename}`);
      close();
    } catch (err) {
      showToast("error", "Export failed.");
    }
  });

  updateSubmitState();

  return { isOpen, close };
};

const setupConfirmModal = (showToast, exportModalRef) => {
  const backdrop = document.getElementById("confirmBackdrop");
  const modal = document.getElementById("confirmModal");
  const messageEl = document.getElementById("confirmMessage");
  const targetEl = document.getElementById("confirmTarget");
  const cancelBtn = document.querySelector("[data-modal-cancel]");
  const confirmBtn = document.querySelector("[data-modal-confirm]");

  if (!backdrop || !modal || !messageEl || !targetEl || !cancelBtn || !confirmBtn) {
    return {
      openConfirm: () => {},
      closeConfirm: () => {},
      isOpen: () => false,
    };
  }

  let confirmAction = null;
  let busy = false;

  const isOpen = () => !modal.classList.contains("is-hidden");

  const setOpen = (open) => {
    modal.classList.toggle("is-hidden", !open);
    backdrop.classList.toggle("is-hidden", !open);
  };

  const closeConfirm = () => {
    setOpen(false);
    confirmAction = null;
    busy = false;
    confirmBtn.disabled = false;
    confirmBtn.textContent = "Delete";
    targetEl.textContent = "";
  };

  const openConfirm = ({ message, targetLabel, confirmLabel = "Delete", onConfirm }) => {
    messageEl.textContent = message || "Are you sure?";
    targetEl.textContent = targetLabel || "";
    confirmBtn.textContent = confirmLabel;
    confirmAction = onConfirm || null;
    setOpen(true);
  };

  const runConfirm = async () => {
    if (busy) return;
    busy = true;
    confirmBtn.disabled = true;
    const action = confirmAction;
    closeConfirm();
    if (!action) return;
    try {
      await action();
    } catch (err) {
      const message = err && err.message ? err.message : "Delete failed.";
      showToast("error", message);
    }
  };

  backdrop.addEventListener("click", closeConfirm);
  cancelBtn.addEventListener("click", closeConfirm);
  confirmBtn.addEventListener("click", runConfirm);

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (isOpen()) {
      event.preventDefault();
      closeConfirm();
      return;
    }
    if (exportModalRef && exportModalRef.isOpen()) {
      event.preventDefault();
      exportModalRef.close();
    }
  });

  return { openConfirm, closeConfirm, isOpen };
};

const setupSearch = () => {
  const updateSearchList = (input) => {
    const targetId = input.dataset.searchTarget;
    if (!targetId) return;
    const list = document.getElementById(targetId);
    if (!list) return;
    const items = Array.from(list.querySelectorAll("[data-search-item]"));
    const emptyState = list.querySelector("[data-search-empty]");
    const query = input.value.trim().toLowerCase();
    let visibleCount = 0;
    items.forEach((item) => {
      const text = item.dataset.searchText || "";
      const isMatch = text.includes(query);
      item.classList.toggle("is-hidden", !isMatch);
      if (isMatch) visibleCount += 1;
    });
    if (emptyState) {
      emptyState.classList.toggle("is-hidden", visibleCount > 0);
    }
  };

  document.querySelectorAll("[data-search-input]").forEach((input) => {
    input.addEventListener("input", () => updateSearchList(input));
    updateSearchList(input);
  });
};

const setupAiDrawer = () => {
  const aiToggle = document.getElementById("aiToggle");
  const aiDrawer = document.getElementById("aiDrawer");
  const aiOverlay = document.getElementById("aiOverlay");
  const aiCloseButtons = document.querySelectorAll("[data-ai-close]");

  const setAiOpen = (isOpen) => {
    if (!aiDrawer || !aiOverlay) return;
    aiDrawer.classList.toggle("aiDrawerOpen", isOpen);
    aiOverlay.classList.toggle("aiDrawerBackdropOpen", isOpen);
  };

  if (aiToggle) {
    aiToggle.addEventListener("click", (event) => {
      event.preventDefault();
      if (!aiDrawer) return;
      setAiOpen(!aiDrawer.classList.contains("aiDrawerOpen"));
    });
  }

  if (aiOverlay) {
    aiOverlay.addEventListener("click", () => setAiOpen(false));
  }

  aiCloseButtons.forEach((button) => {
    button.addEventListener("click", () => setAiOpen(false));
  });

  return { setAiOpen };
};

const setupScopeControls = () => {
  const scopeButtons = document.querySelectorAll("[data-ai-scope]");
  const scopeInput = document.querySelector("[data-ai-scope-input]");
  const scopeDefault = document.querySelector("[data-ai-scope-default]");

  const setScope = (scope) => {
    scopeButtons.forEach((button) => {
      const active = button.dataset.aiScope === scope;
      button.classList.toggle("segmentedBtn--active", active);
      button.classList.toggle("segmentActive", active);
    });
    if (scopeInput) {
      scopeInput.value = scope;
    }
  };

  scopeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (button.disabled) return;
      setScope(button.dataset.aiScope);
    });
  });

  if (scopeDefault) {
    setScope(scopeDefault.dataset.aiScopeDefault || "session");
  }
};

const setupQaChat = (showToast, sessionMeta) => {
  const qaForm = document.querySelector("[data-qa-form]");
  const messagesEl = document.querySelector("[data-qa-messages]");
  const emptyEl = document.querySelector("[data-qa-empty]");
  const jumpBtn = document.querySelector("[data-qa-jump]");
  if (!messagesEl || !qaForm) return;
  const questionInput = qaForm.querySelector('input[name="question"]');
  const scopeInput = qaForm.querySelector("[data-ai-scope-input]");
  const sendBtn = qaForm.querySelector('button[type="submit"]');
  const askUrl = qaForm.dataset.qaUrl || qaForm.action;
  const messagesUrl = qaForm.dataset.qaMessagesUrl || (sessionMeta && sessionMeta.qaMessagesUrl);

  if (!messagesEl || !questionInput) return;

  const scrollEl = messagesEl.closest(".aiDrawerContent") || messagesEl.parentElement;
  let pinned = true;
  const updatePinned = () => {
    if (!scrollEl) return;
    const distance = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight;
    pinned = distance <= 80;
    if (jumpBtn) {
      jumpBtn.classList.toggle("is-hidden", pinned);
    }
  };
  if (scrollEl) {
    scrollEl.addEventListener("scroll", updatePinned);
    updatePinned();
  }

  if (jumpBtn) {
    jumpBtn.addEventListener("click", () => {
      if (!scrollEl) return;
      scrollEl.scrollTop = scrollEl.scrollHeight;
      pinned = true;
      updatePinned();
    });
  }

  const maybeScroll = () => {
    if (!scrollEl || !pinned) return;
    scrollEl.scrollTop = scrollEl.scrollHeight;
  };

  const setEmptyState = () => {
    if (!emptyEl) return;
    emptyEl.classList.toggle("is-hidden", messagesEl.children.length > 0);
  };

  // Sources modal wiring lives in the Q&A setup because it is rendered inside the drawer.
  const sourcesBackdrop = document.getElementById("sourcesBackdrop");
  const sourcesModal = document.getElementById("sourcesModal");
  const sourcesList = sourcesModal ? sourcesModal.querySelector("[data-sources-list]") : null;
  const sourcesTitle = sourcesModal ? sourcesModal.querySelector("[data-sources-title]") : null;
  const sourcesClose = sourcesModal ? sourcesModal.querySelector("[data-sources-close]") : null;
  const aiDrawer = document.getElementById("aiDrawer");
  const aiOverlay = document.getElementById("aiOverlay");
  let sourcesOpen = false;
  let currentSources = [];
  let selectedSourceId = null;

  const updateSelectedState = () => {
    if (!sourcesList) return;
    sourcesList.querySelectorAll("[data-source-id]").forEach((item) => {
      const active = selectedSourceId && item.dataset.sourceId === String(selectedSourceId);
      item.classList.toggle("sourcesItem--active", active);
      item.setAttribute("aria-pressed", active ? "true" : "false");
    });
  };

  const showSourcesList = () => {
    selectedSourceId = null;
    if (sourcesList) {
      sourcesList.setAttribute("aria-hidden", "false");
    }
    updateSelectedState();
  };

  const closeAiDrawer = () => {
    if (!aiDrawer || !aiOverlay) return;
    aiDrawer.classList.remove("aiDrawerOpen");
    aiOverlay.classList.remove("aiDrawerBackdropOpen");
  };

  const closeSources = () => {
    if (!sourcesBackdrop || !sourcesModal) return;
    sourcesBackdrop.classList.add("is-hidden");
    sourcesModal.classList.add("is-hidden");
    sourcesOpen = false;
    selectedSourceId = null;
    if (sourcesList) sourcesList.setAttribute("aria-hidden", "false");
    updateSelectedState();
  };

  const openSources = (sources) => {
    if (!sourcesBackdrop || !sourcesModal || !sourcesList) return;
    currentSources = sources || [];
    selectedSourceId = null;
    sourcesList.setAttribute("aria-hidden", "false");
    sourcesList.innerHTML = "";
    const count = currentSources.length || 0;
    if (sourcesTitle) {
      sourcesTitle.textContent = `Sources (${count})`;
    }
    sourcesList.scrollTop = 0;
    currentSources.forEach((source) => {
      const sourceId = source.source_id || source.id || "";
      const displayId = source.id || source.source_id || "";
      const titleText = String(source.title || source.label || "").toLowerCase();
      // Summary sources are context-only; keep them out of the clickable list.
      const isSummarySource =
        ["session_summary", "module_index_summary", "module_index", "module_summary"].includes(source.kind) ||
        titleText.includes("summary") ||
        titleText.includes("module index");
      if (isSummarySource) {
        return;
      }
      const item = document.createElement("button");
      item.type = "button";
      item.className = "sourcesItem";
      item.dataset.sourceId = String(sourceId);
      item.setAttribute("aria-pressed", "false");

      const content = document.createElement("div");
      content.className = "sourcesItemContent";

      const label = document.createElement("div");
      label.className = "sourcesLabel";
      label.textContent = source.title || source.label || "Source";

      const snippet = document.createElement("div");
      snippet.className = "sourcesSnippet";
      snippet.textContent = source.excerpt || source.snippet || "";

      const meta = document.createElement("div");
      meta.className = "sourcesMeta";
      meta.textContent = displayId ? `#${displayId}` : "";

      content.appendChild(label);
      if (snippet.textContent) {
        content.appendChild(snippet);
      }
      content.appendChild(meta);

      const chevron = document.createElement("div");
      chevron.className = "sourcesChevron";
      chevron.textContent = "↗";

      item.appendChild(content);
      item.appendChild(chevron);

      item.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        openSourcePreview(source);
      });

      sourcesList.appendChild(item);
    });
    showSourcesList();
    sourcesBackdrop.classList.remove("is-hidden");
    sourcesModal.classList.remove("is-hidden");
    sourcesOpen = true;
  };

  if (sourcesBackdrop) {
    sourcesBackdrop.addEventListener("click", (event) => {
      if (event.target === sourcesBackdrop) {
        closeSources();
      }
    });
  }
  if (sourcesModal) {
    sourcesModal.addEventListener("click", (event) => {
      event.stopPropagation();
    });
  }
  if (sourcesClose) {
    sourcesClose.addEventListener("click", closeSources);
  }
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (sourcesOpen) {
      event.preventDefault();
      closeSources();
    }
  });

  const isAttachmentKind = (kind) => !!kind && String(kind).startsWith("attachment");

  const jumpToInternalSource = (jump) => {
    if (!jump || jump.type !== "internal_scroll") return false;
    const kind = jump.target || jump.kind;
    if (!kind) return false;
    // Map source kinds to the owning tabs so the scroll target exists in the DOM.
    const tabMap = {
      ai_notes: "ai-notes",
      transcript: "transcript",
      session_summary: "notes",
      module_summary: "notes",
      module_index: "notes",
      module_index_summary: "notes",
      notes: "notes",
    };
    const tabKey = tabMap[kind];
    if (tabKey) {
      const tab = document.querySelector(`[data-session-tab="${tabKey}"]`);
      if (tab) tab.click();
    }
    if (!jump.anchor_id) {
      return true;
    }
    window.setTimeout(() => {
      const selector = `[data-jump-kind="${kind}"][data-anchor-id="${jump.anchor_id}"]`;
      let target = document.querySelector(selector);
      if (!target) {
        target = document.getElementById(jump.anchor_id) || document.querySelector(`[data-anchor="${jump.anchor_id}"]`);
      }
      if (!target) return;
      target.classList.add("jump-highlight");
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => target.classList.remove("jump-highlight"), 5000);
    }, 120);
    return true;
  };

  const openSourcePreview = async (source) => {
    if (!source || !sourcesModal || !sessionMeta) return;
    const sourceId = source.source_id || source.id;
    if (!sourceId) return;
    selectedSourceId = sourceId;
    updateSelectedState();

    try {
      // Always resolve previews by source_id to avoid client-side kind mismatches.
      const { response, data } = await fetchJson(
        `/api/source_preview?session_id=${encodeURIComponent(sessionMeta.sessionId)}&source_id=${encodeURIComponent(
          sourceId,
        )}`,
        { headers: { Accept: "application/json" } },
      );
      if (!response.ok || !data.ok || !data.source) {
        console.error("Source preview API error", { status: response && response.status, data });
        if (typeof showToast === "function") {
          showToast("error", "Failed to load source preview.");
        } else {
          alert("Failed to load source preview.");
        }
        return;
      }
      const previewSource = data.source || {};
      const preview = data.preview || {};
      // Internal sources jump in-place; attachments open in a new tab.
      if (!isAttachmentKind(previewSource.kind)) {
        const jumped = jumpToInternalSource(preview.jump || null);
        if (jumped) {
          closeSources();
          closeAiDrawer();
          return;
        }
      }
      const fileUrl = preview.iframe_src || previewSource.open_url;
      if (fileUrl) {
        window.open(fileUrl, "_blank", "noopener");
      }
    } catch (err) {
      console.error("Failed to fetch source preview", err);
      if (typeof showToast === "function") {
        showToast("error", "Failed to load source preview.");
      } else {
        alert("Failed to load source preview.");
      }
    }
  };

  const buildSources = (sources) => {
    if (!sources || !sources.length) return null;
    const container = document.createElement("div");
    container.className = "qaSources";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "qaSourcesPill";
    button.textContent = `Sources (${sources.length})`;
    button.addEventListener("click", () => openSources(sources));
    container.appendChild(button);
    return container;
  };

  const buildMessage = ({ role, content, sources, status } = {}) => {
    const wrapper = document.createElement("div");
    wrapper.className = `qaMessage qaMessage--${role === "user" ? "user" : "ai"}`;

    const bubble = document.createElement("div");
    bubble.className = "qaBubble";
    if (status === "pending") {
      bubble.classList.add("qaBubble--pending");
    }
    if (status === "error") {
      bubble.classList.add("qaBubble--error");
    }

    const body = document.createElement("div");
    body.className = "qaBubbleContent";
    const isUser = role === "user";
    if (isUser || status === "pending") {
      body.textContent = content || "";
    } else {
      body.innerHTML = renderMarkdown(content || "", { cite: true });
      body.classList.add("qaBubbleContent--markdown");
    }
    bubble.appendChild(body);

    if (sources && sources.length) {
      const sourcesEl = buildSources(sources);
      if (sourcesEl) {
        bubble.appendChild(sourcesEl);
      }
    }

    wrapper.appendChild(bubble);
    return { wrapper, bubble, body };
  };

  const addMessage = (message) => {
    const { wrapper, bubble, body } = buildMessage(message);
    messagesEl.appendChild(wrapper);
    setEmptyState();
    maybeScroll();
    return { wrapper, bubble, body };
  };

  const loadMessages = async () => {
    if (!messagesUrl) return;
    const { response, data } = await fetchJson(messagesUrl, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return;
    messagesEl.innerHTML = "";
    (data.messages || []).forEach((message) => {
      const entry = addMessage({
        role: message.role,
        content: message.content,
        sources: message.sources || [],
      });
      entry.wrapper.dataset.messageId = message.id;
    });
    maybeScroll();
    updatePinned();
  };

  qaForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (questionInput.disabled) {
      showToast("info", "Upload content first.");
      return;
    }
    const question = questionInput.value.trim();
    if (!question) {
      showToast("info", "Enter a question.");
      return;
    }
    if (sendBtn) {
      sendBtn.disabled = true;
    }
    questionInput.value = "";
    const userEntry = addMessage({ role: "user", content: question });
    const assistantEntry = addMessage({ role: "assistant", content: "Thinking...", status: "pending" });
    const scope = scopeInput ? scopeInput.value : "session";

    try {
      const { response, data } = await fetchJson(askUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          session_id: sessionMeta && sessionMeta.sessionId,
          question,
          scope,
        }),
      });
      if (!response.ok) {
        throw new Error(data.error || "Q&A failed to generate.");
      }
      if (data.user_message_id) {
        userEntry.wrapper.dataset.messageId = data.user_message_id;
      }
      if (data.assistant_message_id) {
        assistantEntry.wrapper.dataset.messageId = data.assistant_message_id;
      }
      assistantEntry.bubble.classList.remove("qaBubble--pending");
      const answerText = data.answer_markdown || data.answer || "";
      runTypewriter(assistantEntry.body, answerText, {
        chunk: 3,
        onUpdate: () => maybeScroll(),
        onComplete: () => {
          assistantEntry.body.innerHTML = renderMarkdown(answerText, { cite: true });
          assistantEntry.body.classList.add("qaBubbleContent--markdown");
          maybeScroll();
        },
      });
      if (data.sources && data.sources.length) {
        const sourcesEl = buildSources(data.sources);
        if (sourcesEl) {
          assistantEntry.bubble.appendChild(sourcesEl);
        }
      }
    } catch (err) {
      assistantEntry.bubble.classList.remove("qaBubble--pending");
      assistantEntry.bubble.classList.add("qaBubble--error");
      assistantEntry.body.textContent = "Couldn't answer right now. Try again.";
      const retry = document.createElement("button");
      retry.type = "button";
      retry.className = "btn btnGhost btnSmall qaRetryBtn";
      retry.textContent = "Retry";
      const triggerSubmit = () => {
        if (qaForm.requestSubmit) {
          qaForm.requestSubmit();
          return;
        }
        qaForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      };
      retry.addEventListener("click", () => {
        questionInput.value = question;
        triggerSubmit();
      });
      assistantEntry.bubble.appendChild(retry);
    } finally {
      if (sendBtn) {
        sendBtn.disabled = false;
      }
      maybeScroll();
    }
  });

  setEmptyState();
  loadMessages();
};

const setupGenerateNotes = (showToast, sessionMeta) => {
  const forms = Array.from(document.querySelectorAll("[data-generate-form]"));
  const buttons = forms.map((form) => form.querySelector("[data-generate-btn]")).filter(Boolean);
  const hints = forms.map((form) => form.querySelector("[data-generate-hint]")).filter(Boolean);
  const statusBlocks = Array.from(document.querySelectorAll("[data-ai-notes-status]"));
  const statusTexts = Array.from(document.querySelectorAll("[data-ai-notes-status-text]"));
  const notesShells = Array.from(document.querySelectorAll("[data-ai-notes-shell]"));
  const notesOutputs = Array.from(document.querySelectorAll("[data-ai-notes-output]"));
  const notesEmpties = Array.from(document.querySelectorAll("[data-ai-notes-empty]"));
  const skipButtons = Array.from(document.querySelectorAll("[data-ai-notes-skip]"));
  const copyButtons = Array.from(document.querySelectorAll("[data-ai-notes-copy]"));
  const noteScrollers = notesOutputs.map((output) => createAutoScroller(output));
  if (!forms.length) return { setHasContent: () => {}, refreshNotes: () => {} };

  const notesUrl = forms[0].dataset.notesUrl || (sessionMeta && sessionMeta.notesUrl);
  let hasContent = !!(sessionMeta && sessionMeta.hasGenerateContent);
  let isLoading = false;
  let lastNotesText = "";
  let skipHandlers = [];

  const updateButtons = () => {
    const disabled = !hasContent || isLoading;
    buttons.forEach((button) => {
      button.disabled = disabled;
      button.setAttribute("aria-disabled", String(disabled));
    });
    hints.forEach((hint) => hint.classList.toggle("is-hidden", hasContent));
  };

  const setLoading = (loading, message = "Generating…", showStatus = loading) => {
    isLoading = loading;
    statusBlocks.forEach((status) => status.classList.toggle("is-hidden", !showStatus));
    statusTexts.forEach((statusText) => {
      statusText.textContent = message;
    });
    updateButtons();
  };

  const setCopyEnabled = (enabled) => {
    copyButtons.forEach((btn) => {
      btn.disabled = !enabled;
      btn.setAttribute("aria-disabled", String(!enabled));
    });
  };

  const renderNotesToOutput = (el, notesText, index) => {
    const scroller = noteScrollers[index];
    const renderNotesMarkdown = (value) => {
      if (!value || !value.trim()) {
        el.textContent = "";
        el.classList.remove("markdownContent");
        return;
      }
      el.innerHTML = renderMarkdown(value, { anchors: true });
      el.classList.add("markdownContent");
    };
    const result = runTypewriter(el, notesText || "", {
      render: renderNotesMarkdown,
      onUpdate: () => scroller?.maybeScroll(),
      onComplete: () => {
        renderNotesMarkdown(notesText);
        scroller?.maybeScroll();
      },
    });
    return result.skip;
  };

  const showNotes = (notesText) => {
    lastNotesText = notesText || "";
    const hasNotes = !!(notesText && notesText.trim());
    notesShells.forEach((shell) => shell.classList.toggle("is-hidden", !hasNotes));
    notesEmpties.forEach((empty) => empty.classList.toggle("is-hidden", hasNotes));
    skipHandlers = notesOutputs.map((output, index) => renderNotesToOutput(output, notesText || "", index));
    skipButtons.forEach((btn) => btn.classList.toggle("is-hidden", !hasNotes));
    setCopyEnabled(hasNotes);
  };

  const applySuggestedTags = (suggestedTags, { force = false } = {}) => {
    const tags = new Set((suggestedTags || []).map((tag) => String(tag).toUpperCase()));
    const inputs = Array.from(document.querySelectorAll("[data-session-tag]"));
    if (!inputs.length) return;
    const hasUserTags = inputs.some((input) => input.checked);
    inputs.forEach((input) => {
      const value = String(input.value || "").toUpperCase();
      const isSuggested = tags.has(value);
      if (force) {
        input.checked = isSuggested;
      } else if (!hasUserTags && isSuggested) {
        input.checked = true;
      }
      const label = document.querySelector(`label[for="${input.id}"]`);
      if (label) {
        label.classList.toggle("tagPillSuggested", isSuggested);
      }
    });
  };

  const pollJob = async (jobId) => {
    const { response, data } = await fetchJson(`/jobs/${jobId}`);
    if (!response.ok) {
      setLoading(false, "Failed to check generation status.", true);
      showToast("error", "Failed to check generation status.");
      return;
    }
    if (data.status === "error") {
      const message = data.message || "Notes generation failed. Please try again.";
      setLoading(false, message, true);
      showToast("error", message);
      return;
    }
    if (data.status === "success") {
      if (!notesUrl) {
        setLoading(false);
        showToast("success", "Notes generated.");
        return;
      }
      const { response: notesResponse, data: notesData } = await fetchJson(notesUrl, {
        headers: { Accept: "application/json" },
      });
      if (!notesResponse.ok) {
        setLoading(false, "Failed to load notes.", true);
        showToast("error", "Failed to load notes.");
        return;
      }
      showNotes(notesData.notes || "");
      applySuggestedTags(notesData.suggested_tags || []);
      if (sessionMeta) {
        sessionMeta.suggestedTags = notesData.suggested_tags || [];
      }
      setLoading(false);
      showToast("success", "Notes ready.");
      return;
    }
    if (typeof data.progress === "number" && statusTexts.length) {
      statusTexts.forEach((statusText) => {
        statusText.textContent = `Generating… ${data.progress}%`;
      });
    }
    window.setTimeout(() => pollJob(jobId), 1600);
  };

  forms.forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!hasContent) {
        showToast("info", "Upload content first.");
        return;
      }
      try {
        setLoading(true);
        const { response, data } = await fetchJson(form.action, {
          method: "POST",
          headers: { Accept: "application/json" },
        });
        if (!response.ok) {
        setLoading(false, data.error || "Failed to start note generation.", true);
        showToast("error", data.error || "Failed to start note generation.");
        return;
      }
      if (!data.job_id) {
        setLoading(false, "Failed to start note generation.", true);
        showToast("error", "Failed to start note generation.");
        return;
      }
        pollJob(data.job_id);
      } catch (err) {
      setLoading(false, "Failed to start note generation.", true);
      showToast("error", "Failed to start note generation.");
    }
  });
  });

  skipButtons.forEach((button) => {
    button.addEventListener("click", () => {
      skipHandlers.forEach((skip) => skip());
    });
  });

  copyButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      if (!lastNotesText.trim()) return;
      try {
        await navigator.clipboard.writeText(lastNotesText);
        showToast("success", "AI notes copied.");
      } catch (err) {
        showToast("error", "Failed to copy AI notes.");
      }
    });
  });

  updateButtons();
  const initialNotesText = notesOutputs.length ? notesOutputs[0].textContent || "" : "";
  if (initialNotesText.trim()) {
    lastNotesText = initialNotesText;
    notesOutputs.forEach((output, index) => {
      output.innerHTML = renderMarkdown(initialNotesText, { anchors: true });
      output.classList.add("markdownContent");
      noteScrollers[index]?.maybeScroll();
    });
    setCopyEnabled(true);
    skipButtons.forEach((btn) => btn.classList.add("is-hidden"));
  } else {
    setCopyEnabled(false);
    skipButtons.forEach((btn) => btn.classList.add("is-hidden"));
  }
  if (sessionMeta && sessionMeta.suggestedTags) {
    applySuggestedTags(sessionMeta.suggestedTags);
  }

  return {
    setHasContent: (value) => {
      hasContent = value;
      updateButtons();
    },
    refreshNotes: async () => {
      if (!notesUrl) return;
      const { response, data } = await fetchJson(notesUrl, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) return;
      showNotes(data.notes || "");
      applySuggestedTags(data.suggested_tags || []);
      if (sessionMeta) {
        sessionMeta.suggestedTags = data.suggested_tags || [];
      }
    },
    applySuggestedTags,
  };
};

const setupTranscriptControls = (showToast, sessionMeta, notesControls, openConfirm) => {
  const shell = document.querySelector("[data-transcript-shell]");
  const deleteButton = document.querySelector("[data-delete-transcript]");
  const segmentTagsUrl = sessionMeta ? sessionMeta.segmentTagsUrl : null;

  const bindSegmentTags = () => {
    if (!shell || !segmentTagsUrl) return;
    shell.querySelectorAll("[data-segment-tag]").forEach((control) => {
      const isButton = control.tagName === "BUTTON";
      const handler = async () => {
        const segment = control.closest("[data-transcript-segment]");
        if (!segment) return;
        const segId = segment.dataset.segId;
        const label = (control.dataset.tagLabel || control.value || control.textContent || "").trim();
        if (!label) return;
        const wasPressed = control.getAttribute("aria-pressed") === "true";
        const checked = isButton ? !wasPressed : control.checked;
        if (isButton) {
          control.setAttribute("aria-pressed", String(checked));
        }
        try {
          const { response, data } = await fetchJson(segmentTagsUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ segment_id: segId, label, checked }),
          });
          if (!response.ok) {
            throw new Error(data.error || "Failed to save tag.");
          }
        } catch (err) {
          if (isButton) {
            control.setAttribute("aria-pressed", String(wasPressed));
          } else {
            control.checked = !checked;
          }
          showToast("error", err.message || "Failed to save tag.");
        }
      };
      control.addEventListener(isButton ? "click" : "change", handler);
    });
  };

  const refreshTranscript = async () => {
    if (!shell || !sessionMeta || !sessionMeta.transcriptUrl) return false;
    const { response, data } = await fetchJson(sessionMeta.transcriptUrl, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return false;
    shell.innerHTML = data.html || "";
    if (sessionMeta) {
      sessionMeta.hasTranscript = !!data.has_transcript;
    }
    if (deleteButton) {
      deleteButton.disabled = !data.has_transcript;
      deleteButton.setAttribute("aria-disabled", String(!data.has_transcript));
    }
    if (notesControls && sessionMeta) {
      const hasAttachmentText = "hasAttachmentText" in sessionMeta ? sessionMeta.hasAttachmentText : sessionMeta.hasAttachments;
      notesControls.setHasContent(
        !!sessionMeta.hasTranscript || !!hasAttachmentText || !!sessionMeta.hasNotes
      );
    }
    bindSegmentTags();
    return true;
  };

  if (deleteButton && openConfirm && sessionMeta && sessionMeta.deleteTranscriptUrl) {
    deleteButton.addEventListener("click", () => {
      openConfirm({
        message: "Delete transcript? This clears transcript tags.",
        targetLabel: "Transcript",
        confirmLabel: "Delete",
        onConfirm: async () => {
          const { response, data } = await fetchJson(sessionMeta.deleteTranscriptUrl, {
            method: "POST",
            headers: { Accept: "application/json" },
          });
          if (!response.ok) {
            throw new Error(data.error || "Failed to delete transcript.");
          }
          await refreshTranscript();
          showToast("success", "Transcript deleted.");
        },
      });
    });
  }

  bindSegmentTags();
  return { refreshTranscript };
};

const setupTranscriptionStatus = (showToast, sessionMeta, notesControls, refreshTranscript) => {
  const statusEl = document.querySelector("[data-job-status]");
  if (!statusEl) return;
  const params = new URLSearchParams(window.location.search);
  const jobId = params.get("job_id");
  if (!jobId) return;
  const hint = document.querySelector("[data-transcription-hint]");
  let errorShown = false;

  const poll = async () => {
    const { response, data } = await fetchJson(`/jobs/${jobId}`);
    if (!response.ok) return;
    if (data.status === "error") {
      const message = data.message || "Transcription failed. Check file type and try again.";
      statusEl.textContent = "";
      if (hint) {
        hint.textContent = message;
        hint.classList.remove("is-hidden");
      }
      if (!errorShown) {
        showToast("error", message);
        errorShown = true;
      }
      return;
    }
    if (data.status === "success") {
      statusEl.textContent = "Transcription complete.";
      if (hint) {
        hint.classList.add("is-hidden");
      }
      if (refreshTranscript) {
        await refreshTranscript();
      }
      if (sessionMeta) {
        sessionMeta.hasTranscript = true;
      }
      if (notesControls && sessionMeta) {
        const hasAttachmentText = "hasAttachmentText" in sessionMeta ? sessionMeta.hasAttachmentText : sessionMeta.hasAttachments;
        notesControls.setHasContent(
          !!sessionMeta.hasTranscript || !!hasAttachmentText || !!sessionMeta.hasNotes
        );
      }
      return;
    }
    const progress = Number(data.progress || 0);
    const extra = data.message ? ` ${data.message}` : "";
    statusEl.textContent = `${data.status} (${progress}%)${extra}`;
    if (hint) {
      hint.classList.add("is-hidden");
    }
    window.setTimeout(poll, 2000);
  };

  poll();
};

const setupEntityActions = (openConfirm, showToast, sessionMeta) => {
  const updateEntityName = (type, id, name) => {
    document
      .querySelectorAll(`[data-entity-name="${type}:${id}"]`)
      .forEach((el) => {
        el.textContent = name;
      });
  };

  const requestJson = async (url, options) => {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));
    return { response, data };
  };

  const startInlineRename = (row, { autoFocus = true } = {}) => {
    const type = row.dataset.entityType;
    const id = row.dataset.entityId;
    const nameEl = row.querySelector(`[data-entity-name="${type}:${id}"]`);
    if (!nameEl || row.querySelector(".inlineInput")) return;
    const input = document.createElement("input");
    input.type = "text";
    input.className = "input inlineInput";
    input.value = nameEl.textContent.trim();
    nameEl.hidden = true;
    nameEl.insertAdjacentElement("afterend", input);
    if (autoFocus) {
      input.focus();
      input.setSelectionRange(0, input.value.length);
    }

    const cleanup = () => {
      nameEl.hidden = false;
      input.remove();
    };

    const save = async () => {
      const newName = input.value.trim();
      if (!newName) {
        cleanup();
        return;
      }
      const endpoint = type === "module" ? `/modules/${id}` : `/sessions/${id}`;
      const { response } = await requestJson(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      if (!response.ok) {
        cleanup();
        showToast("error", "Rename failed.");
        return;
      }
      updateEntityName(type, id, newName);
      row.dataset.searchText = newName.toLowerCase();
      cleanup();
    };

    input.addEventListener("keydown", (keyEvent) => {
      if (keyEvent.key === "Enter") {
        keyEvent.preventDefault();
        save();
      }
      if (keyEvent.key === "Escape") {
        keyEvent.preventDefault();
        cleanup();
      }
    });
    input.addEventListener("click", (e) => e.stopPropagation());
  };

  document.querySelectorAll("[data-entity-row]").forEach((row) => {
    const type = row.dataset.entityType;
    const id = row.dataset.entityId;
    const nameEl = row.querySelector(`[data-entity-name="${type}:${id}"]`);
    const renameBtn = row.querySelector('[data-entity-action="rename"]');
    const deleteBtn = row.querySelector('[data-entity-action="delete"]');

    if (renameBtn) {
      renameBtn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        startInlineRename(row);
      });
    }

    if (deleteBtn) {
      deleteBtn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const endpoint = type === "module" ? `/modules/${id}` : `/sessions/${id}`;
        const entityName = nameEl ? nameEl.textContent.trim() : "";
        const label = type === "module" ? "Module" : "Session";
        const message = type === "module"
          ? `Delete module \"${entityName}\"? This will delete all sessions and files.`
          : `Delete session \"${entityName}\"? This will delete all files for this session.`;
        openConfirm({
          message,
          targetLabel: entityName ? `${label}: ${entityName}` : label,
          onConfirm: async () => {
            const { response, data } = await requestJson(endpoint, { method: "DELETE" });
            if (!response.ok) {
              throw new Error(data.error || "Delete failed.");
            }
            if (data.redirect) {
              queueToastForNextLoad("success", `${label} deleted.`);
              window.location.assign(data.redirect);
            }
          },
        });
      });
    }
  });

  if (sessionMeta && sessionMeta.autoRename && sessionMeta.sessionId) {
    const row = document.querySelector(
      `[data-entity-row][data-entity-type="session"][data-entity-id="${sessionMeta.sessionId}"]`
    );
    if (row) {
      startInlineRename(row, { autoFocus: true });
    }
  }
};

const setupConfirmDeleteForms = (openConfirm) => {
  const forms = Array.from(document.querySelectorAll("form[data-confirm-delete]"));
  if (!forms.length) return;

  const typeLabel = (type) => {
    if (type === "attachment") return "attachment";
    if (type === "audio") return "audio";
    return "item";
  };

  forms.forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const type = form.dataset.confirmType || "item";
      const name = form.dataset.confirmName || "this item";
      const label = typeLabel(type);
      const message = `Delete ${label} \"${name}\"?`;

      openConfirm({
        message,
        targetLabel: `${label.charAt(0).toUpperCase() + label.slice(1)}: ${name}`,
        onConfirm: async () => {
          const formData = new FormData(form);
          const response = await fetch(form.action, {
            method: form.method || "POST",
            body: formData,
            headers: {
              Accept: "application/json",
            },
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(data.error || "Delete failed.");
          }
          const successMessage = type === "attachment"
            ? "Attachment deleted."
            : type === "audio"
              ? "Audio deleted."
              : "Deleted.";
          queueToastForNextLoad("success", successMessage);
          window.location.reload();
        },
      });
    });
  });
};

const setupConfirmReplaceForms = (openConfirm) => {
  const forms = Array.from(document.querySelectorAll("form[data-confirm-replace]"));
  if (!forms.length) return;

  forms.forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      const name = form.querySelector("input[type='file']")?.files?.[0]?.name || "selected audio";
      openConfirm({
        message: "Replace audio? This will clear the transcript.",
        targetLabel: `Audio: ${name}`,
        confirmLabel: "Replace",
        onConfirm: async () => {
          const formData = new FormData(form);
          const response = await fetch(form.action, {
            method: form.method || "POST",
            body: formData,
            headers: {
              Accept: "application/json",
            },
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(data.error || "Replace failed.");
          }
          queueToastForNextLoad("success", "Audio replaced.");
          window.location.reload();
        },
      });
    });
  });
};

const setupSessionTabs = () => {
  const tabs = Array.from(document.querySelectorAll("[data-session-tab]"));
  if (!tabs.length) return;
  const storageKey = "studyscribe.sessionTab";
  // Persist the last active tab so background updates don't force a tab switch.
  const applyTab = (value) => {
    const button = tabs.find((tab) => tab.dataset.sessionTab === value);
    if (button) button.click();
  };
  let saved = null;
  try {
    saved = localStorage.getItem(storageKey);
  } catch (err) {
    if (window.console && console.warn) console.warn("localStorage.getItem failed:", err);
  }
  if (saved) {
    applyTab(saved);
  }
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      if (tab.dataset.sessionTab) {
        try {
          localStorage.setItem(storageKey, tab.dataset.sessionTab);
        } catch (err) {
          if (window.console && console.warn) console.warn("localStorage.setItem failed:", err);
        }
      }
    });
  });
};

document.addEventListener("DOMContentLoaded", () => {
  const { showToast } = setupToastSystem();
  const sessionMeta = parseSessionMeta();

  document.querySelectorAll("[data-notes-editor]").forEach((editor) => {
    setupNotesEditor(editor);
  });

  setupSearch();
  setupSessionTabs();
  const exportModalRef = setupExportModal(showToast);
  const { openConfirm } = setupConfirmModal(showToast, exportModalRef);

  setupAiDrawer();
  setupScopeControls();
  setupQaChat(showToast, sessionMeta);
  const notesControls = setupGenerateNotes(showToast, sessionMeta);
  const transcriptControls = setupTranscriptControls(showToast, sessionMeta, notesControls, openConfirm);
  setupTranscriptionStatus(showToast, sessionMeta, notesControls, transcriptControls.refreshTranscript);
  setupFilePickers(showToast);
  setupEntityActions(openConfirm, showToast, sessionMeta);
  setupConfirmDeleteForms(openConfirm);
  setupConfirmReplaceForms(openConfirm);
});
