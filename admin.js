(() => {
  const $ = (id) => document.getElementById(id);
  const platform = () => window.BrycePlatform;
  const escapeHtml = (value) => platform()?.escape ? platform().escape(value) : String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  let currentUser = null;
  let isAdmin = false;
  let sessionError = null;
  let worksCache = [];
  let seriesCache = [];

  function setMessage(id, message, isError = false) {
    const element = $(id);
    if (!element) return;
    element.textContent = message;
    element.className = `small mt-2 ${isError ? 'text-warning' : 'text-info'}`;
  }

  function makeSlug(value) {
    return String(value || '').normalize('NFKD').toLowerCase().trim()
      .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
      .replace(/^-+|-+$/g, '').slice(0, 180) || `work-${Date.now()}`;
  }

  function requireAdmin() {
    if (!platform()?.configured) throw new Error('请先配置 Supabase。演示模式不会保存真实数据。');
    if (sessionError) throw new Error('无法确认管理员权限；请检查连接后刷新页面。');
    if (!currentUser || !isAdmin) throw new Error('此操作仅限已授权的管理员。');
  }

  async function refreshSession() {
    const p = platform();
    if (!p?.configured) {
      $('authState').textContent = p?.statusMessage?.() || '演示模式：未连接在线账号服务。';
      currentUser = null;
      isAdmin = false;
      sessionError = null;
      return;
    }
    const { data, error } = await p.client.auth.getSession();
    if (error) throw error;
    currentUser = data?.session?.user || null;
    isAdmin = false;
    sessionError = null;
    if (currentUser) {
      const result = await p.client.rpc('is_admin');
      if (result.error) sessionError = result.error;
      else if (typeof result.data !== 'boolean') sessionError = new Error('管理员权限检查返回了无效结果。');
      else isAdmin = result.data;
    }
    $('authState').textContent = !currentUser
      ? '尚未登录。'
      : sessionError
        ? `已登录：${currentUser.email || '账户'} · 管理员权限暂不可验证`
        : `已登录：${currentUser.email || '账户'}${isAdmin ? ' · 管理员' : ' · 普通读者'}`;
  }

  async function signIn(event) {
    event.preventDefault();
    const p = platform();
    if (!p?.configured) return setMessage('authMessage', '请先在 supabase-config.js 配置 Supabase。', true);
    try {
      if (window.BryceAuth?.signIn) await window.BryceAuth.signIn($('authEmail').value, $('authPassword').value);
      else {
        const { error } = await p.client.auth.signInWithPassword({ email: $('authEmail').value.trim(), password: $('authPassword').value });
        if (error) throw error;
      }
      $('authPassword').value = '';
      await refreshAll();
      setMessage('authMessage', sessionError
        ? `登录成功，但无法确认管理员权限：${sessionError.message || '请稍后重试。'}`
        : isAdmin ? '管理员登录成功。' : '登录成功，但当前账户没有管理员权限。', Boolean(sessionError));
    } catch (error) {
      setMessage('authMessage', error.message || '登录失败。', true);
    }
  }

  async function requestPasswordReset() {
    const email = $('authEmail')?.value.trim();
    if (!email) return setMessage('authMessage', '请先填写账户邮箱，再请求重置邮件。', true);
    try {
      if (!window.BryceAuth?.requestPasswordReset) throw new Error('认证服务未加载。');
      await window.BryceAuth.requestPasswordReset(email);
      setMessage('authMessage', '密码重置请求已提交。若项目邮件服务与回调地址已配置，请检查邮箱；未收到邮件时请核对 SMTP 和 Redirect URL。');
    } catch (error) { setMessage('authMessage', error.message || '密码重置请求失败。', true); }
  }

  async function signOut() {
    try {
      if (platform()?.configured) {
        if (window.BryceAuth?.signOut) await window.BryceAuth.signOut();
        else { const { error } = await platform().client.auth.signOut({ scope: 'local' }); if (error) throw error; }
      }
      currentUser = null;
      isAdmin = false;
      sessionError = null;
      await refreshAll();
      setMessage('authMessage', '已退出登录。');
    } catch (error) {
      setMessage('authMessage', error.message || '退出登录失败。', true);
    }
  }

  function clearWorkForm() {
    ['workId', 'workTitle', 'workSlug', 'workSummary', 'workCover'].forEach((id) => { if ($(id)) $(id).value = ''; });
    if ($('workCoverFile')) $('workCoverFile').value = '';
    if ($('workCoverPreview')) { $('workCoverPreview').src = ''; $('workCoverPreview').classList.add('d-none'); }
    $('workCategory').value = 'fiction';
    $('workLanguage').value = 'zh';
    $('workSeries').value = '';
    $('workStatus').value = 'draft';
  }

  function clearChapterForm() {
    ['chapterId', 'chapterNumber', 'chapterTitle'].forEach((id) => { $(id).value = ''; });
    $('chapterStatus').value = 'draft';
    $('chapterEditor').innerHTML = '';
    if ($('chapterImageFile')) $('chapterImageFile').value = '';
  }

  function clearAdminPanels(message = '请使用已授权管理员登录后查看。') {
    worksCache = [];
    seriesCache = [];
    $('adminWorks').innerHTML = `<p class="platform-muted">${escapeHtml(message)}</p>`;
    $('adminSeries').innerHTML = `<p class="platform-muted">${escapeHtml(message)}</p>`;
    $('adminChapters').innerHTML = `<p class="platform-muted">${escapeHtml(message)}</p>`;
    $('adminCommentHistory').innerHTML = `<p class="platform-muted">${escapeHtml(message)}</p>`;
    fillSelect($('workSeries'), [], '独立作品');
    fillSelect($('chapterWork'), [], '请先选择作品');
    fillSelect($('historyWork'), [], '请选择作品（含归档作品）');
    clearWorkForm();
    clearChapterForm();
  }

  function fillSelect(element, rows, placeholder, selectedValue = '') {
    element.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>` + rows.map((row) => `<option value="${escapeHtml(row.id)}" ${row.id === selectedValue ? 'selected' : ''}>${escapeHtml(row.title)}</option>`).join('');
  }

  async function loadSeries() {
    if (!platform()?.configured || !isAdmin) {
      seriesCache = [];
      $('adminSeries').innerHTML = '<p class="platform-muted">请使用已授权管理员登录后管理系列。</p>';
      fillSelect($('workSeries'), [], '独立作品');
      return;
    }
    const { data, error } = await platform().client.from('series').select('id,title,slug,status,description,published_at,created_at').order('created_at', { ascending: false });
    if (error) throw error;
    seriesCache = data || [];
    fillSelect($('workSeries'), seriesCache, '独立作品');
    $('adminSeries').innerHTML = seriesCache.length ? seriesCache.map((series) => `<div class="chapter-row"><div><strong class="text-light">${escapeHtml(series.title)}</strong><div class="editor-help">${escapeHtml(series.slug)} · ${escapeHtml(series.status)}</div></div><div class="d-flex gap-2 align-items-center"><span class="platform-badge">${escapeHtml(series.status)}</span><button class="btn btn-outline-silver btn-sm" type="button" data-edit-series="${escapeHtml(series.id)}">编辑</button></div></div>`).join('') : '<p class="platform-muted">暂无系列。可使用上方表单创建。</p>';
    $('adminSeries').querySelectorAll('[data-edit-series]').forEach((button) => button.addEventListener('click', () => editSeries(button.dataset.editSeries)));
  }

  async function loadWorks() {
    const host = $('adminWorks');
    if (!platform()?.configured || !isAdmin) {
      worksCache = [];
      host.innerHTML = '<p class="platform-muted">请使用已授权管理员登录后管理作品。</p>';
      fillSelect($('chapterWork'), [], '请先选择作品');
      return;
    }
    const { data, error } = await platform().client.from('works').select('id,series_id,title,slug,summary,category,language,cover_path,status,published_at,created_at').order('created_at', { ascending: false });
    if (error) throw error;
    worksCache = data || [];
    fillSelect($('chapterWork'), worksCache, '请选择作品');
    fillSelect($('historyWork'), worksCache, '请选择作品（含归档作品）');
    host.innerHTML = worksCache.length ? worksCache.map((work) => {
      const series = seriesCache.find((item) => item.id === work.series_id);
      return `<div class="col-md-6"><article class="platform-card"><div class="d-flex justify-content-between gap-2"><span class="platform-badge">${escapeHtml(work.category)}</span><span class="platform-badge">${escapeHtml(work.status)}</span></div><h3 class="mt-3">${escapeHtml(work.title)}</h3><p>${escapeHtml(work.summary || '暂无简介')}</p><p class="small platform-muted">${escapeHtml(series?.title || '独立作品')} · ${escapeHtml(work.language || 'zh')}</p><div class="d-flex gap-2 flex-wrap"><button class="btn btn-outline-silver btn-sm" data-edit-work="${escapeHtml(work.id)}" type="button">编辑</button><button class="btn btn-outline-silver btn-sm" data-archive-work="${escapeHtml(work.id)}" type="button" ${work.status === 'archived' ? 'disabled' : ''}>归档</button><button class="btn btn-outline-silver btn-sm" data-view-history="${escapeHtml(work.id)}" type="button">查看评论历史</button></div></article></div>`;
    }).join('') : '<p class="platform-muted">暂无作品记录。添加一条作品试试看。</p>';
    host.querySelectorAll('[data-edit-work]').forEach((button) => button.addEventListener('click', () => editWork(button.dataset.editWork)));
    host.querySelectorAll('[data-archive-work]').forEach((button) => button.addEventListener('click', () => archiveWork(button.dataset.archiveWork)));
    host.querySelectorAll('[data-view-history]').forEach((button) => button.addEventListener('click', () => { $('historyWork').value = button.dataset.viewHistory; loadCommentHistory().catch((error) => setMessage('authMessage', error.message, true)); }));
  }

  async function loadCommentHistory() {
    const host = $('adminCommentHistory');
    if (!host) return;
    requireAdmin();
    const workId = $('historyWork').value;
    if (!workId) { host.innerHTML = '<p class="platform-muted">请选择作品以查看评论历史。</p>'; return; }
    const { data, error } = await platform().client.from('comments')
      .select('id,body,status,created_at,profiles!comments_user_id_profiles_fkey(display_name)')
      .eq('work_id', workId).order('created_at', { ascending: false });
    if (error) throw error;
    host.innerHTML = data?.length ? data.map((comment) => `<article class="chapter-row"><div><strong class="text-light">${escapeHtml(comment.profiles?.display_name || '读者')} · ${escapeHtml(comment.status)}</strong><p class="mb-1">${escapeHtml(comment.body)}</p><small class="editor-help">${new Date(comment.created_at).toLocaleString()}</small></div><button class="btn btn-outline-silver btn-sm" type="button" data-toggle-comment="${escapeHtml(comment.id)}" data-next-status="${comment.status === 'visible' ? 'hidden' : 'visible'}">${comment.status === 'visible' ? '隐藏评论' : '恢复公开'}</button></article>`).join('') : '<p class="platform-muted">该作品暂无评论记录。</p>';
    host.querySelectorAll('[data-toggle-comment]').forEach((button) => button.addEventListener('click', async () => {
      try {
        requireAdmin();
        const { error: updateError } = await platform().client.from('comments').update({ status: button.dataset.nextStatus }).eq('id', button.dataset.toggleComment);
        if (updateError) throw updateError;
        setMessage('authMessage', '评论状态已更新。');
        try { await loadCommentHistory(); }
        catch (refreshError) { setMessage('authMessage', `评论状态已更新，但历史列表刷新失败：${refreshError.message || '未知错误'}`, true); }
      } catch (error) { setMessage('authMessage', error.message || '更新评论状态失败。', true); }
    }));
  }

  async function saveWork(event) {
    event.preventDefault();
    try {
      requireAdmin();
      const id = $('workId').value;
      const title = $('workTitle').value.trim();
      const coverValue = $('workCover').value.trim();
      const parsedCover = coverValue ? window.BryceMedia?.parsePath(coverValue) : null;
      if (coverValue && !parsedCover && !/^https:\/\//i.test(coverValue)) throw new Error('封面路径无效；请使用 HTTPS URL 或通过 Storage 上传。');
      if ($('workStatus').value === 'published' && parsedCover?.kind === 'private') throw new Error('私有图片不能随已发布作品公开展示；请将作品设为草稿，或重新上传为明确公开的媒体。');
      if ($('workStatus').value === 'published' && /^https:\/\//i.test(coverValue) && (/[?#]/.test(coverValue) || /\/storage\/v1\/object\/sign\//i.test(coverValue))) throw new Error('公开作品不能使用带查询参数/片段或Supabase签名的封面URL。');
      const row = {
        title,
        slug: makeSlug($('workSlug').value.trim() || title),
        summary: $('workSummary').value.trim() || null,
        category: $('workCategory').value,
        language: $('workLanguage').value,
        series_id: $('workSeries').value || null,
        cover_path: $('workCover').value.trim() || null,
        status: $('workStatus').value,
        published_at: $('workStatus').value === 'published'
          ? (worksCache.find((work) => work.id === id)?.status === 'published'
            ? worksCache.find((work) => work.id === id)?.published_at || new Date().toISOString()
            : new Date().toISOString())
          : null
      };
      const query = id ? platform().client.from('works').update(row).eq('id', id) : platform().client.from('works').insert({ ...row, created_by: currentUser.id });
      const { error } = await query;
      if (error) throw error;
      clearWorkForm();
      setMessage('authMessage', '作品资料已保存。');
      try { await refreshAll(); } catch (refreshError) { setMessage('authMessage', `作品已保存，但列表刷新失败：${refreshError.message || '未知错误'}。请点击刷新列表，不要重复提交。`, true); }
    } catch (error) { setMessage('authMessage', error.message || '保存作品失败。', true); }
  }

  async function editWork(id) {
    const work = worksCache.find((item) => item.id === id);
    if (!work) return;
    $('workId').value = work.id;
    $('workTitle').value = work.title || '';
    $('workSlug').value = work.slug || '';
    $('workSummary').value = work.summary || '';
    $('workCategory').value = work.category || 'fiction';
    $('workLanguage').value = work.language || 'zh';
    $('workSeries').value = work.series_id || '';
    $('workCover').value = work.cover_path || '';
    $('workStatus').value = work.status || 'draft';
    $('workTitle').focus();
  }

  async function archiveWork(id) {
    if (!window.confirm('确定将这部作品归档吗？归档后普通读者将无法公开读取。')) return;
    try {
      requireAdmin();
      const { error } = await platform().client.from('works').update({ status: 'archived' }).eq('id', id);
      if (error) throw error;
      setMessage('authMessage', '作品已归档，评论历史保留。');
      try { await refreshAll(); } catch (refreshError) { setMessage('authMessage', `作品已归档，但列表刷新失败：${refreshError.message || '未知错误'}。请点击刷新列表。`, true); }
    } catch (error) { setMessage('authMessage', error.message || '归档失败。', true); }
  }

  async function saveSeries(event) {
    event.preventDefault();
    try {
      requireAdmin();
      const { user } = await window.BryceAuth.requireAdmin();
      const id = $('seriesId')?.value || '';
      const title = $('seriesTitle').value.trim();
      const previous = seriesCache.find((item) => item.id === id);
      const row = {
        title,
        slug: makeSlug($('seriesSlug').value.trim() || title),
        description: $('seriesDescription').value.trim() || null,
        status: $('seriesStatus').value,
        published_at: $('seriesStatus').value === 'published' ? (previous?.status === 'published' ? previous.published_at || new Date().toISOString() : new Date().toISOString()) : null
      };
      if (!id) row.created_by = user.id;
      const query = id ? platform().client.from('series').update(row).eq('id', id) : platform().client.from('series').insert(row);
      const { error } = await query;
      if (error) throw error;
      clearSeriesForm();
      setMessage('authMessage', id ? '系列已更新。' : '系列已创建。');
      try { await refreshAll(); }
      catch (refreshError) { setMessage('authMessage', `系列已创建，但列表刷新失败：${refreshError.message || '未知错误'}。请点击刷新列表，不要重复提交。`, true); }
    } catch (error) { setMessage('authMessage', error.message || '保存系列失败。', true); }
  }

  function clearSeriesForm() {
    $('seriesForm')?.reset();
    if ($('seriesId')) $('seriesId').value = '';
    const button = $('saveSeriesBtn'); if (button) button.textContent = '创建系列';
  }

  function editSeries(id) {
    const item = seriesCache.find((row) => row.id === id);
    if (!item) return;
    $('seriesId').value = item.id;
    $('seriesTitle').value = item.title || '';
    $('seriesSlug').value = item.slug || '';
    $('seriesDescription').value = item.description || '';
    $('seriesStatus').value = item.status || 'draft';
    const button = $('saveSeriesBtn'); if (button) button.textContent = '保存系列修改';
    $('seriesTitle').focus();
  }

  function readInlineMarks(node) {
    const output = [];
    const visit = (current, marks = []) => {
      if (current.nodeType === Node.TEXT_NODE) {
        if (current.nodeValue) output.push({ type: 'text', text: current.nodeValue, ...(marks.length ? { marks: marks.map((mark) => mark.startsWith('link:') ? { type: 'link', attrs: { href: mark.slice(5) } } : { type: mark }) } : {}) });
        return;
      }
      if (current.nodeType !== Node.ELEMENT_NODE) return;
      const tag = current.tagName.toLowerCase();
      if (tag === 'br') { output.push({ type: 'text', text: '\n' }); return; }
      const next = [...marks];
      if (tag === 'strong' || tag === 'b') next.push('bold');
      if (tag === 'em' || tag === 'i') next.push('italic');
      if (tag === 'u') next.push('underline');
      if (tag === 'a') {
        const href = current.getAttribute('href') || '';
        if (/^https:\/\//i.test(href)) next.push(`link:${href}`);
      }
      current.childNodes.forEach((child) => visit(child, next));
    };
    node.childNodes.forEach((child) => visit(child));
    return output;
  }

  function editorToDocument() {
    const root = $('chapterEditor');
    const blocks = [];
    const appendBlock = (type, element) => {
      const content = readInlineMarks(element);
      if (content.length || type === 'divider') blocks.push({ type, ...(type === 'divider' ? {} : { content }) });
    };
    const visitBlock = (element) => {
      if (element.nodeType === Node.TEXT_NODE) {
        if (element.nodeValue.trim()) blocks.push({ type: 'paragraph', content: [{ type: 'text', text: element.nodeValue }] });
        return;
      }
      if (element.nodeType !== Node.ELEMENT_NODE) return;
      const tag = element.tagName.toLowerCase();
      if (tag === 'h1' || tag === 'h2' || tag === 'h3') appendBlock('heading', element);
      else if (tag === 'blockquote') appendBlock('blockquote', element);
      else if (tag === 'ul' || tag === 'ol') {
        const items = [...element.children].filter((child) => child.tagName.toLowerCase() === 'li').map((li) => ({ type: 'list_item', content: readInlineMarks(li) }));
        blocks.push({ type: tag === 'ul' ? 'bullet_list' : 'ordered_list', content: items });
      } else if (tag === 'hr') blocks.push({ type: 'divider' });
      else if (tag === 'img') {
        const src = element.getAttribute('src') || '';
        if (/^https:\/\//i.test(src)) blocks.push({ type: 'image', attrs: { src, alt: element.getAttribute('alt') || '' } });
      } else if (tag === 'p' || tag === 'div') appendBlock('paragraph', element);
      else element.childNodes.forEach(visitBlock);
    };
    root.childNodes.forEach(visitBlock);
    return { type: 'doc', version: 1, content: blocks };
  }

  function inlineToHtml(nodes = []) {
    return nodes.map((node) => {
      if (node.type !== 'text') return '';
      let value = escapeHtml(node.text || '');
      (node.marks || []).forEach((mark) => {
        if (mark.type === 'bold') value = `<strong>${value}</strong>`;
        else if (mark.type === 'italic') value = `<em>${value}</em>`;
        else if (mark.type === 'underline') value = `<u>${value}</u>`;
        else if (mark.type === 'link' && /^https:\/\//i.test(mark.attrs?.href || '')) value = `<a href="${escapeHtml(mark.attrs.href)}" rel="noopener noreferrer" target="_blank">${value}</a>`;
      });
      return value.replace(/\n/g, '<br>');
    }).join('');
  }

  function documentToHtml(documentValue) {
    const doc = documentValue && documentValue.type === 'doc' && Array.isArray(documentValue.content) ? documentValue : { type: 'doc', content: [] };
    return doc.content.map((block) => {
      if (block.type === 'divider') return '<hr>';
      if (block.type === 'image' && /^https:\/\//i.test(block.attrs?.src || '')) return `<p><img src="${escapeHtml(block.attrs.src)}" alt="${escapeHtml(block.attrs.alt || '')}"></p>`;
      const content = inlineToHtml(block.content || []);
      if (block.type === 'heading') return `<h2>${content}</h2>`;
      if (block.type === 'blockquote') return `<blockquote>${content}</blockquote>`;
      if (block.type === 'bullet_list' || block.type === 'ordered_list') {
        const tag = block.type === 'bullet_list' ? 'ul' : 'ol';
        return `<${tag}>${(block.content || []).map((item) => `<li>${inlineToHtml(item.content || [])}</li>`).join('')}</${tag}>`;
      }
      return `<p>${content}</p>`;
    }).join('');
  }

  async function getExistingChapterPublishedAt(chapterId) {
    const { data, error } = await platform().client.from('work_chapters')
      .select('status,published_at').eq('id', chapterId).maybeSingle();
    if (error) throw error;
    if (data?.status === 'published' && data.published_at) return data.published_at;
    return new Date().toISOString();
  }

  async function saveChapter(event) {
    event.preventDefault();
    try {
      requireAdmin();
      const id = $('chapterId').value;
      const status = $('chapterStatus').value;
      const row = {
        work_id: $('chapterWork').value,
        chapter_number: Number($('chapterNumber').value),
        title: $('chapterTitle').value.trim(),
        body: editorToDocument(),
        status,
        published_at: null
      };
      if (!row.work_id || !row.title || !Number.isInteger(row.chapter_number) || row.chapter_number < 1) throw new Error('请填写有效的作品、章节序号和标题。');
      if (!row.body.content.length) throw new Error('章节正文不能为空。');
      if (JSON.stringify(row.body).length > 200000) throw new Error('章节正文超过 200 KB 限制，请压缩内容或拆分章节。');
      if (status === 'published' && /"(src|href)"\s*:\s*"https:\/\/[^" ]*[?#]|\/storage\/v1\/object\/sign\//i.test(JSON.stringify(row.body))) throw new Error('公开章节不能包含签名URL、查询字符串或片段；请改用公开Storage图片。');
      if (status === 'published') row.published_at = id ? await getExistingChapterPublishedAt(id) : new Date().toISOString();
      const query = id ? platform().client.from('work_chapters').update(row).eq('id', id) : platform().client.from('work_chapters').insert(row);
      const { error } = await query;
      if (error) throw error;
      clearChapterForm();
      setMessage('chapterMessage', '章节已保存。请确认所属作品也已发布后，读者才能公开阅读。');
      await loadChapters();
    } catch (error) { setMessage('chapterMessage', error.message || '保存章节失败。', true); }
  }

  async function loadChapters() {
    const host = $('adminChapters');
    if (!platform()?.configured || !isAdmin) { host.innerHTML = '<p class="platform-muted">请使用已授权管理员登录后查看章节。</p>'; return; }
    try {
      const workId = $('chapterWork').value;
      let query = platform().client.from('work_chapters').select('id,work_id,chapter_number,title,status,updated_at').order('chapter_number', { ascending: true });
      if (workId) query = query.eq('work_id', workId);
      const { data, error } = await query;
      if (error) throw error;
      const rows = data || [];
      host.innerHTML = rows.length ? rows.map((chapter) => `<div class="chapter-row"><div><strong class="text-light">第 ${escapeHtml(chapter.chapter_number)} 章 · ${escapeHtml(chapter.title)}</strong><div class="editor-help">${escapeHtml(worksCache.find((work) => work.id === chapter.work_id)?.title || '作品')} · ${escapeHtml(chapter.status)}</div></div><div class="d-flex gap-2"><button class="btn btn-outline-silver btn-sm" type="button" data-edit-chapter="${escapeHtml(chapter.id)}">编辑</button><button class="btn btn-outline-silver btn-sm" type="button" data-delete-chapter="${escapeHtml(chapter.id)}">删除</button></div></div>`).join('') : '<p class="platform-muted">当前筛选下暂无章节。</p>';
      host.querySelectorAll('[data-edit-chapter]').forEach((button) => button.addEventListener('click', () => editChapter(button.dataset.editChapter)));
      host.querySelectorAll('[data-delete-chapter]').forEach((button) => button.addEventListener('click', () => deleteChapter(button.dataset.deleteChapter)));
    } catch (error) { host.innerHTML = `<p class="text-warning">${escapeHtml(error.message)}</p>`; }
  }

  async function editChapter(id) {
    try {
      requireAdmin();
      const { data, error } = await platform().client.from('work_chapters').select('id,work_id,chapter_number,title,body,status').eq('id', id).single();
      if (error) throw error;
      $('chapterId').value = data.id;
      $('chapterWork').value = data.work_id;
      $('chapterNumber').value = data.chapter_number;
      $('chapterTitle').value = data.title;
      $('chapterStatus').value = data.status;
      $('chapterEditor').innerHTML = documentToHtml(data.body);
      $('chapterTitle').focus();
      await loadChapters();
    } catch (error) { setMessage('chapterMessage', error.message || '无法加载章节。', true); }
  }

  async function deleteChapter(id) {
    if (!window.confirm('确定删除这章正文吗？此操作不可直接撤销。建议优先将章节改为草稿。')) return;
    try {
      requireAdmin();
      const { error } = await platform().client.from('work_chapters').delete().eq('id', id);
      if (error) throw error;
      await loadChapters();
      setMessage('chapterMessage', '章节已删除。');
    } catch (error) { setMessage('chapterMessage', error.message || '删除章节失败。', true); }
  }

  function runEditorCommand(command) {
    $('chapterEditor').focus();
    document.execCommand(command, false, null);
  }

  function insertLink() {
    const url = window.prompt('请输入 HTTPS 链接');
    if (!url) return;
    if (!/^https:\/\//i.test(url)) return setMessage('chapterMessage', '仅允许 HTTPS 链接。', true);
    $('chapterEditor').focus();
    document.execCommand('createLink', false, url);
  }

  function insertImage() {
    const picker = $('chapterImageFile');
    if (!picker) return setMessage('chapterMessage', '图片上传控件不可用。', true);
    picker.click();
  }

  async function refreshAll() {
    try {
      await refreshSession();
    } catch (error) {
      currentUser = null;
      isAdmin = false;
      sessionError = error;
      $('authState').textContent = '无法读取登录状态；为安全起见，管理功能已禁用。';
      clearAdminPanels('无法验证登录状态。请检查网络后刷新页面。');
      setMessage('authMessage', `会话检查失败：${error.message || '未知错误'}`, true);
      return;
    }
    if (!isAdmin) {
      const message = sessionError
        ? `管理员权限检查失败：${sessionError.message || '请检查网络或数据库配置。'}`
        : '请使用已授权管理员登录后查看。';
      clearAdminPanels(message);
      if (sessionError) setMessage('authMessage', message, true);
      return;
    }
    try { await loadSeries(); }
    catch (error) {
      seriesCache = [];
      fillSelect($('workSeries'), [], '独立作品');
      $('adminSeries').innerHTML = `<p class="text-warning">系列加载失败：${escapeHtml(error.message || '未知错误')}</p>`;
      setMessage('authMessage', '系列加载失败；继续尝试读取作品和章节。', true);
    }
    try { await loadWorks(); }
    catch (error) {
      worksCache = [];
      fillSelect($('chapterWork'), [], '请先选择作品');
      fillSelect($('historyWork'), [], '请选择作品（含归档作品）');
      $('adminWorks').innerHTML = `<p class="text-warning">作品加载失败：${escapeHtml(error.message || '未知错误')}</p>`;
      $('adminCommentHistory').innerHTML = '<p class="platform-muted">作品列表不可用，无法选择评论历史。</p>';
      setMessage('authMessage', '作品加载失败；继续尝试读取章节。', true);
    }
    await loadChapters();
  }

  function watchAuthChanges() {
    const p = platform();
    if (!p?.configured || !p.client.auth.onAuthStateChange) return;
    p.client.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        currentUser = null;
        isAdmin = false;
        sessionError = null;
        $('authState').textContent = '尚未登录。';
        clearAdminPanels();
        return;
      }
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        queueMicrotask(() => refreshAll().catch((error) => {
          clearAdminPanels('管理员状态刷新失败。');
          setMessage('authMessage', error.message || '管理员状态刷新失败。', true);
        }));
      }
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    $('authForm')?.addEventListener('submit', signIn);
    $('logoutBtn')?.addEventListener('click', signOut);
    $('forgotPasswordBtn')?.addEventListener('click', requestPasswordReset);
    $('workForm')?.addEventListener('submit', saveWork);
    $('clearWorkBtn')?.addEventListener('click', clearWorkForm);
    $('refreshWorksBtn')?.addEventListener('click', () => refreshAll().catch((error) => setMessage('authMessage', error.message, true)));
    $('seriesForm')?.addEventListener('submit', saveSeries);
    $('clearSeriesBtn')?.addEventListener('click', clearSeriesForm);
    $('chapterForm')?.addEventListener('submit', saveChapter);
    $('clearChapterBtn')?.addEventListener('click', clearChapterForm);
    $('refreshChaptersBtn')?.addEventListener('click', loadChapters);
    $('historyWork')?.addEventListener('change', () => loadCommentHistory().catch((error) => setMessage('authMessage', error.message || '读取评论历史失败。', true)));
    $('chapterWork')?.addEventListener('change', loadChapters);
    document.querySelectorAll('[data-command]').forEach((button) => button.addEventListener('click', () => runEditorCommand(button.dataset.command)));
    document.querySelectorAll('[data-block]').forEach((button) => button.addEventListener('click', () => { $('chapterEditor').focus(); document.execCommand('formatBlock', false, button.dataset.block); }));
    $('insertLinkBtn')?.addEventListener('click', insertLink);
    $('insertImageBtn')?.addEventListener('click', insertImage);
    watchAuthChanges();
    try { await refreshAll(); } catch (error) {
      clearAdminPanels('后台初始化失败；请检查网络后重试。');
      setMessage('authMessage', error.message || '初始化失败。', true);
    }
  });
})();
