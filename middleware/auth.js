function isAuthenticated(req, res, next) {
  if (req.session && req.session.adminId) {
    return next();
  }
  return res.redirect('/stella-control');
}

function redirectIfAuthenticated(req, res, next) {
  if (req.session && req.session.adminId) {
    return res.redirect('/stella-control/dashboard');
  }
  return next();
}

module.exports = { isAuthenticated, redirectIfAuthenticated };
