const { z } = require('zod');
const recordId = require('./record-id');
const { withAuditActor } = require('../services/audit');

const id = z.number().int().min(1).max(2147483647);

function caseScope(user) {
  return user.role === 'admin' ? {} : { assignments: { some: { userId: user.id } } };
}

function suspectScope(user) {
  return user.role === 'admin' ? {} : { caseSuspects: { some: { case: caseScope(user) } } };
}

function readInput(req, res, params, schema) {
  const values = {};
  for (const key of params) {
    const result = recordId.safeParse(req.params[key]);
    if (!result.success) {
      res.status(400).json({ message: 'Invalid ' + key + '.' });
      return;
    }
    values[key] = result.data;
  }
  if (schema) {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ message: 'Invalid request body.', issues: result.error.issues.map(({ path, message }) => ({ path, message })) });
      return;
    }
    values.data = result.data;
  }
  return values;
}

async function writeRecord(res, status, key, userId, query) {
  try {
    return res.status(status).json({ [key]: await withAuditActor(userId, query) });
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ message: 'A record with those values already exists.' });
    if (error.code === 'P2025' || error.code === 'P2003') {
      return res.status(404).json({ message: 'The record or a required related record was not found.' });
    }
    throw error;
  }
}

module.exports = { caseScope, suspectScope, id, readInput, writeRecord };
