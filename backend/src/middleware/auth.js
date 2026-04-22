import jwt from 'jsonwebtoken';
import { store } from '../db/store.js';

export async function authRequired(req, res, next) {
  try {
    if (process.env.SKIP_AUTH === 'true' || process.env.SKIP_AUTH === '1') {
      const user = store.users.ensureDevUser();
      req.user = { id: user.id, email: user.email, role: user.role };
      return next();
    }

    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid token' });
    }
    const token = header.slice(7);
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      req.user = payload;
      return next();
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }
  } catch (err) {
    return next(err);
  }
}
