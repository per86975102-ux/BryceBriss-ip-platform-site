/* V7 additions to the inherited admin UI. Every write is still protected by RLS. */
(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (value) => window.BrycePlatform?.escape ? window.BrycePlatform.escape(value) : String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let pageKeys = [];
  let entryCache = [];
  let contactCache = [];
  const dirty = new Set();
  const groups = {
    home: ['home.'], works: ['works.'], characters: ['characters.'], gallery: ['gallery.'], blog: ['blog.'], about: ['about.'], common: ['nav.', 'common.', 'footer.']
  };
  const labels = { home:'首页', works:'作品', characters:'角色与世界观', gallery:'画廊', blog:'创作日志', about:'作者介绍', common:'导航/通用' };

  function state(id, text, bad = false) {
    const el = $(id); if (!el) return;
    el.textContent = text;
    el.className = `small mt-2 ${bad ? 'text-warning' : 'text-info'}`;
  }
  function addDirty(id) { dirty.add(id); }
  function clearDirty(id) { dirty.delete(id); }
  function configured() { return Boolean(window.BrycePlatform?.configured && window.BryceContent && window.BryceAuth); }
  async function admin() {
    if (!configured()) throw new Error(window.BrycePlatform?.statusMessage?.() || 'Supabase 尚未配置；不会保存到真实后端。');
    return window.BryceAuth.requireAdmin();
  }
  function setUnavailable(id, text) {
    const host = $(id); if (host) host.textContent = text;
  }
  function pageKeysFor(locale, group) {
    const dict = window.BryceTranslations?.[locale];
    if (!dict) throw new Error('页面默认翻译字典未加载。');
    const prefixes = groups[group] || [];
    return Object.keys(dict).filter((key) => prefixes.some((prefix) => key.startsWith(prefix))).sort();
  }
  function defaultText(value) { return String(value ?? '').replace(/<br\s*\/?\s*>/gi, '\n'); }

  async function loadSiteEditor() {
    const host = $('siteContentEditor');
    const locale = $('contentLocale').value;
    const group = $('contentPage').value;
    if (!configured()) {
      host.textContent = '请先配置 Supabase，并完成经过批准的数据库迁移。此处默认文案仅供预览，不能当作已保存内容。';
      state('siteContentState', window.BrycePlatform?.statusMessage?.() || '后端不可用。', true);
      return;
    }
    try {
      await admin();
      pageKeys = pageKeysFor(locale, group);
      const prefixes = groups[group] || [];
      const records = await window.BryceContent.listSiteContent(locale);
      const overrides = new Map(records.filter((row) => prefixes.some((prefix) => row.content_key.startsWith(prefix))).map((row) => [row.content_key, row]));
      const dict = window.BryceTranslations[locale];
      host.replaceChildren();
      for (const key of pageKeys) {
        const wrap = document.createElement('div'); wrap.className = 'col-md-6';
        const panel = document.createElement('div'); panel.className = 'content-field';
        const label = document.createElement('label'); label.className = 'form-label text-light'; label.htmlFor = `copy-${key}`; label.textContent = key;
        const textarea = document.createElement('textarea'); textarea.className = 'form-control'; textarea.rows = key.includes('copy') || key.includes('subtitle') || key.includes('p') ? 3 : 2;
        textarea.id = `copy-${key}`; textarea.dataset.contentKey = key; textarea.maxLength = 8000;
        textarea.value = overrides.has(key) ? overrides.get(key).body_text : defaultText(dict[key]);
        textarea.addEventListener('input', () => addDirty('site'));
        panel.append(label, textarea);
        const statusLabel = document.createElement('div'); statusLabel.className = 'editor-help mt-1';
        const statusValue = overrides.get(key)?.status || 'default';
        statusLabel.textContent = statusValue === 'default' ? '当前使用内置默认文案' : `数据库状态：${statusValue}`;
        panel.append(statusLabel); wrap.append(panel); host.append(wrap);
      }
      state('siteContentState', `已读取 ${pageKeys.length} 个字段（${labels[group]} / ${locale}）；未覆盖字段仍取内置字典。`);
      clearDirty('site');
    } catch (error) {
      host.textContent = '当前无法读取该组数据库文案。';
      state('siteContentState', error.message || '文案读取失败。', true);
    }
  }

  async function saveSiteEditor(statusValue) {
    try {
      await admin();
      const locale = $('contentLocale').value;
      const rows = [...$('siteContentEditor').querySelectorAll('[data-content-key]')].map((el) => ({ content_key: el.dataset.contentKey, locale, body_text: el.value }));
      if (!rows.length) throw new Error('请先加载可编辑文案。');
      const result = await window.BryceContent.saveSiteContent(rows, statusValue);
      clearDirty('site');
      state('siteContentState', `${result.length} 个文案字段已保存为${statusValue === 'published' ? '已发布' : '草稿'}；建议重新加载页面验证读回。`);
      await loadSiteEditor();
    } catch (error) { state('siteContentState', `保存失败：${error.message || '未知错误'}`, true); }
  }

  function clearContactForm() {
    $('contactForm').reset(); $('contactId').value = ''; $('contactOrder').value = '0'; $('contactStatus').value = 'draft'; clearDirty('contact');
  }
  async function loadContacts() {
    const host = $('contactList');
    if (!configured()) { host.textContent = '尚未配置 Supabase/数据库迁移；联系方式不会本地伪保存。'; return; }
    try {
      await admin();
      contactCache = await window.BryceContent.listContacts();
      host.innerHTML = contactCache.length ? contactCache.map((row) => `<div class="chapter-row"><div><strong class="text-light">${esc(row.label)}</strong><div class="editor-help">${esc(row.value)} · ${esc(row.channel_type)} · ${esc(row.status)}</div>${row.href ? `<div class="editor-help">${esc(row.href)}</div>` : ''}</div><div class="d-flex gap-2"><button class="btn btn-outline-silver btn-sm" data-edit-contact="${esc(row.id)}" type="button">编辑</button><button class="btn btn-outline-silver btn-sm" data-delete-contact="${esc(row.id)}" type="button">删除</button></div></div>`).join('') : '<p class="platform-muted">暂无联系方式。仅添加你决定公开的信息。</p>';
      host.querySelectorAll('[data-edit-contact]').forEach((button) => button.addEventListener('click', () => editContact(button.dataset.editContact)));
      host.querySelectorAll('[data-delete-contact]').forEach((button) => button.addEventListener('click', () => deleteContact(button.dataset.deleteContact)));
      state('contactState', `已读回 ${contactCache.length} 条联系方式。`);
    } catch (error) { host.textContent = '联系方式当前无法加载。'; state('contactState', error.message || '加载失败。', true); }
  }
  function editContact(id) {
    const row = contactCache.find((item) => item.id === id); if (!row) return;
    $('contactId').value = row.id; $('contactType').value = row.channel_type; $('contactLabel').value = row.label;
    $('contactValue').value = row.value; $('contactHref').value = row.href || ''; $('contactOrder').value = row.display_order || 0; $('contactStatus').value = row.status;
    addDirty('contact'); $('contactLabel').focus();
  }
  async function saveContact(event) {
    event.preventDefault();
    try {
      await admin();
      await window.BryceContent.saveContact({ id:$('contactId').value, channel_type:$('contactType').value, label:$('contactLabel').value, value:$('contactValue').value, href:$('contactHref').value, display_order:$('contactOrder').value, status:$('contactStatus').value });
      clearContactForm(); state('contactState', '联系方式已保存到 Supabase。'); await loadContacts();
    } catch (error) { state('contactState', `保存失败：${error.message || '未知错误'}`, true); }
  }
  async function deleteContact(id) {
    if (!confirm('删除这条公开渠道？操作只影响该联系方式，不改动账户邮箱。')) return;
    try { await admin(); await window.BryceContent.deleteContact(id); state('contactState','联系方式已删除。'); await loadContacts(); }
    catch (error) { state('contactState', `删除失败：${error.message || '未知错误'}`, true); }
  }

  function makeSlug(value) {
    return String(value || '').normalize('NFKD').toLowerCase().trim().replace(/[^a-z0-9\u4e00-\u9fff]+/g,'-').replace(/^-+|-+$/g,'').slice(0,180);
  }
  function clearEntryForm() {
    $('ipEntryForm').reset(); $('ipEntryId').value = ''; $('ipEntryStatus').value = 'draft'; $('ipEntryOrder').value = '0'; $('ipEntryImage').value = '';
    clearDirty('entry');
  }
  async function loadEntries() {
    const host = $('ipEntryList');
    if (!configured()) { host.textContent = 'Supabase 尚未配置/迁移；这些条目不能真实保存。'; return; }
    try {
      await admin();
      entryCache = await window.BryceContent.listEntries($('entryFilterType').value);
      host.innerHTML = entryCache.length ? entryCache.map((row) => `<div class="col-md-6"><article class="platform-card"><div class="d-flex justify-content-between"><span class="platform-badge">${esc(row.entry_type)}</span><span class="platform-badge">${esc(row.status)}</span></div><h3 class="mt-3">${esc(row.title)}</h3><p>${esc(row.summary || '')}</p><p class="editor-help">${esc(row.locale)} · ${esc(row.slug)} · 排序 ${esc(row.sort_order)}</p><div class="d-flex gap-2 flex-wrap"><button type="button" class="btn btn-outline-silver btn-sm" data-edit-entry="${esc(row.id)}">编辑</button>${row.status !== 'archived' ? `<button type="button" class="btn btn-outline-silver btn-sm" data-archive-entry="${esc(row.id)}">归档</button>` : ''}</div></article></div>`).join('') : '<p class="platform-muted">暂无条目；新建内容默认保存为草稿。</p>';
      host.querySelectorAll('[data-edit-entry]').forEach((button) => button.addEventListener('click', () => editEntry(button.dataset.editEntry)));
      host.querySelectorAll('[data-archive-entry]').forEach((button) => button.addEventListener('click', () => archiveEntry(button.dataset.archiveEntry)));
      state('ipEntryState', `已读回 ${entryCache.length} 条记录（含草稿和归档）。`);
    } catch (error) { host.textContent = '条目列表当前无法加载。'; state('ipEntryState', error.message || '加载失败。', true); }
  }
  function editEntry(id) {
    const row = entryCache.find((item) => item.id === id); if (!row) return;
    $('ipEntryId').value = row.id; $('ipEntryType').value = row.entry_type; $('ipEntryLocale').value = row.locale;
    $('ipEntryStatus').value = row.status; $('ipEntryOrder').value = row.sort_order || 0; $('ipEntryTitle').value = row.title || '';
    $('ipEntrySlug').value = row.slug || ''; $('ipEntrySummary').value = row.summary || ''; $('ipEntryBody').value = row.body_text || '';
    $('ipEntryCover').value = row.cover_path || ''; addDirty('entry'); $('ipEntryTitle').focus();
    if (row.cover_path) window.BryceMedia.resolveAdminPreview(row.cover_path).then((url) => { if (url) { $('ipEntryPreview').src=url; $('ipEntryPreview').classList.remove('d-none'); } }).catch(() => {});
  }
  async function saveEntry(event) {
    event.preventDefault();
    try {
      await admin();
      const cover = $('ipEntryCover').value.trim();
      const parsed = cover ? window.BryceMedia.parsePath(cover) : null;
      if ($('ipEntryStatus').value === 'published' && parsed?.kind === 'private') throw new Error('该图片位于私有桶；公开发布前请换成明确公开的媒体。');
      const previous = entryCache.find((row) => row.id === $('ipEntryId').value);
      await window.BryceContent.saveEntry({
        id:$('ipEntryId').value || undefined, entry_type:$('ipEntryType').value, locale:$('ipEntryLocale').value,
        status:$('ipEntryStatus').value, sort_order:$('ipEntryOrder').value, title:$('ipEntryTitle').value,
        slug:$('ipEntrySlug').value.trim() || makeSlug($('ipEntryTitle').value), summary:$('ipEntrySummary').value,
        body_text:$('ipEntryBody').value, cover_path:cover, published_at:previous?.published_at
      });
      clearEntryForm(); state('ipEntryState','条目已保存到 Supabase。'); await loadEntries();
    } catch (error) { state('ipEntryState', `保存失败：${error.message || '未知错误'}`, true); }
  }
  async function archiveEntry(id) {
    if (!confirm('归档该条目？归档后公开页不再显示，记录和媒体不会物理删除。')) return;
    try {
      await admin(); const row = entryCache.find((item) => item.id === id); if (!row) return;
      await window.BryceContent.saveEntry({ ...row, status:'archived' });
      state('ipEntryState','条目已归档；记录保留。'); await loadEntries();
    } catch (error) { state('ipEntryState', `归档失败：${error.message || '未知错误'}`, true); }
  }

  function previewLocal(file, imgId, messageId) {
    const image = $(imgId); if (!image || !file) return;
    if (image.dataset.objectUrl) URL.revokeObjectURL(image.dataset.objectUrl);
    const url = URL.createObjectURL(file); image.dataset.objectUrl = url; image.src = url; image.classList.remove('d-none');
    state(messageId, '仅本地预览，尚未上传；刷新页面后不会保留。');
  }
  async function uploadCover({ fileId, visibilityId, folder, targetId, previewId, stateId, alt = '' }) {
    const file = $(fileId).files?.[0]; if (!file) throw new Error('请先选择图片。');
    const visibility=$(visibilityId).value;
    if (visibility === 'public' && !window.confirm('该文件一旦上传即可通过公开URL读取，即使作品/条目仍为草稿。请确认图片本身已获准公开。')) return;
    const button = document.activeElement; if (button) button.disabled = true;
    state(stateId,'正在验证并上传至 Supabase Storage…');
    try {
      const result = await window.BryceMedia.upload(file, { folder, visibility, altText:alt });
      $(targetId).value = result.path;
      const image = $(previewId); image.src = result.previewUrl || result.publicUrl; image.classList.remove('d-none');
      state(stateId, result.asset.visibility === 'public'
        ? `图片对象与媒体元数据已上传：${result.path}。该对象现在可公开访问；还需保存作品/条目表单以完成关联。旧封面未自动删除。`
        : `图片对象与媒体元数据已上传：${result.path}。仅管理员可预览；还需保存作品/条目表单以完成关联，发布前需改用明确公开的图片。`);
      return result;
    } finally { if (button) button.disabled = false; }
  }
  async function uploadWorkCover() {
    try { await admin(); await uploadCover({ fileId:'workCoverFile', visibilityId:'workCoverVisibility', folder:'works', targetId:'workCover', previewId:'workCoverPreview', stateId:'workCoverUploadState', alt:$('workTitle').value }); }
    catch (error) { state('workCoverUploadState', `上传失败：${error.message || '未知错误'}`, true); }
  }
  async function uploadEntryCover() {
    try { await admin(); await uploadCover({ fileId:'ipEntryImage', visibilityId:'ipEntryImageVisibility', folder:$('ipEntryType').value === 'journal' ? 'journal' : $('ipEntryType').value === 'gallery' ? 'gallery' : $('ipEntryType').value === 'world' ? 'worlds' : 'characters', targetId:'ipEntryCover', previewId:'ipEntryPreview', stateId:'entryUploadState', alt:$('ipEntryTitle').value }); }
    catch (error) { state('entryUploadState', `上传失败：${error.message || '未知错误'}`, true); }
  }
  async function uploadChapterImage() {
    try {
      await admin();
      const file = $('chapterImageFile').files?.[0]; if (!file) throw new Error('请先选择图片。');
      if (!$('chapterImagePublicConsent')?.checked) throw new Error('请先确认该图片本身可公开；章节草稿状态不会隐藏公开桶图片。');
      if (!window.confirm('章节插图将立即公开读取，即使章节仍为草稿。仅继续上传已获准公开的图片。')) return;
      const button = $('uploadChapterImageBtn'); button.disabled = true;
      state('chapterImageState','正在上传至公开媒体桶…');
      const result = await window.BryceMedia.upload(file, { folder:'chapters', visibility:'public', altText:$('chapterImageAlt').value });
      const alt = esc($('chapterImageAlt').value.trim().slice(0,300));
      $('chapterEditor').focus();
      document.execCommand('insertHTML', false, `<p><img src="${esc(result.publicUrl)}" alt="${alt}"></p>`);
      $('chapterImageFile').value = '';
      state('chapterImageState',`图片对象已上传并插入编辑器；公开桶文件现在可通过公开URL读取。还需保存章节正文才能完成关联。`);
    } catch (error) { state('chapterImageState', `上传失败：${error.message || '未知错误'}`, true); }
    finally { const button = $('uploadChapterImageBtn'); if (button) button.disabled = false; }
  }

  function attachDirtyTracking(formId, key) {
    const form = $(formId); if (!form) return;
    form.addEventListener('input', () => addDirty(key));
    form.addEventListener('change', () => addDirty(key));
  }
  function bind() {
    $('contentPage')?.addEventListener('change', loadSiteEditor);
    $('contentLocale')?.addEventListener('change', loadSiteEditor);
    $('loadSiteContentBtn')?.addEventListener('click', loadSiteEditor);
    $('saveSiteDraftBtn')?.addEventListener('click', () => saveSiteEditor('draft'));
    $('publishSiteContentBtn')?.addEventListener('click', () => saveSiteEditor('published'));
    $('contactForm')?.addEventListener('submit', saveContact);
    $('clearContactBtn')?.addEventListener('click', clearContactForm);
    $('ipEntryForm')?.addEventListener('submit', saveEntry);
    $('clearEntryBtn')?.addEventListener('click', clearEntryForm);
    $('entryFilterType')?.addEventListener('change', loadEntries);
    $('refreshEntriesBtn')?.addEventListener('click', loadEntries);
    $('uploadWorkCoverBtn')?.addEventListener('click', uploadWorkCover);
    $('uploadEntryImageBtn')?.addEventListener('click', uploadEntryCover);
    $('uploadChapterImageBtn')?.addEventListener('click', uploadChapterImage);
    $('clearWorkCoverBtn')?.addEventListener('click', () => { $('workCover').value=''; $('workCoverPreview').src=''; $('workCoverPreview').classList.add('d-none'); state('workCoverUploadState','封面引用已清空；已上传的图片文件未删除。'); });
    $('clearEntryCoverBtn')?.addEventListener('click', () => { $('ipEntryCover').value=''; $('ipEntryPreview').src=''; $('ipEntryPreview').classList.add('d-none'); addDirty('entry'); state('entryUploadState','封面引用已清空；已上传的图片文件未删除。'); });
    document.addEventListener('click', (event) => {
      if (event.target.closest('[data-edit-work]')) setTimeout(() => {
        const value=$('workCover')?.value.trim();
        if (value && window.BryceMedia) window.BryceMedia.resolveAdminPreview(value).then((url) => { if (url && $('workCoverPreview')) { $('workCoverPreview').src=url; $('workCoverPreview').classList.remove('d-none'); } }).catch(() => {});
      }, 0);
    });
    $('workCoverFile')?.addEventListener('change', () => previewLocal($('workCoverFile').files?.[0], 'workCoverPreview', 'workCoverUploadState'));
    $('ipEntryImage')?.addEventListener('change', () => previewLocal($('ipEntryImage').files?.[0], 'ipEntryPreview', 'entryUploadState'));
    attachDirtyTracking('contactForm','contact'); attachDirtyTracking('ipEntryForm','entry');
    window.addEventListener('beforeunload', (event) => { if (dirty.size) { event.preventDefault(); event.returnValue = ''; } });
    if (window.BrycePlatform?.configured && window.BrycePlatform.client?.auth?.onAuthStateChange) {
      window.BrycePlatform.client.auth.onAuthStateChange((event) => {
        if (['SIGNED_IN','SIGNED_OUT','TOKEN_REFRESHED','USER_UPDATED'].includes(event)) {
          setTimeout(() => { loadSiteEditor(); loadContacts(); loadEntries(); }, 0);
        }
      });
    }
  }
  document.addEventListener('DOMContentLoaded', () => {
    bind();
    loadSiteEditor(); loadContacts(); loadEntries();
  });
})();
