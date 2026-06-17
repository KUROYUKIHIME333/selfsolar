import { auth } from "../lib/auth.js";

export async function isAuthenticated(req: any, reply: any) {
  const session = await auth.api.getSession({
    headers: req.headers, // On passe les headers pour récupérer le cookie
  });
  if (!session) {
    return reply.status(401).send({ message: "Non autorisé" });
  }
  // On attache l'utilisateur à la requête pour y accéder plus tard
  req.user = session.user;
}
