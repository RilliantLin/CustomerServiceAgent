import * as db from "../db";

export type McpUserContext = {
  id: number;
  role: "user" | "admin";
};

const parseRole = (value: string | undefined): McpUserContext["role"] => {
  if (value === "admin") return "admin";
  return "user";
};

export async function getMcpUserContext(): Promise<McpUserContext> {
  const rawUserId = process.env.MCP_USER_ID;
  const userId = rawUserId ? Number(rawUserId) : NaN;

  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error(
      "MCP_USER_ID must be set to an existing numeric user id before starting the MCP server"
    );
  }

  const role = parseRole(process.env.MCP_ROLE);
  const user = await db.getUserById(userId);
  if (!user) {
    throw new Error(`MCP_USER_ID ${userId} does not match an existing user`);
  }

  if (role === "admin" && user.role !== "admin") {
    throw new Error(
      `MCP_ROLE=admin requires user ${userId} to have admin role in the database`
    );
  }

  return {
    id: user.id,
    role,
  };
}

