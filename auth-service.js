/* Shared Supabase Auth helpers. RLS remains the authoritative permission boundary. */
(() => {
  const platform = () => window.BrycePlatform;
  const needClient = () => {
    const p = platform();
    if (!p?.configured || !p.client) throw new Error(p?.statusMessage?.() || 'Supabase 尚未配置，认证不可用。');
    return p.client;
  };
  const callbackUrl = (file) => new URL(file, window.location.href).toString();
  const cleanEmail = (email) => String(email || '').trim().toLowerCase();

  window.BryceAuth = {
    async getSession() {
      const { data, error } = await needClient().auth.getSession();
      if (error) throw error;
      return data?.session || null;
    },
    async signIn(email, password) {
      const { data, error } = await needClient().auth.signInWithPassword({ email: cleanEmail(email), password: String(password || '') });
      if (error) throw error;
      return data;
    },
    async signUp(email, password, displayName = '') {
      const { data, error } = await needClient().auth.signUp({
        email: cleanEmail(email),
        password: String(password || ''),
        options: {
          data: { display_name: String(displayName || '').trim().slice(0, 80) },
          emailRedirectTo: callbackUrl('auth-callback.html')
        }
      });
      if (error) throw error;
      return data;
    },
    async signOut() {
      const { error } = await needClient().auth.signOut({ scope: 'local' });
      if (error) throw error;
    },
    async requestPasswordReset(email) {
      const { error } = await needClient().auth.resetPasswordForEmail(cleanEmail(email), {
        redirectTo: callbackUrl('auth-recovery.html')
      });
      if (error) throw error;
    },
    async updatePassword(password) {
      const { data, error } = await needClient().auth.updateUser({ password: String(password || '') });
      if (error) throw error;
      return data;
    },
    async requireAdmin() {
      const client = needClient();
      const session = await this.getSession();
      if (!session?.user) throw new Error('请先登录。');
      const { data, error } = await client.rpc('is_admin');
      if (error) throw new Error(`管理员权限验证失败：${error.message || '请检查数据库迁移与连接。'}`);
      if (data !== true) throw new Error('此操作仅限已授权管理员。');
      return { client, user: session.user };
    },
    onAuthStateChange(callback) {
      const client = needClient();
      return client.auth.onAuthStateChange(callback);
    },
    callbackUrl
  };
})();
