import {
  demoCases, demoCredentials, demoUser,
  demoSuspects, demoCaseSuspects, demoPlatforms, demoAccounts,
  demoPanchnamas, demoWitnesses,
  demoSessions, demoSessionSections,
} from './data/demo';

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

// Admin tools use the real backend. The demo account is an examiner.
function adminRequest(endpoint, token, options = {}) {
  if (isDemoMode) throw new Error('Admin tools need a real administrator account.');
  return request(endpoint, token, options);
}

export async function createCase(token, fields) {
  const data = await adminRequest('/cases', token, { method: 'POST', body: JSON.stringify(fields) });
  return data.case;
}

export async function getUsers(token) {
  const { users } = await adminRequest('/users', token);
  return users;
}

export async function createUser(token, fields) {
  const { user } = await adminRequest('/users', token, { method: 'POST', body: JSON.stringify(fields) });
  return user;
}

export async function getAssignments(token, caseId) {
  const { assignments } = await adminRequest(`/cases/${caseId}/assignments`, token);
  return assignments;
}

export async function assignUser(token, caseId, fields) {
  const { assignment } = await adminRequest(`/cases/${caseId}/assignments`, token, {
    method: 'POST', body: JSON.stringify(fields),
  });
  return assignment;
}

export async function getCaseSuspects(token, caseId) {
  if (isDemoMode) return demoCaseSuspects.filter(link => link.caseId === Number(caseId));
  const { suspects } = await request(`/cases/${caseId}/suspects`, token);
  return suspects;
}

export async function getSuspects(token) {
  if (isDemoMode) return demoSuspects;
  const { suspects } = await request('/suspects', token);
  return suspects;
}

export async function createSuspect(token, fields) {
  const { suspect } = await adminRequest('/suspects', token, { method: 'POST', body: JSON.stringify(fields) });
  return suspect;
}

export async function linkSuspect(token, caseId, fields) {
  const { caseSuspect } = await adminRequest(`/cases/${caseId}/suspects`, token, {
    method: 'POST', body: JSON.stringify(fields),
  });
  return caseSuspect;
}

export async function getPlatforms(token) {
  if (isDemoMode) return demoPlatforms;
  const { platforms } = await request('/platforms', token);
  return platforms;
}

export async function getAccounts(token, suspectId) {
  if (isDemoMode) return demoAccounts.filter(account => account.suspectId === Number(suspectId));
  const { accounts } = await request(`/suspects/${suspectId}/accounts`, token);
  return accounts;
}

export async function createAccount(token, suspectId, fields) {
  const { account } = await adminRequest(`/suspects/${suspectId}/accounts`, token, {
    method: 'POST', body: JSON.stringify(fields),
  });
  return account;
}

export async function getPanchnamas(token, caseId) {
  if (isDemoMode) return demoPanchnamas.filter(record => record.caseId === Number(caseId));
  const { panchnamas } = await request(`/cases/${caseId}/panchnamas`, token);
  return panchnamas;
}

export async function createPanchnama(token, caseId, fields) {
  if (isDemoMode) throw new Error('Sign in with a real examiner account to create a panchnama.');
  const { panchnama } = await request(`/cases/${caseId}/panchnamas`, token, {
    method: 'POST', body: JSON.stringify(fields),
  });
  return panchnama;
}

export async function getWitnesses(token, panchnamaId) {
  if (isDemoMode) return demoWitnesses.filter(witness => witness.panchnamaId === Number(panchnamaId));
  const { witnesses } = await request(`/panchnamas/${panchnamaId}/witnesses`, token);
  return witnesses;
}

export async function addWitness(token, panchnamaId, fields) {
  if (isDemoMode) throw new Error('Sign in with the panchnama examiner account to add witnesses.');
  const { witness } = await request(`/panchnamas/${panchnamaId}/witnesses`, token, {
    method: 'POST', body: JSON.stringify(fields),
  });
  return witness;
}

// Collect accounts belonging to suspects linked to this case for the dropdown.
export async function getCaseAccounts(token, caseId) {
  const [links, platforms] = await Promise.all([getCaseSuspects(token, caseId), getPlatforms(token)]);
  const groups = await Promise.all(links.map(async link => {
    const accounts = await getAccounts(token, link.suspectId);
    return accounts.map(account => ({ ...account, suspectName: link.suspect.fullName,
      platformName: platforms.find(platform => platform.id === account.platformId)?.name || `Platform #${account.platformId}` }));
  }));
  return groups.flat();
}

export async function getSessions(token, panchnamaId) {
  if (isDemoMode) return demoSessions.filter(session => session.panchnamaId === Number(panchnamaId));
  const { sessions } = await request(`/panchnamas/${panchnamaId}/sessions`, token);
  return sessions;
}

export async function getSession(token, sessionId) {
  if (isDemoMode) {
    const session = demoSessions.find(session => session.id === Number(sessionId));
    if (!session) throw new Error('Session not found.');
    return session;
  }
  const { session } = await request(`/sessions/${sessionId}`, token);
  return session;
}

export async function getSessionSections(token, sessionId) {
  if (isDemoMode) return demoSessionSections.filter(section => section.sessionId === Number(sessionId));
  const { sections } = await request(`/sessions/${sessionId}/sections`, token);
  return sections;
}

function sessionWrite(endpoint, token, method, fields) {
  if (isDemoMode) throw new Error('Demo capture sessions are read-only.');
  return request(endpoint, token, { method, body: JSON.stringify(fields) });
}

export async function startSession(token, panchnamaId, fields) {
  const { session } = await sessionWrite(`/panchnamas/${panchnamaId}/sessions`, token, 'POST', fields);
  return session;
}

export async function saveSectionOutcome(token, sessionId, sectionId, fields) {
  const { outcome } = await sessionWrite(`/sessions/${sessionId}/sections/${sectionId}`, token, 'PATCH', fields);
  return outcome;
}

export async function finishSession(token, sessionId, status) {
  const { session } = await sessionWrite(`/sessions/${sessionId}`, token, 'PATCH', { status });
  return session;
}
