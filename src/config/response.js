export const sendResponse = (statuscode, message, data, additionalArgs = {}) => {
  const response = {
    status: statuscode,
    message: message,
    response: data,
    ...additionalArgs,
  };

  return response;
};

/*
=== MIGRATION EXPLANATION ===
What changed:
- Converted exports to ES Modules format (`export const`).

Why it changed:
- Compatibility with overall ES Modules migration.

MongoDB-specific considerations:
- None.
*/
