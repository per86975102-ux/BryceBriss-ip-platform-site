(() => {
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const legacy = {
    'memory-road':['作品 · 示例','《回忆路》','关于记忆、守护与救赎的未来寓言。','这里是结构示例；请通过后台录入正式作品资料。'],
    'free-life-paradox':['作品 · 示例','《自由人生·自由悖论Ⅰ》','围绕自由、现实与个人选择展开的思考。','这里是结构示例；请通过后台录入正式作品资料。'],
    'the-star':['作品 · 示例','《星》','以人性、处境与社会观察为线索的讽刺小说。','这里是结构示例；请通过后台录入正式作品资料。'],
    'mountain-sea':['作品 · 示例','《山与海的交汇》','山林、海洋与命运交汇的原创故事企划。','这里是结构示例；请通过后台录入正式作品资料。'],
    'memoirs-ep':['作品 · 示例','《回忆录》概念 EP','以旋律延伸故事情绪的音乐企划。','这里是结构示例；请通过后台录入正式作品资料。'],
    'apocalypse-project':['作品 · 示例','《默示录》音乐企划','以寓言和人性主题为核心的歌曲概念。','这里是结构示例；请通过后台录入正式作品资料。'],
    'guardian-sample':['角色档案 · 示例','守护者 · 示例角色','人物核心：守护、承诺与恒常。','此内容是静态样例，不代表已保存的真实数据库资料。'],
    'tree-of-harmony':['世界观档案 · 示例','谐律之树 · 示例设定','意识、自然与秩序的交汇点。','此内容是静态样例，不代表已保存的真实数据库资料。'],
    'magic-system':['世界观档案 · 示例','魔法体系 · 示例条目','整理能力来源、分类、限制与规则。','此内容是静态样例，不代表已保存的真实数据库资料。']
  };
  function setText(id, value) { const el = $(id); if (el) el.textContent = value || ''; }
  function addBody(text) {
    const host = $('entryBody'); host.replaceChildren();
    String(text || '').split(/\n{2,}/).map(part => part.trim()).filter(Boolean).forEach((part) => { const p=document.createElement('p'); p.textContent=part; host.append(p); });
  }
  function setCover(path, alt) {
    const url = window.BrycePlatform?.publicMediaUrl(path);
    const old = $('entryCover');
    if (old) old.remove();
    if (!url) return;
    const image = document.createElement('img'); image.id='entryCover'; image.className='img-fluid rounded mb-4'; image.src=url; image.alt=alt || ''; image.loading='lazy';
    $('entryBody').before(image);
  }
  function notFound(message) {
    setText('entryTitle','未找到该条目或内容尚未公开'); setText('entrySummary',message); $('entryBody').replaceChildren();
    setText('entryNote','仅公开已发布内容可通过访客页面读取。');
  }
  async function loadLive() {
    const slug = params.get('slug');
    const type = params.get('type');
    const idOrSlug = params.get('id');
    if (slug) {
      const entry = await window.BryceContent.getPublishedEntry(slug);
      if (!entry) return notFound('请返回目录，选择一条已发布内容。');
      setText('entryType', `${entry.entry_type.toUpperCase()} · ${entry.locale.toUpperCase()}`);
      setText('entryTitle', entry.title); setText('entrySummary', entry.summary); addBody(entry.body_text);
      setText('entryNote','此内容由 Supabase 已发布记录加载。');
      const back = entry.entry_type === 'character' || entry.entry_type === 'world' ? 'characters.html' : entry.entry_type === 'gallery' ? 'gallery.html' : 'blog.html';
      $('backLink').href=back; setText('backLink','← 返回目录'); setCover(entry.cover_path, entry.title); document.title=`${entry.title} · P.E.R`; return;
    }
    if (type === 'work' && idOrSlug) {
      const { data, error } = await window.BrycePlatform.client.from('works').select('id,title,slug,summary,cover_path,status').eq('slug',idOrSlug).eq('status','published').maybeSingle();
      if (error) throw error;
      if (!data) return notFound('该作品不存在或尚未发布。');
      setText('entryType','WORK · PUBLISHED'); setText('entryTitle',data.title); setText('entrySummary',data.summary);
      addBody(data.summary || '该作品暂无详情文案。'); setText('entryNote','此作品资料由 Supabase 已发布记录加载。');
      const read=document.createElement('a'); read.className='btn btn-silver mt-3'; read.href=`read.html?work=${encodeURIComponent(data.id)}`; read.textContent='阅读公开章节'; $('entryBody').append(read);
      $('backLink').href='works.html'; setText('backLink','← 返回作品宇宙'); setCover(data.cover_path,data.title); document.title=`${data.title} · P.E.R`; return;
    }
    notFound('详情链接缺少slug。');
  }
  document.addEventListener('DOMContentLoaded', async () => {
    if (window.BrycePlatform?.configured) {
      try { await loadLive(); } catch (_) { notFound('后端读取失败；为避免将示例内容伪装成在线内容，详情页已隐藏静态样例。'); }
      return;
    }
    const key=params.get('id'); const sample=legacy[key];
    if (!sample) return notFound('Supabase 未配置；此示例详情仅在原有静态链接中可查看。');
    setText('entryType',sample[0]); setText('entryTitle',sample[1]); setText('entrySummary',sample[2]); addBody(sample[3]);
    setText('entryNote','Supabase 未配置：当前是内置示例内容，不会保存或代表线上数据。');
    $('backLink').href=params.get('type')==='archive'?'characters.html':'works.html';
    setText('backLink',params.get('type')==='archive'?'← 返回角色与世界观':'← 返回作品宇宙');
  });
})();
