// Client-side cookie utilities.
// These functions manage cookies in the browser only.
// Server actions handle cookie updates on the server side.

export function setClientCookie(key: string, value: string, days = 7) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  // biome-ignore lint/suspicious/noDocumentCookie: la Cookie Store API es asíncrona y obligaría a cambiar a quien la llama
  document.cookie = `${key}=${value}; expires=${expires}; path=/`;
}
