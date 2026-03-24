import type { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { jwtVerifyOptions } from "./jwtVerifyOptions";

const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-prod";
const COOKIE_NAME = "alrusco_session";

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ error: "unauthorized" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET, jwtVerifyOptions) as JwtPayload;
    const payload = decoded as JwtPayload & {
      sub: number;
      username: string;
      stage?: string;
    };

    if (payload.stage !== "session") {
      return res.status(401).json({ error: "unauthorized" });
    }

    (req as any).user = {
      id: payload.sub,
      username: payload.username,
    };

    next();
  } catch {
    return res.status(401).json({ error: "unauthorized" });
  }
}

