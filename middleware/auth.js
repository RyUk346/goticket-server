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

module.exports = { verifyToken };