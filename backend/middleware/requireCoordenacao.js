function requireCoordenacao(req, res, next) {
  if (!req.user || req.user.role !== 'coordenacao') {
    return res.status(403).json({ ok: false, error: 'Apenas a coordenação pode acessar os cadastros.' });
  }
  next();
}

module.exports = { requireCoordenacao };
