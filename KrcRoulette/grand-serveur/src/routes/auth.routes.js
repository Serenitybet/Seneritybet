const express = require('express');
const authService = require('../services/auth.service');
const { requireAuth } = require('../middlewares/auth');
const prisma = require('../config/prisma');

const router = express.Router();

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'username et password requis' });
    }

    const result = await authService.login(username, password);
    if (!result) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.auth.userId } });
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    const { passwordHash, ...safeUser } = user;
    res.json(safeUser);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
