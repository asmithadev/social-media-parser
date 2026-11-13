function login(req, res) {
  return res.status(501).json({ message: 'Login handler reached' });
}

module.exports = { login };