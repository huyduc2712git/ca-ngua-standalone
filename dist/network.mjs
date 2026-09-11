// Shared URL validation. No endpoint or session token is taken from an invite URL.
export function normalizeHostOrigin(value) {
  if (typeof value !== 'string') throw new Error('Địa chỉ host phải là chuỗi.');
  const input = value.trim();
  if (!input) return '';
  let url;
  try { url = new URL(input); } catch { throw new Error('Địa chỉ host không hợp lệ.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash || url.hostname.includes('*')) {
    throw new Error('Chỉ nhập origin HTTP/HTTPS của host, không kèm đường dẫn, tài khoản hoặc tham số.');
  }
  return url.origin;
}

export function createNetworkConfig(value = '', pageOrigin = '') {
  const origin = normalizeHostOrigin(value);
  if (origin.startsWith('http:') && pageOrigin.startsWith('https:')) {
    throw new Error('Game HTTPS cần kết nối tới host HTTPS.');
  }
  const suffix = origin ? ':' + encodeURIComponent(origin) : '';
  return {
    origin,
    timeout: origin ? 90_000 : 10_000,
    sessionKey: 'horse-session' + suffix,
    resumeKey: 'horse-resume-session' + suffix,
    endpoint(path) {
      if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) {
        throw new Error('Đường dẫn API không hợp lệ.');
      }
      return origin + '/api' + path;
    },
  };
}
