const { collections } = require("../config/db");

// Cache the remote JWKS (BetterAuth exposes it at CLIENT_URL/api/auth/jwks).
let JWKS;
const getJWKS = async () => {
  if (!JWKS) {
    const { createRemoteJWKSet } = await import("jose");
    JWKS = createRemoteJWKSet(new URL(`${process.env.CLIENT_URL}/api/auth/jwks`));
  }
  return JWKS;
};

// Verifies the Bearer token and attaches req.user.
async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).send({ message: "Unauthorized: no token" });
  }
  const token = authHeader.split(" ")[1];
  if (!token) return res.status(401).send({ message: "Unauthorized: no token" });

  try {
    const { jwtVerify } = await import("jose");
    const { payload } = await jwtVerify(token, await getJWKS());
    req.user = {
      id: payload.id || payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role,
    };
    next();
  } catch (err) {
    console.error("JWT verify failed:", err.message);
    return res.status(401).send({ message: "Unauthorized: invalid token" });
  }
}

// Reads the *current* role from the DB (the token role can be stale after a change).
const requireRole = (...roles) => async (req, res, next) => {
  try {
    const { users } = collections();
    const dbUser = await users.findOne({ email: req.user.email });
    if (!dbUser || !roles.includes(dbUser.role)) {
      return res.status(403).send({ message: "Forbidden: insufficient role" });
    }
    req.dbUser = dbUser;
    next();
  } catch {
    return res.status(500).send({ message: "Role check failed" });
  }
};

// Allows access when the :email param is the requester, or they are an admin.
const sameUserOrAdmin = () => async (req, res, next) => {
  if (req.params.email === req.user.email) return next();
  const { users } = collections();
  const dbUser = await users.findOne({ email: req.user.email });
  if (dbUser?.role === "admin") return next();
  return res.status(403).send({ message: "Forbidden" });
};

module.exports = { verifyToken, requireRole, sameUserOrAdmin };