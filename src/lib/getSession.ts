import { auth } from "./auth";
import type { NextApiRequest, NextApiResponse } from "next";
import type { Session } from "next-auth";

/**
 * Lê a sessão do next-auth v5 dentro de um API route do Pages Router.
 * O `auth()` do v5 aceita um objeto com formato GetServerSidePropsContext,
 * que é estruturalmente compatível com o par (req, res) das API routes.
 */
export async function getSession(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<Session | null> {
  return (auth as any)({ req, res, query: req.query, resolvedUrl: req.url ?? "/" });
}
