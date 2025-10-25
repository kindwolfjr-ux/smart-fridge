import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });
import { defineConfig, env } from "prisma/config";


export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
