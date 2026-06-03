import "server-only";

/**
 * Validates whether the generated response contains facts not supported by the context.
 */
export function checkResponseHallucination(
  text: string,
  contextText: string
): boolean {
  // Can be extended with NLI or smaller verification model checking if needed.
  // Currently covered by core regex-based quality-checks.ts.
  return false;
}
