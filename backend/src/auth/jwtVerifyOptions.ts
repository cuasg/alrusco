import type { VerifyOptions } from "jsonwebtoken";

/** HS256 only — reject alg confusion / "none" style tokens. */
export const jwtVerifyOptions: VerifyOptions = {
  algorithms: ["HS256"],
};
