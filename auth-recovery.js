(() => {
  const $ = (id) => document.getElementById(id);
  document.addEventListener('DOMContentLoaded', async () => {
    const form = $('recoveryForm');
    if (!window.BrycePlatform?.configured) {
      $('recoveryState').textContent = 'Supabase 尚未配置，无法验证密码恢复链接。';
      return;
    }
    try {
      const session = await window.BryceAuth.getSession();
      if (!session?.user) {
        $('recoveryState').textContent = '恢复会话无效或已过期。请重新请求密码重置邮件。';
        return;
      }
      $('recoveryState').textContent = `已验证恢复会话：${session.user.email || '账户'}`;
      form.classList.remove('d-none');
    } catch (_) {
      $('recoveryState').textContent = '暂时无法检查恢复会话；请检查网络后重试。';
      return;
    }
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const password = $('newPassword').value;
      if (password.length < 8) { $('recoveryMessage').textContent = '密码至少需要 8 位。'; return; }
      if (password !== $('newPasswordConfirm').value) { $('recoveryMessage').textContent = '两次输入的密码不一致。'; return; }
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      $('recoveryMessage').textContent = '正在向 Supabase 保存新密码…';
      try {
        await window.BryceAuth.updatePassword(password);
        $('newPassword').value = '';
        $('newPasswordConfirm').value = '';
        $('recoveryMessage').textContent = '密码已由 Supabase 更新。请返回登录页面验证。';
        form.classList.add('d-none');
      } catch (error) {
        $('recoveryMessage').textContent = `密码更新失败：${error.message || '请重新请求恢复邮件。'}`;
        button.disabled = false;
      }
    });
  });
})();
