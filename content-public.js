/* Public read-only rendering of published site copy and contact channels. */
(() => {
  const esc = (value) => window.BrycePlatform?.escape ? window.BrycePlatform.escape(value) : String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let currentLocale = 'zh';
  let isConfigured = false;
  let loadState = 'idle';
  const setNote = (text, isError = false) => {
    const note = document.querySelector('[data-content-mode]');
    if (!note) return;
    note.textContent = text;
    note.classList.toggle('text-warning', isError);
  };
  const normalizeText = (value) => String(value ?? '').replace(/<br\s*\/?\s*>/gi, '\n');

  async function applyOverrides(locale = currentLocale) {
    currentLocale = locale;
    if (!window.BrycePlatform?.configured || !window.BryceContent) return;
    try {
      const rows = await window.BryceContent.getPublishedContent(locale);
      const map = new Map(rows.map(row => [row.content_key, row.body_text]));
      document.querySelectorAll('[data-i18n]').forEach((el) => {
        const key = el.getAttribute('data-i18n');
        if (!map.has(key)) return;
        el.textContent = normalizeText(map.get(key));
        el.style.whiteSpace = 'pre-line';
      });
      loadState = rows.length ? 'loaded' : 'empty';
      setNote(rows.length
        ? '已从 Supabase 读取已发布文案；未覆盖字段仍使用站点内置默认文本。'
        : '后端已配置，但当前语言没有已发布文案覆写；页面显示的是内置模板文本。');
    } catch (error) {
      loadState = 'error';
      setNote('后端文案读取失败；页面当前显示内置模板文本。请检查数据库迁移、网络与权限。', true);
    }
  }

  async function renderContacts() {
    const host = document.querySelector('[data-public-contacts]');
    if (!host || !window.BrycePlatform?.configured || !window.BryceContent) return;
    const exampleLink = document.getElementById('exampleContactLink');
    if (exampleLink) exampleLink.hidden = true;
    try {
      const rows = await window.BryceContent.getPublishedContacts();
      if (!rows.length) {
        host.textContent = '暂无已发布的官方联系渠道。';
        return;
      }
      host.replaceChildren(...rows.map((row) => {
        const item = document.createElement('p');
        const anchor = document.createElement('a');
        const href = String(row.href || '');
        if (/^(https:\/\/|mailto:|tel:)/i.test(href)) anchor.href = href;
        anchor.textContent = `${row.label}: ${row.value}`;
        if (/^https:\/\//i.test(href)) { anchor.target = '_blank'; anchor.rel = 'noopener noreferrer'; }
        item.append(anchor);
        return item;
      }));
    } catch (_) {
      host.textContent = '暂时无法读取已发布联系方式。';
    }
  }

  function addSourceNote() {
    if (!document.querySelector('[data-content-mode]')) {
      const note = document.createElement('div');
      note.className = 'content-source-note';
      note.setAttribute('data-content-mode', '');
      note.setAttribute('role', 'status');
      const main = document.querySelector('main') || document.body;
      main.prepend(note);
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    if (document.body.dataset.adminPage === 'true') return;
    addSourceNote();
    isConfigured = Boolean(window.BrycePlatform?.configured);
    if (!isConfigured) {
      setNote('本页为站点内置示例/模板内容；Supabase 尚未配置，后台保存和线上持久化不可用。');
      return;
    }
    const chosen = document.getElementById('languageSelect')?.value || localStorage.getItem('bryceSiteLanguage') || 'zh';
    await applyOverrides(chosen);
    await renderContacts();
  });
  document.addEventListener('bryce:languagechange', (event) => {
    if (isConfigured) applyOverrides(event.detail?.lang || currentLocale);
  });
  window.BrycePublicContent = { applyOverrides, get loadState() { return loadState; } };
})();
