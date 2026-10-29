(() => {
  const $ = (id) => document.getElementById(id);
  const platform = () => window.BrycePlatform;
  const escapeHtml = (value) => platform()?.escape ? platform().escape(value) : String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  let currentUser = null;
  let works = [];

  function message(value, isError = false) {
    const target = $('authMessage');
    if (!target) return;
    target.textContent = value;
    target.className = `small mt-2 ${isError ? 'text-warning' : 'text-info'}`;
  }

  async function refreshSession() {
    const p = platform();
    if (!p?.configured) {
      currentUser = null;
      $('authState').textContent = p?.statusMessage?.() || '演示模式：未连接在线账号服务。';
      return;
    }
    const { data, error } = await p.client.auth.getSession();
    if (error) throw error;
    currentUser = data?.session?.user || null;
    $('authState').textContent = currentUser ? `已登录：${currentUser.email || '读者账户'}` : '尚未登录。';
  }

  async function signIn(event) {
    event.preventDefault();
    if (!platform()?.configured) return message('请先配置 Supabase；演示模式不会创建真实账号。', true);
    try {
      if (window.BryceAuth?.signIn) await window.BryceAuth.signIn($('authEmail').value, $('authPassword').value);
      else { const { error } = await platform().client.auth.signInWithPassword({ email: $('authEmail').value.trim(), password: $('authPassword').value }); if (error) throw error; }
      $('authPassword').value = '';
      await refreshSession();
      await loadFavorites();
      message('登录成功。');
    } catch (error) { message(error.message || '登录失败。', true); }
  }

  async function signUp() {
    if (!platform()?.configured) return message('请先配置 Supabase；演示模式不会创建真实账号。', true);
    const email = $('authEmail').value.trim();
    const password = $('authPassword').value;
    if (!email || !password) return message('请先填写邮箱和密码。', true);
    try {
      if (window.BryceAuth?.signUp) await window.BryceAuth.signUp(email, password);
      else { const { error } = await platform().client.auth.signUp({ email, password }); if (error) throw error; }
      message('注册请求已提交。是否收到验证邮件取决于项目SMTP与Redirect URL配置；未验证前可能无法登录。');
    } catch (error) { message(error.message || '注册失败。', true); }
  }

  async function requestPasswordReset() {
    const email = $('authEmail').value.trim();
    if (!email) return message('请先填写账户邮箱，再请求重置邮件。', true);
    try {
      if (!window.BryceAuth?.requestPasswordReset) throw new Error('认证服务未加载。');
      await window.BryceAuth.requestPasswordReset(email);
      message('密码重置请求已提交。请检查邮箱；若未收到，请核对SMTP和Redirect URL配置。');
    } catch (error) { message(error.message || '密码重置请求失败。', true); }
  }

  async function signOut() {
    try {
      if (platform()?.configured) {
        if (window.BryceAuth?.signOut) await window.BryceAuth.signOut();
        else { const { error } = await platform().client.auth.signOut({ scope: 'local' }); if (error) throw error; }
      }
      currentUser = null;
      await refreshSession();
      await loadFavorites();
      message('已退出登录。');
    } catch (error) { message(error.message || '退出登录失败。', true); }
  }

  async function loadWorks() {
    const host = $('communityWorks');
    if (!platform()?.configured) {
      host.innerHTML = '<p class="platform-muted">配置 Supabase 后，这里会显示正式发布的作品。</p>';
      $('commentWork').innerHTML = '<option value="">请先选择公开作品</option>';
      return;
    }
    works = await platform().getPublishedWorks();
    host.innerHTML = works.length ? works.map((work) => {
      const cover = platform().safeHttpsUrl(work.cover_path);
      return `<div class="col-md-6"><article class="platform-card">${cover ? `<img class="img-fluid rounded mb-3" src="${escapeHtml(cover)}" alt="${escapeHtml(work.title)}" loading="lazy">` : ''}<span class="platform-badge">${escapeHtml(work.category)}</span><h3 class="mt-3">${escapeHtml(work.title)}</h3><p>${escapeHtml(work.summary || '暂无简介')}</p><div class="d-flex gap-2 flex-wrap"><a class="btn btn-outline-silver btn-sm" href="read.html?work=${encodeURIComponent(work.id)}">阅读章节</a><button class="btn btn-outline-silver btn-sm" type="button" data-favorite="${escapeHtml(work.id)}">☆ 收藏</button></div></article></div>`;
    }).join('') : '<p class="platform-muted">目前还没有公开作品。</p>';
    $('commentWork').innerHTML = '<option value="">请选择作品</option>' + works.map((work) => `<option value="${escapeHtml(work.id)}">${escapeHtml(work.title)}</option>`).join('');
    host.querySelectorAll('[data-favorite]').forEach((button) => button.addEventListener('click', () => toggleFavorite(button.dataset.favorite, button)));
    await loadFavorites();
  }

  async function toggleFavorite(workId, button) {
    if (!platform()?.configured) return message('演示模式不保存真实收藏。', true);
    if (!currentUser) return message('请先登录再收藏作品。', true);
    try {
      const client = platform().client;
      const { data: existing, error: readError } = await client.from('favorites').select('work_id').eq('user_id', currentUser.id).eq('work_id', workId).maybeSingle();
      if (readError) throw readError;
      const result = existing
        ? await client.from('favorites').delete().eq('user_id', currentUser.id).eq('work_id', workId)
        : await client.from('favorites').insert({ work_id: workId, user_id: currentUser.id });
      if (result.error) throw result.error;
      button.textContent = existing ? '☆ 收藏' : '★ 已收藏';
    } catch (error) { message(error.message || '收藏操作失败。', true); }
  }

  async function loadFavorites() {
    const buttons = document.querySelectorAll('[data-favorite]');
    if (!platform()?.configured || !currentUser) {
      buttons.forEach((button) => { button.textContent = '☆ 收藏'; });
      return;
    }
    const { data, error } = await platform().client.from('favorites').select('work_id').eq('user_id', currentUser.id);
    if (error) { message(`无法读取收藏状态：${error.message}`, true); return; }
    const ids = new Set((data || []).map((item) => item.work_id));
    buttons.forEach((button) => { button.textContent = ids.has(button.dataset.favorite) ? '★ 已收藏' : '☆ 收藏'; });
  }

  async function loadComments() {
    const host = $('commentsList');
    if (!platform()?.configured) {
      host.innerHTML = '<p class="platform-muted">连接在线数据库后，公开评论会显示在这里。</p>';
      return;
    }
    try {
      const { data, error } = await platform().client.from('comments')
        .select('id,work_id,user_id,body,status,created_at,profiles!comments_user_id_profiles_fkey(display_name),works!inner(id,title,status,series_id,series!works_series_id_fkey(status))').eq('status', 'visible').eq('works.status', 'published')
        .order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      host.innerHTML = data?.length ? data.map((comment) => {
        const work = works.find((item) => item.id === comment.work_id);
        const series = comment.works?.series;
        if (comment.works?.series_id && series?.status !== 'published') return '';
        return `<article class="platform-card mb-3"><p>${escapeHtml(comment.body)}</p><span class="small platform-muted">${escapeHtml(comment.profiles?.display_name || '读者')} · ${escapeHtml(work?.title || comment.works?.title || '作品讨论')} · ${new Date(comment.created_at).toLocaleString()}</span></article>`;
      }).join('') : '<p class="platform-muted">欢迎成为第一个参与讨论的读者。</p>';
    } catch (error) { host.innerHTML = `<p class="text-warning">暂时无法读取评论：${escapeHtml(error.message)}</p>`; }
  }

  function watchAuthChanges() {
    const p = platform();
    if (!p?.configured || !p.client.auth.onAuthStateChange) return;
    p.client.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        currentUser = null;
        $('authState').textContent = '尚未登录。';
        queueMicrotask(() => loadFavorites().catch((error) => message(error.message || '无法刷新收藏状态。', true)));
      } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        currentUser = session?.user || null;
        $('authState').textContent = currentUser ? `已登录：${currentUser.email || '读者账户'}` : '尚未登录。';
        queueMicrotask(() => loadFavorites().catch((error) => message(error.message || '无法刷新收藏状态。', true)));
      }
    });
  }

  async function postComment() {
    const body = $('commentBody').value.trim();
    const workId = $('commentWork').value;
    if (!body) return message('请先填写评论内容。', true);
    if (!workId) return message('请先选择一部公开作品。', true);
    if (!platform()?.configured) return message('演示模式不保存真实评论。', true);
    if (!currentUser) return message('请先登录后再发表评论。', true);
    try {
      const { error } = await platform().client.from('comments').insert({ work_id: workId, user_id: currentUser.id, body });
      if (error) throw error;
      $('commentBody').value = '';
      await loadComments();
      message('评论已发布，感谢参与讨论！');
    } catch (error) { message(error.message || '评论发布失败。', true); }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    $('authForm')?.addEventListener('submit', signIn);
    $('signupBtn')?.addEventListener('click', signUp);
    $('logoutBtn')?.addEventListener('click', signOut);
    $('forgotPasswordBtn')?.addEventListener('click', requestPasswordReset);
    $('postCommentBtn')?.addEventListener('click', postComment);
    $('refreshCommentsBtn')?.addEventListener('click', loadComments);
    watchAuthChanges();
    try {
      await refreshSession();
    } catch (error) {
      currentUser = null;
      $('authState').textContent = '登录状态暂不可用；公开内容仍会尝试加载。';
      message(`无法读取登录状态：${error.message || '未知错误'}`, true);
    }
    try {
      await loadWorks();
    } catch (error) {
      $('communityWorks').innerHTML = `<p class="text-warning">暂时无法读取公开作品：${escapeHtml(error.message || '未知错误')}</p>`;
      $('commentWork').innerHTML = '<option value="">公开作品读取失败</option>';
      message(`暂时无法读取公开作品：${error.message || '未知错误'}`, true);
    }
    await loadComments();
  });
})();
