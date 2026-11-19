// Fictional fixtures. Their field names match the existing backend responses.
export const demoCredentials = { email: 'examiner@example.test', password: 'demo1234' };

export const demoUser = {
  id: 2,
  email: demoCredentials.email,
  fullName: 'Demo Examiner',
  role: 'examiner',
};

export const demoCases = [
  {
    id: 1,
    caseNumber: 'DEMO-001',
    title: 'Sample social account review',
    description: 'A fictional case for reviewing a sample social media account. No real people or evidence are involved.',
    createdBy: 1,
    status: 'open',
    createdAt: '2026-11-16T09:00:00Z',
  },
  {
    id: 2,
    caseNumber: 'DEMO-002',
    title: 'Training screenshot collection',
    description: 'A training case for practising screenshot collection and documentation with fictional records.',
    createdBy: 1,
    status: 'open',
    createdAt: '2026-11-17T10:30:00Z',
  },
  {
    id: 3,
    caseNumber: 'DEMO-003',
    title: 'Completed documentation exercise',
    description: 'A completed fictional exercise used to demonstrate how a closed case appears.',
    createdBy: 1,
    status: 'closed',
    createdAt: '2026-11-18T08:00:00Z',
  },
];

export const demoSuspects = [
  { id: 11, fullName: 'Fictional Person One', alias: 'Training alias' },
  { id: 12, fullName: 'Fictional Person Two', alias: null },
];

export const demoCaseSuspects = [
  { id: 1, caseId: 1, suspectId: 11, involvement: 'suspect', suspect: demoSuspects[0] },
  { id: 2, caseId: 2, suspectId: 12, involvement: 'suspect', suspect: demoSuspects[1] },
];

export const demoPlatforms = [
  { id: 1, name: 'facebook', active: true },
  { id: 2, name: 'instagram', active: true },
];

export const demoAccounts = [
  { id: 21, suspectId: 11, platformId: 2, handle: 'fictional_training_account', profileUrl: 'https://example.test/training-account' },
];

export const demoPanchnamas = [
  { id: 31, caseId: 1, examinerId: 2, panchnamaNo: 'DEMO-P-001', authorityRef: 'Fictional training authority', location: 'Training room', heldAt: '2026-11-19T04:30:00Z' },
];

export const demoWitnesses = [
  { id: 41, panchnamaId: 31, fullName: 'Fictional Training Witness' },
];
