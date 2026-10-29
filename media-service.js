/* Supabase Storage media helpers. Public visibility is an explicit author choice. */
(() => {
  const MAX_BYTES = 10 * 1024 * 1024;
  const MIME_EXT = new Map([['image/jpeg','jpg'],['image/png','png'],['image/webp','webp'],['image/avif','avif']]);
  const FOLDERS = new Set(['works','chapters','brand','characters','worlds','gallery','journal']);
  const bucketFor = (visibility) => {
    const buckets = window.BRYCE_MEDIA_BUCKETS || {};
    const bucket = visibility === 'public' ? buckets.public : buckets.private;
    if (!bucket) throw new Error('Storage bucket 配置缺失。');
    return bucket;
  };
  const db = () => {
    const p = window.BrycePlatform;
    if (!p?.configured || !p.client) throw new Error(p?.statusMessage?.() || 'Supabase 未配置。');
    return p.client;
  };
  const safePath = (path) => typeof path === 'string' && /^[A-Za-z0-9._/-]+$/.test(path) && !path.startsWith('/') && !path.split('/').includes('..');

  async function requireAdmin() {
    if (window.BryceAuth?.requireAdmin) return window.BryceAuth.requireAdmin();
    const client = db();
    const { data: s, error: se } = await client.auth.getSession();
    if (se) throw se;
    if (!s?.session?.user) throw new Error('请先登录。');
    const { data, error } = await client.rpc('is_admin');
    if (error) throw error;
    if (data !== true) throw new Error('此操作仅限已授权管理员。');
    return { client, user: s.session.user };
  }

  function parsePath(value) {
    const raw = String(value || '').trim();
    if (/^https:\/\//i.test(raw)) return { kind: 'https', url: raw };
    const match = /^(public|private):(.+)$/.exec(raw);
    if (!match || !safePath(match[2])) return null;
    return { kind: match[1], path: match[2], bucket: bucketFor(match[1]) };
  }

  window.BryceMedia = {
    maxBytes: MAX_BYTES,
    allowedTypes: [...MIME_EXT.keys()],
    async validateFile(file) {
      if (!file) throw new Error('请先选择图片文件。');
      if (!MIME_EXT.has(file.type)) throw new Error('仅支持 JPEG、PNG、WebP 或 AVIF 图片。');
      if (file.size <= 0 || file.size > MAX_BYTES) throw new Error('图片必须大于 0 且不超过 10 MiB。');
      const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
      const ascii = (start, end) => String.fromCharCode(...bytes.slice(start, end));
      const signatures = {
        'image/jpeg': bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
        'image/png': bytes.length >= 8 && bytes[0] === 0x89 && ascii(1,4) === 'PNG' && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a,
        'image/webp': bytes.length >= 12 && ascii(0,4) === 'RIFF' && ascii(8,12) === 'WEBP',
        'image/avif': bytes.length >= 12 && ascii(4,8) === 'ftyp' && ['avif','avis'].includes(ascii(8,12))
      };
      if (!signatures[file.type]) throw new Error('图片实际文件格式与声明的MIME类型不匹配。');
      return true;
    },
    parsePath,
    async resolvePublicUrl(value) {
      const parsed = parsePath(value);
      if (!parsed) return '';
      if (parsed.kind === 'https') return parsed.url;
      if (parsed.kind !== 'public') return '';
      const { data } = db().storage.from(parsed.bucket).getPublicUrl(parsed.path);
      return data?.publicUrl || '';
    },
    async resolveAdminPreview(value) {
      const parsed = parsePath(value);
      if (!parsed) return '';
      if (parsed.kind === 'https' || parsed.kind === 'public') return this.resolvePublicUrl(value);
      const { data, error } = await db().storage.from(parsed.bucket).createSignedUrl(parsed.path, 900);
      if (error) throw error;
      return data?.signedUrl || '';
    },
    async upload(file, { folder = 'works', visibility = 'private', altText = '' } = {}) {
      await this.validateFile(file);
      if (!FOLDERS.has(folder)) throw new Error('上传目录不在允许列表中。');
      if (!['private','public'].includes(visibility)) throw new Error('媒体可见性无效。');
      const { client, user } = await requireAdmin();
      const bucket = bucketFor(visibility);
      const ext = MIME_EXT.get(file.type);
      const id = crypto.randomUUID();
      const path = `${folder}/${id}.${ext}`;
      const { data: uploaded, error: uploadError } = await client.storage.from(bucket).upload(path, file, {
        cacheControl: '3600', upsert: false, contentType: file.type
      });
      if (uploadError) throw uploadError;
      const objectPath = uploaded?.path || path;
      const meta = {
        bucket_id: bucket,
        object_path: objectPath,
        mime_type: file.type,
        byte_size: file.size,
        alt_text: String(altText || '').trim().slice(0, 300) || null,
        visibility,
        created_by: user.id
      };
      const { data: asset, error: metadataError } = await client.from('media_assets').insert(meta).select('id,bucket_id,object_path,mime_type,byte_size,alt_text,visibility,created_at').single();
      if (metadataError) {
        const { error: cleanupError } = await client.storage.from(bucket).remove([objectPath]);
        const note = cleanupError ? ` 上传已发生但元数据保存失败；对象 ${objectPath} 清理也失败，请管理员检查。` : ' 未完成上传已自动清理。';
        throw new Error(`${metadataError.message || '媒体元数据保存失败。'}${note}`);
      }
      const tagged = `${visibility}:${objectPath}`;
      const publicUrl = visibility === 'public' ? (await this.resolvePublicUrl(tagged)) : '';
      return { asset, path: tagged, publicUrl, previewUrl: visibility === 'private' ? await this.resolveAdminPreview(tagged) : publicUrl };
    },
    async safeDelete(value) {
      const parsed = parsePath(value);
      if (!parsed || parsed.kind === 'https') throw new Error('仅可删除平台 Storage 对象。');
      const { client } = await requireAdmin();
      const { data: asset, error: assetError } = await client.from('media_assets').select('id').eq('bucket_id', parsed.bucket).eq('object_path', parsed.path).maybeSingle();
      if (assetError) throw assetError;
      if (!asset) throw new Error('找不到媒体元数据。为避免删除未知对象，操作已中止。');
      const [works, entries] = await Promise.all([
        client.from('works').select('id').eq('cover_path', `${parsed.kind}:${parsed.path}`).limit(1),
        client.from('ip_entries').select('id').eq('cover_path', `${parsed.kind}:${parsed.path}`).limit(1)
      ]);
      if (works.error) throw works.error;
      if (entries.error) throw entries.error;
      let offset = 0; let referencedByChapter = false;
      while (true) {
        const { data: chapters, error: chapterError } = await client.from('work_chapters').select('id,body').range(offset, offset + 499);
        if (chapterError) throw chapterError;
        referencedByChapter = (chapters || []).some((chapter) => {
          const body = JSON.stringify(chapter.body || {});
          return body.includes(parsed.path) || body.includes(`${parsed.bucket}/${parsed.path}`);
        });
        if (referencedByChapter || !chapters || chapters.length < 500) break;
        offset += 500;
      }
      if (works.data?.length || entries.data?.length || referencedByChapter) throw new Error('该图片仍被作品、IP条目或章节正文引用。请先解除所有关联；文件未删除。');
      const { error: removeError } = await client.storage.from(parsed.bucket).remove([parsed.path]);
      if (removeError) throw removeError;
      const { error: deleteError } = await client.from('media_assets').delete().eq('id', asset.id);
      if (deleteError) throw new Error(`对象已删除，但元数据清理失败：${deleteError.message || '未知错误'}`);
    }
  };
})();
