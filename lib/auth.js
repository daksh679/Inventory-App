import { mkdirSync } from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";

const dataDirectory = process.env.LOCALAPPDATA
  ? path.join(process.env.LOCALAPPDATA, "ClosetDaily")
  : path.join(process.cwd(), ".data");

mkdirSync(dataDirectory, { recursive: true });

const database = new Database(path.join(dataDirectory, "auth.db"));

export const auth = betterAuth({
  database,
  emailAndPassword: {
    enabled: true,
  },
  plugins: [nextCookies()],
});
