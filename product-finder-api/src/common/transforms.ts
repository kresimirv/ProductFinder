import { Transform } from 'class-transformer';

/**
 * Query parameters arrive as a string (`?region=EMEA`) or, when repeated,
 * as an array (`?region=EMEA&region=Global`). This normalises both to `string[]`.
 */
export const ToArray = () =>
  Transform(({ value }: { value: unknown }) =>
    value === undefined || Array.isArray(value) ? value : [value],
  );

/**
 * Trims strings and turns blank input into `undefined`. Whitespace-only text then
 * fails `@IsNotEmpty()` on required fields and is dropped on optional ones.
 */
export const Trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  );
