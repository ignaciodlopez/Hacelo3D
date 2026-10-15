// Router por hash: #/  #/tool/<id>[?p=...]  #/credits

export function parseHash(hash = location.hash) {
  const raw = hash.replace(/^#/, '') || '/';
  const [path, query = ''] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  const params = new URLSearchParams(query);
  if (parts[0] === 'tool' && parts[1]) return { name: 'tool', id: parts[1], params };
  if (parts[0] === 'credits') return { name: 'credits', params };
  return { name: 'home', params };
}

export function navigate(path) {
  location.hash = path;
}

/** @param {(route: ReturnType<typeof parseHash>) => void} onRoute */
export function startRouter(onRoute) {
  const handler = () => onRoute(parseHash());
  window.addEventListener('hashchange', handler);
  handler();
  return () => window.removeEventListener('hashchange', handler);
}
