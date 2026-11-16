import type { DeferredJsonBody } from '../pipes/parse-json-body.pipe';

export function writeChangeRequestInput(body: DeferredJsonBody): () => unknown {
  return () => body.unwrap();
}
