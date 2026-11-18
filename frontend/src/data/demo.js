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
