// backend/routes/auth.js
const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

router.post('/login', (req, res) => {
  const { token } = req.body;
  if (token === process.env.AUTH_TOKEN) {
    const jwtToken = jwt.sign({ user: 'authorized' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    return res.json({ token: jwtToken });
  }
  res.status(401).send('Unauthorized');
});

module.exports = router;
