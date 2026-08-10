export const CODES = {
  OK: 200,
  SUCCESS: 200, // Added alias for CODES.SUCCESS used in some controllers
  CREATED: 201,
  ACCEPTED: 202,
  NON_AUTHORITATIVE_INFO: 203,
  NO_CONTENT: 204,
  ALREADY_REPORTED: 208,
  TEMPORARY_REDIRECT: 307,
  PERMANENT_REDIRECT: 308,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  SERVICE_UNAVAILABLE: 503,
};

/*
=== MIGRATION EXPLANATION ===
What changed:
- Converted exports to ES Modules format (`export const`).
- Added `SUCCESS: 200` to prevent runtime undefined reference errors.

Why it changed:
- Compatibility with overall ES Modules migration.

MongoDB-specific considerations:
- None.
*/
