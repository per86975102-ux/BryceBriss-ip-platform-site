(() => {
  const $ = (id) => document.getElementById(id);
  const platform = () => window.BrycePlatform;
  const escapeHtml = (value) => platform()?.escape ? platform().escape(value) : String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const params = new URLSearchParams(window.location.search);
  const workId = params.get('work');
  let chapters = [];

  function renderInline(nodes = []) {
    return nodes.map((node) => {
      if (node.type !== 'text') return '';
      let value = escapeHtml(node.text || '').replace(/\n/g, '<br>');
      (node.marks || []).forEach((mark) => {
        if (mark.type === 'bold') value = `<strong>${value}</strong>`;
        else if (mark.type === 'italic') value = `<em>${value}</em>`;
        else if (mark.type === 'underline') value = `<u>${value}</u>`;
        else if (mark.type === 'link' && /^https:\/\//i.test(mark.attrs?.href || '')) value = `<a href="${escapeHtml(mark.attrs.href)}" rel="noopener noreferrer" target="_blank">${value}</a>`;
      });
      return value;
    }).join('');
  }

  function renderDocument(documentValue) {
    if (!documentValue || documentValue.type !== 'doc' || !Array.isArray(documentValue.content)) return '<p>本章节正文格式暂时无法显示。</p>';
    return documentValue.content.map((block) => {
      const content = renderInline(block.content || []);
      if (block.type === 'heading') return `<h2>${content}</h2>`;
      if (block.type === 'blockquote') return `<blockquote>${content}</blockquote>`;
      if (block.type === 'bullet_list' || block.type === 'ordered_list') {
        const tag = block.type === 'bullet_list' ? 'ul' : 'ol';
        return `<${tag}>${(block.content || []).map((item) => `<li>${renderInline(item.content || [])}</li>`).join('')}</${tag}>`;
      }
      if (block.type === 'divider') return '<hr>';
      if (block.type === 'image') {
        const src = String(block.attrs?.src || '');
        if (!/^https:\/\//i.test(src)) return '';
        return `<p><img src="${escapeHtml(src)}" alt="${escapeHtml(block.attrs?.alt || '')}" loading="lazy"></p>`;
      }
      return `<p>${content}</p>`;
    }).join('');
  }

  function showChapter(chapterId) {
    const chapter = chapters.find((item) => item.id === chapterId);
    if (!chapter) return;
    $('chapterTitle').textContent = `第 ${chapter.chapter_number} 章 · ${chapter.title}`;
    $('chapterBody').innerHTML = renderDocument(chapter.body);
    document.querySelectorAll('[data-chapter-id]').forEach((button) => {
      if (button.dataset.chapterId === chapter.id) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set('work', workId);
    nextUrl.searchParams.set('chapter', chapter.id);
    window.history.replaceState({}, '', nextUrl);
  }

  async function init() {
    if (!workId) throw new Error('缺少作品标识，请从作品目录进入阅读页面。');
    if (!platform()?.configured) throw new Error('当前尚未连接在线数据库，暂时无法读取正式章节。');
    const client = platform().client;
    const { data: work, error: workError } = await client.from('works')
      .select('id,title,summary,status,series_id').eq('id', workId).eq('status', 'published').maybeSingle();
    if (workError) throw workError;
    if (!work) throw new Error('作品不存在或尚未公开发布。');
    if (work.series_id) {
      const { data: series, error: seriesError } = await client.from('series').select('status').eq('id', work.series_id).maybeSingle();
      if (seriesError) throw seriesError;
      if (!series || series.status !== 'published') throw new Error('该作品所属系列目前未公开。');
    }
    $('readerWorkTitle').textContent = work.title;
    $('readerWorkSummary').textContent = work.summary || '';
    const { data, error } = await client.from('work_chapters')
      .select('id,work_id,chapter_number,title,body,status,published_at')
      .eq('work_id', work.id).eq('status', 'published').order('chapter_number', { ascending: true });
    if (error) throw error;
    chapters = data || [];
    $('chapterList').innerHTML = chapters.length ? chapters.map((chapter) => `<button class="reader-chapter" type="button" data-chapter-id="${escapeHtml(chapter.id)}">第 ${escapeHtml(chapter.chapter_number)} 章 · ${escapeHtml(chapter.title)}</button>`).join('') : '<p class="platform-muted">这部作品暂时没有公开章节。</p>';
    document.querySelectorAll('[data-chapter-id]').forEach((button) => button.addEventListener('click', () => showChapter(button.dataset.chapterId)));
    const requestedChapter = params.get('chapter');
    const firstChapter = chapters.find((chapter) => chapter.id === requestedChapter) || chapters[0];
    if (firstChapter) showChapter(firstChapter.id);
    $('readerStatus').textContent = '当前仅显示数据库允许公开读取的作品与章节。';
  }

  document.addEventListener('DOMContentLoaded', () => {
    init().catch((error) => {
      $('readerStatus').textContent = error.message || '暂时无法加载章节。';
      $('chapterList').innerHTML = '';
      $('chapterBody').innerHTML = '<p class="platform-muted">请稍后重试，或返回作品目录。</p>';
    });
  });
})();
