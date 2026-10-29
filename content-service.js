/* Data access for V7 site content. Database RLS is the final authorization boundary. */
(() => {
  const client = () => {
    const p = window.BrycePlatform;
    if (!p?.configured || !p.client) throw new Error(p?.statusMessage?.() || 'Supabase 未配置。');
    return p.client;
  };
  const clean = (value, max = 10000) => String(value ?? '').trim().slice(0, max);
  const locales = new Set(['zh', 'en', 'fr']);
  const types = new Set(['character', 'world', 'gallery', 'journal']);
  const statuses = new Set(['draft', 'published', 'archived']);

  async function requireAdmin() {
    if (window.BryceAuth?.requireAdmin) return window.BryceAuth.requireAdmin();
    const db = client();
    const { data: sessionData, error: sessionError } = await db.auth.getSession();
    if (sessionError) throw sessionError;
    if (!sessionData?.session?.user) throw new Error('请先登录。');
    const { data, error } = await db.rpc('is_admin');
    if (error) throw error;
    if (data !== true) throw new Error('此操作仅限已授权管理员。');
    return { client: db, user: sessionData.session.user };
  }

  function validateLocale(locale) {
    if (!locales.has(locale)) throw new Error('语言仅支持中文、English 或 Français。');
  }
  function validateStatus(status) {
    if (!statuses.has(status)) throw new Error('发布状态无效。');
  }
  function validateEntry(entry) {
    if (!types.has(entry.entry_type)) throw new Error('条目类型无效。');
    validateLocale(entry.locale);
    validateStatus(entry.status);
    if (!clean(entry.title, 200)) throw new Error('标题不能为空。');
    if (!/^[a-z0-9\u4e00-\u9fff]+(?:-[a-z0-9\u4e00-\u9fff]+)*$/i.test(clean(entry.slug, 180))) throw new Error('URL 标识只能包含字母、数字、中文字符和连字符。');
    if (String(entry.summary ?? '').trim().length > 3000 || String(entry.body_text ?? '').trim().length > 50000) throw new Error('正文或摘要超过长度限制。');
    const cover = clean(entry.cover_path, 1000);
    if (cover && !/^https:\/\//i.test(cover) && !/^(public|private):[A-Za-z0-9._/-]+$/.test(cover)) throw new Error('封面必须是 HTTPS URL 或受控 Storage 路径。');
    if (cover.includes('..')) throw new Error('Storage 路径无效。');
    if (entry.status === 'published' && cover.startsWith('private:')) throw new Error('私有Storage路径不能发布。');
    if (entry.status === 'published' && /^https:\/\//i.test(cover) && (/[?#]/.test(cover) || /\/storage\/v1\/object\/sign\//i.test(cover))) {
      throw new Error('公开封面不能使用带查询参数/片段或Supabase签名的URL；请改用明确公开的Storage对象。');
    }
  }

  window.BryceContent = {
    types: [...types],
    async getPublishedContent(locale) {
      validateLocale(locale);
      const { data, error } = await client().from('site_content')
        .select('content_key,locale,body_text,status,updated_at')
        .eq('locale', locale).eq('status', 'published');
      if (error) throw error;
      return data || [];
    },
    async listSiteContent(locale, prefix = '') {
      const { client: db } = await requireAdmin();
      validateLocale(locale);
      let query = db.from('site_content').select('content_key,locale,body_text,status,updated_at').eq('locale', locale).order('content_key');
      if (prefix) query = query.like('content_key', `${prefix}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    async saveSiteContent(rows, status) {
      const { client: db, user } = await requireAdmin();
      validateStatus(status);
      if (!Array.isArray(rows) || !rows.length) throw new Error('没有可保存的文案。');
      const now = new Date().toISOString();
      const payload = rows.map((row) => {
        validateLocale(row.locale);
        const key = clean(row.content_key, 180);
        if (!/^[a-z0-9_.-]+$/i.test(key)) throw new Error(`无效的文案键：${key}`);
        return { content_key: key, locale: row.locale, body_text: clean(row.body_text, 8000), status, published_at: status === 'published' ? now : null, created_by: user.id };
      });
      const { data, error } = await db.from('site_content').upsert(payload, { onConflict: 'content_key,locale' }).select('content_key,locale,status');
      if (error) throw error;
      return data || [];
    },
    async getPublishedContacts() {
      const { data, error } = await client().from('contact_channels')
        .select('id,channel_type,label,value,href,display_order')
        .eq('status', 'published').order('display_order', { ascending: true }).order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    async listContacts() {
      const { client: db } = await requireAdmin();
      const { data, error } = await db.from('contact_channels').select('*').order('display_order', { ascending: true }).order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    async saveContact(row) {
      const { client: db, user } = await requireAdmin();
      validateStatus(row.status);
      const allowed = new Set(['email', 'business', 'social', 'other']);
      const channel = clean(row.channel_type, 20);
      if (!allowed.has(channel)) throw new Error('联系方式类型无效。');
      const label = clean(row.label, 120), value = clean(row.value, 500), href = clean(row.href, 1000);
      if (!label || !value) throw new Error('名称和展示内容不能为空。');
      if (href && !/^(https:\/\/|mailto:|tel:)/i.test(href)) throw new Error('链接仅支持 HTTPS、mailto 或 tel。');
      const payload = { channel_type: channel, label, value, href: href || null, display_order: Number(row.display_order) || 0, status: row.status, created_by: user.id };
      let query = row.id ? db.from('contact_channels').update(payload).eq('id', row.id) : db.from('contact_channels').insert(payload);
      const { data, error } = await query.select('*').single();
      if (error) throw error;
      return data;
    },
    async deleteContact(id) {
      const { client: db } = await requireAdmin();
      const { error } = await db.from('contact_channels').delete().eq('id', id);
      if (error) throw error;
    },
    async listEntries(entryType = '') {
      const { client: db } = await requireAdmin();
      let query = db.from('ip_entries').select('id,entry_type,title,slug,summary,body_text,locale,cover_path,status,sort_order,published_at,updated_at').order('sort_order', { ascending: true }).order('updated_at', { ascending: false });
      if (entryType) {
        if (!types.has(entryType)) throw new Error('条目类型无效。');
        query = query.eq('entry_type', entryType);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    async getPublishedEntries(entryType) {
      if (!types.has(entryType)) throw new Error('条目类型无效。');
      const { data, error } = await client().from('ip_entries')
        .select('id,entry_type,title,slug,summary,body_text,locale,cover_path,status,sort_order,published_at')
        .eq('entry_type', entryType).eq('status', 'published')
        .order('sort_order', { ascending: true }).order('published_at', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data || [];
    },
    async getPublishedEntry(slug) {
      const safeSlug = clean(slug, 180);
      const { data, error } = await client().from('ip_entries')
        .select('id,entry_type,title,slug,summary,body_text,locale,cover_path,status,sort_order,published_at')
        .eq('slug', safeSlug).eq('status', 'published').maybeSingle();
      if (error) throw error;
      return data || null;
    },
    async saveEntry(entry) {
      const { client: db, user } = await requireAdmin();
      const row = {
        entry_type: clean(entry.entry_type, 20),
        title: clean(entry.title, 200),
        slug: clean(entry.slug, 180),
        summary: clean(entry.summary, 3000) || null,
        body_text: clean(entry.body_text, 50000),
        locale: clean(entry.locale, 5),
        cover_path: clean(entry.cover_path, 1000) || null,
        status: clean(entry.status, 20),
        sort_order: Math.trunc(Number(entry.sort_order) || 0),
        published_at: entry.status === 'published' ? (entry.published_at || new Date().toISOString()) : null,
        created_by: user.id
      };
      validateEntry(row);
      const query = entry.id
        ? db.from('ip_entries').update(row).eq('id', entry.id)
        : db.from('ip_entries').insert(row);
      const { data, error } = await query.select('id,entry_type,title,slug,summary,body_text,locale,cover_path,status,sort_order,published_at,updated_at').single();
      if (error) throw error;
      return data;
    },
    async deleteEntry(id) {
      const { client: db } = await requireAdmin();
      const { error } = await db.from('ip_entries').delete().eq('id', id);
      if (error) throw error;
    },
    validateEntry
  };
})();
