export const CLIENT_INSTANCE_ID_LENGTH = 36;

const CLIENT_INSTANCE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidClientInstanceId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length === CLIENT_INSTANCE_ID_LENGTH &&
    CLIENT_INSTANCE_ID_PATTERN.test(value)
  );
}
