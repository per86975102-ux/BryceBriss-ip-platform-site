(() => {
  document.addEventListener('DOMContentLoaded', async () => {
    const state = document.getElementById('callbackState');
    const detail = document.getElementById('callbackDetail');
    if (!window.BrycePlatform?.configured) {
      state.textContent = 'Supabase 尚未配置，无法处理邮箱验证回调。';
      return;
    }
    try {
      const session = await window.BryceAuth.getSession();
      if (session?.user) {
        state.textContent = 'Supabase 已建立认证会话。';
        detail.textContent = '请按项目的邮箱确认设置验证账户状态。该页面不更改用户角色或权限。';
      } else {
        state.textContent = '未恢复有效会话；回调链接可能过期、未被允许或邮箱确认尚未完成。';
        detail.textContent = '请重新发起注册/验证，并核对 Supabase Auth Redirect URLs、Site URL 与邮件设置。';
      }
    } catch (_) {
      state.textContent = '暂时无法确认回调状态。';
      detail.textContent = '请检查网络、客户端配置和 Supabase Auth 日志后重试。';
    }
  });
})();
