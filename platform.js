(() => {
  const source = window.BRYCE_SUPABASE_CONFIG || {};
  const urlValue = typeof source.url === 'string' ? source.url.trim() : '';
  const keyValue = typeof source.anonKey === 'string' ? source.anonKey.trim() : '';
  let configError = '';
  let configState = 'not-configured';
  let projectUrl = null;
  let client = null;

  const secretKey = (value) => {
    if (/^sb_secret_/i.test(value)) return true;
    const parts = value.split('.');
    if (parts.length !== 3) return false;
    try {
      const encoded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = encoded + '='.repeat((4 - encoded.length % 4) % 4);
      const payload = JSON.parse(atob(padded));
      return payload.role === 'service_role';
    } catch (_) {
      return false;
    }
  };

  if (urlValue || keyValue) {
    if (!urlValue || !keyValue) {
      configState = 'partial-config';
      configError = 'Supabase URL 和公开 anon/publishable key 必须同时配置。';
    } else {
      try {
        projectUrl = new URL(urlValue);
        const localHost = ['localhost', '127.0.0.1', '[::1]'].includes(projectUrl.hostname);
        const secureProtocol = projectUrl.protocol === 'https:';
        const localHttp = projectUrl.protocol === 'http:' && localHost;
        if (!secureProtocol && !localHttp) throw new Error('Project URL 必须使用 HTTPS（本机 localhost 测试可使用 HTTP）。');
        if (projectUrl.username || projectUrl.password || projectUrl.search || projectUrl.hash || (projectUrl.pathname && projectUrl.pathname !== '/')) {
          throw new Error('Project URL 应是项目根地址，不应包含用户名、密码、API 子路径、查询参数或片段。');
        }
        if (secretKey(keyValue)) throw new Error('检测到 Secret/service_role key。此密钥禁止放入浏览器配置。');
        if (!window.supabase || typeof window.supabase.createClient !== 'function') {
          configState = 'sdk-unavailable';
          configError = 'Supabase SDK 未加载。请检查网络和 Supabase CDN 请求。';
        } else {
          try {
            client = window.supabase.createClient(projectUrl.toString().replace(/\/$/, ''), keyValue);
            configState = 'ready';
          } catch (error) {
            configState = 'invalid-config';
            configError = `Supabase 客户端初始化失败：${error.message || '请检查 Project URL 与公开 key。'}`;
          }
        }
      } catch (error) {
        configState = 'invalid-config';
        configError = error.message || 'Project URL 格式无效。请粘贴 Supabase Dashboard 中的 Project URL，而不是项目显示名称。';
      }
    }
  }

  const configured = Boolean(client);
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const safeHttpsUrl = (value) => /^https:\/\//i.test(String(value || '')) ? String(value) : '';
  const publicMediaUrl = (value) => {
    const raw = String(value || '').trim();
    if (/^https:\/\//i.test(raw)) return raw;
    const match = /^public:([A-Za-z0-9._/-]+)$/.exec(raw);
    if (!match || match[1].startsWith('/') || match[1].split('/').includes('..') || !client) return '';
    const bucket = window.BRYCE_MEDIA_BUCKETS?.public;
    if (!bucket) return '';
    return client.storage.from(bucket).getPublicUrl(match[1]).data?.publicUrl || '';
  };
  const statusMessage = () => {
    if (configState === 'not-configured') return '演示模式：Supabase 尚未配置，真实账号、互动和数据保存不可用。请使用 Project URL 与公开 anon/publishable key 配置。';
    if (configError) return `Supabase 配置状态：${configError}`;
    return 'Supabase 客户端已配置；数据库连接、RLS 权限及数据读写仍需实际验证。';
  };

  window.BrycePlatform = {
    configured,
    configState,
    configError,
    client,
    escape: escapeHtml,
    safeHttpsUrl,
    publicMediaUrl,
    statusMessage,
    async getPublishedWorks() {
      if (!client) return [];
      const { data, error } = await client.from('works')
        .select('id,title,slug,summary,category,language,series_id,cover_path,status,published_at')
        .eq('status', 'published').order('published_at', { ascending: false, nullsFirst: false });
      if (error) throw error;
      const rows = data || [];
      const seriesIds = [...new Set(rows.map((work) => work.series_id).filter(Boolean))];
      let seriesMap = {};
      if (seriesIds.length) {
        const { data: seriesRows, error: seriesError } = await client.from('series')
          .select('id,title,status').in('id', seriesIds).eq('status', 'published');
        if (seriesError) throw seriesError;
        seriesMap = Object.fromEntries((seriesRows || []).map((series) => [series.id, series]));
      }
      return rows.filter((work) => !work.series_id || seriesMap[work.series_id])
        .map((work) => ({ ...work, series_title: seriesMap[work.series_id]?.title || null }));
    },
    renderWorkCard(work) {
      const cover = publicMediaUrl(work.cover_path);
      const title = escapeHtml(work.title);
      const summary = escapeHtml(work.summary || '暂无简介');
      const category = escapeHtml(work.category || 'fiction');
      const seriesTitle = escapeHtml(work.series_title || '独立作品');
      const coverHtml = cover ? `<img class="img-fluid rounded mb-3" src="${escapeHtml(cover)}" alt="${title}" loading="lazy">` : '';
      return `<div class="col-md-6 col-lg-4 work-item" data-category="${category}"><article class="platform-card">${coverHtml}<span class="platform-badge">${category}</span><h3 class="mt-3">${title}</h3><p>${summary}</p><p class="platform-muted small">${escapeHtml(work.language || 'zh')} · ${seriesTitle}</p><a class="btn btn-outline-silver btn-sm" href="read.html?work=${encodeURIComponent(work.id)}">查看章节</a></article></div>`;
    }
  };

  document.addEventListener('DOMContentLoaded', async () => {
    const banner = document.querySelector('[data-platform-mode]');
    if (banner) banner.textContent = statusMessage();
    const worksGrid = document.querySelector('[data-live-works]');
    if (worksGrid && configured) {
      try {
        const works = await window.BrycePlatform.getPublishedWorks();
        if (works.length) worksGrid.innerHTML = works.map((work) => window.BrycePlatform.renderWorkCard(work)).join('');
        else worksGrid.innerHTML = '<div class="col-12"><p class="platform-muted">目前还没有公开发布的作品。</p></div>';
      } catch (error) {
        worksGrid.innerHTML = `<div class="col-12"><div class="alert alert-warning">暂时无法读取在线作品：${escapeHtml(error.message)}</div></div>`;
      }
    }
  });
})();
