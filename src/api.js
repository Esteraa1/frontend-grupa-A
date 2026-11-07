const base = import.meta.env.VITE_API_URL || '/api';

export async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(`${base}${path}`, {
      credentials: 'include', ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Brak połączenia z serwerem. Spróbuj ponownie.', { cause: error });
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || data === null) throw Object.assign(new Error(data?.message || 'Usługa jest chwilowo niedostępna. Spróbuj ponownie.'), { status: response.status });
  return data;
}

export function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
