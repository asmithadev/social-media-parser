import { demoCases, demoCredentials, demoUser } from './data/demo';

export const isDemoMode = import.meta.env.VITE_USE_DEMO_DATA !== 'false';
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

// All real HTTP requests go through this small helper.
async function request(endpoint, token, options = {}) {
  let response;
  try {
    response = await fetch(apiBaseUrl + endpoint, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch {
    throw new Error('Could not reach the server. Check that the backend is running.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || 'The request failed. Please try again.');
  if (!data) throw new Error('The server returned an unexpected response.');
  return data;
}

export async function signIn(email, password) {
  if (isDemoMode) {
    if (email !== demoCredentials.email || password !== demoCredentials.password) {
      throw new Error('The demo email or password is incorrect. Use the details shown below.');
    }
    return { token: 'demo-session', user: demoUser };
  }
  const { accessToken } = await request('/auth/login', null, {
    method: 'POST', body: JSON.stringify({ email, password }),
  });
  const { user } = await request('/auth/me', accessToken);
  return { token: accessToken, user };
}

export async function getCases(token) {
  if (isDemoMode) return demoCases;
  const { cases } = await request('/cases', token);
  return cases;
}

export async function getCase(caseId, token) {
  if (isDemoMode) {
    const record = demoCases.find(item => item.id === caseId);
    if (!record) throw new Error('Case not found.');
    return record;
  }
  const data = await request(`/cases/${caseId}`, token);
  return data.case;
}
