/* Read-only live catalogs for characters/worlds, gallery and journal. */
(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (value) => window.BrycePlatform?.escape ? window.BrycePlatform.escape(value) : String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const locale = () => document.getElementById('languageSelect')?.value || 'zh';
  const typeLabel = { character:'CHARACTER', world:'WORLD', gallery:'VISUAL ARCHIVE', journal:'CREATIVE JOURNAL' };
  function status(host, text, error = false) {
    let note = host.querySelector('[data-catalog-status]');
    if (!note) { note = document.createElement('p'); note.dataset.catalogStatus = ''; note.className = 'platform-muted col-12'; host.prepend(note); }
    note.textContent = text; note.classList.toggle('text-warning', error);
  }
  function createCard(row) {
    const col = document.createElement('div'); col.className = 'col-md-6 col-lg-4';
    const link = document.createElement('a'); link.className = 'character-card-link'; link.href = `entry.html?slug=${encodeURIComponent(row.slug)}`;
    const article = document.createElement('article'); article.className = 'character-card v7-catalog-card';
    const imageUrl = window.BrycePlatform.publicMediaUrl(row.cover_path);
    if (imageUrl) { const image = document.createElement('img'); image.className = 'img-fluid rounded mb-3'; image.src = imageUrl; image.alt = row.title; image.loading = 'lazy'; article.append(image); }
    const label = document.createElement('p'); label.className = 'tag'; label.textContent = typeLabel[row.entry_type] || row.entry_type.toUpperCase();
    const title = document.createElement('h2'); title.textContent = row.title;
    const summary = document.createElement('p'); summary.textContent = row.summary || '';
    article.append(label, title, summary); link.append(article); col.append(link); return col;
  }
  async function renderPage() {
    if (!window.BrycePlatform?.configured || !window.BryceContent) return;
    const page = document.body.dataset.catalogPage;
    if (!page) return;
    const config = page === 'characters'
      ? { hostId:'liveCharacterEntries', sampleId:'characterSampleCards', types:['character','world'] }
      : page === 'gallery'
        ? { hostId:'liveGalleryEntries', sampleId:'gallerySampleGrid', types:['gallery'] }
        : { hostId:'liveJournalEntries', sampleId:'blogSampleFeature', types:['journal'] };
    const host = $(config.hostId); const sample = $(config.sampleId);
    if (!host) return;
    if (sample) sample.hidden = true;
    host.replaceChildren(); status(host, '正在读取 Supabase 已发布目录…');
    try {
      const sets = await Promise.all(config.types.map((type) => window.BryceContent.getPublishedEntries(type)));
      const rows = sets.flat().filter((row) => row.locale === locale());
      host.replaceChildren();
      if (!rows.length) { status(host, `当前语言（${locale()}）暂无已发布的在线条目。`); return; }
      rows.forEach((row) => host.append(createCard(row)));
    } catch (_) {
      host.replaceChildren();
      status(host, '目录读取失败；当前没有显示静态样例来冒充在线内容。请检查迁移、网络与RLS。', true);
    }
  }
  let ready = false;
  document.addEventListener('DOMContentLoaded', () => { ready = true; renderPage(); });
  document.addEventListener('bryce:languagechange', () => { if (ready) renderPage(); });
  window.BryceCatalog = { renderPage };
})();
