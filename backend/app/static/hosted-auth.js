(() => {
  const storageKey = 'imagineai-api-key';
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input, init = {}) => {
    const rawUrl = input instanceof Request ? input.url : String(input);
    const url = new URL(rawUrl, window.location.href);
    if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/v1/')) {
      return originalFetch(input, init);
    }

    let apiKey = sessionStorage.getItem(storageKey);
    if (!apiKey) {
      apiKey = window.prompt('Enter your Imagine AI hosted API key.');
      if (!apiKey || !apiKey.trim()) return originalFetch(input, init);
      apiKey = apiKey.trim();
      sessionStorage.setItem(storageKey, apiKey);
    }

    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init.headers || {}).forEach((value, name) => headers.set(name, value));
    headers.set('X-API-Key', apiKey);
    const request = input instanceof Request
      ? new Request(input.clone(), { ...init, headers })
      : input;
    const response = await originalFetch(request, { ...init, headers });
    if (response.status === 401) {
      sessionStorage.removeItem(storageKey);
      window.alert('That API key was rejected. Enter the correct key on your next request.');
    }
    return response;
  };
})();
