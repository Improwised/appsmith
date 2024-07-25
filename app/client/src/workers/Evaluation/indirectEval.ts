export default function indirectEval(script: string) {
  // Do not remove ts-ignore!
  // We want evaluation to be done only on global scope and shouldn’t have access to any local scope variable.
  // Ref. - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/eval#description */
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  return (1, eval)(script);
}
