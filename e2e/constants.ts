/**
 * Shared constants for E2E tests.
 *
 * These IDs and credentials are used by both the seed script
 * and the test files to reference known test data.
 */

export const E2E_ADMIN = {
  id: "10000000-e2e0-4000-a000-000000000001",
  username: "e2e_admin",
  email: "admin@e2e.test",
  password: "TestPassword123!",
  displayName: "E2E Admin",
};

export const E2E_MEMBER = {
  id: "10000000-e2e0-4000-a000-000000000002",
  username: "e2e_member",
  email: "member@e2e.test",
  password: "TestPassword123!",
  displayName: "E2E Member",
};

export const E2E_SIGNUP = {
  username: "e2e_newuser",
  email: "newuser@e2e.test",
  password: "NewUserPass123!",
  displayName: "E2E New User",
};

export const E2E_INVITE_CODE = {
  id: "10000000-e2e0-4000-a000-000000000003",
  code: "E2ETESTCODE12",
};

export const SHAWSHANK_TMDB_ID = 278;
