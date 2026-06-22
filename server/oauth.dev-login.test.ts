import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({
  upsertUser: vi.fn(),
}));

vi.mock("./_core/sdk", () => ({
  sdk: {
    createSessionToken: vi.fn(),
    exchangeCodeForToken: vi.fn(),
    getUserInfo: vi.fn(),
  },
}));

import { COOKIE_NAME } from "../shared/const";
import * as db from "./db";
import { registerOAuthRoutes } from "./_core/oauth";
import { sdk } from "./_core/sdk";

type Route = {
  path: string;
  handler: (req: any, res: any) => Promise<void> | void;
};

const originalNodeEnv = process.env.NODE_ENV;

function createFakeApp() {
  const routes: Route[] = [];
  return {
    routes,
    app: {
      get: (path: string, handler: Route["handler"]) => {
        routes.push({ path, handler });
      },
    },
  };
}

function createFakeResponse() {
  return {
    statusCode: 200,
    jsonBody: undefined as unknown,
    cookies: [] as Array<{ name: string; value: string }>,
    redirectTo: undefined as string | undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.jsonBody = body;
      return this;
    },
    cookie(name: string, value: string) {
      this.cookies.push({ name, value });
      return this;
    },
    redirect(_code: number, location: string) {
      this.redirectTo = location;
      return this;
    },
  };
}

describe("development login route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(sdk.createSessionToken).mockResolvedValue("session-token");
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("creates a local user session in production for demos", async () => {
    process.env.NODE_ENV = "production";
    const { app, routes } = createFakeApp();
    registerOAuthRoutes(app as any);
    const res = createFakeResponse();

    await routes.find(route => route.path === "/api/dev-login")!.handler(
      { query: {}, protocol: "https", headers: {} },
      res
    );

    expect(db.upsertUser).toHaveBeenCalledWith(
      expect.objectContaining({
        openId: "local-dev-user",
        role: "user",
        loginMethod: "dev",
      })
    );
    expect(res.cookies[0]).toMatchObject({
      name: COOKIE_NAME,
      value: "session-token",
    });
    expect(res.redirectTo).toBe("/");
  });

  it("creates a local admin session in development", async () => {
    process.env.NODE_ENV = "development";
    const { app, routes } = createFakeApp();
    registerOAuthRoutes(app as any);
    const res = createFakeResponse();

    await routes.find(route => route.path === "/api/dev-login")!.handler(
      { query: { role: "admin" }, protocol: "http", headers: {} },
      res
    );

    expect(db.upsertUser).toHaveBeenCalledWith(
      expect.objectContaining({
        openId: "local-dev-admin",
        role: "admin",
        loginMethod: "dev",
      })
    );
    expect(res.cookies[0]).toMatchObject({
      name: COOKIE_NAME,
      value: "session-token",
    });
    expect(res.redirectTo).toBe("/");
  });
});
