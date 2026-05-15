/**
 * `image_edit` — thin alias over `image_generate` that forces edit-mode.
 *
 * Callers that know they want edit-mode (e.g. listing slots with a confirmed
 * product reference) hit this entry point so the intent is explicit in the
 * IPC namespace. The actual dispatch shares the same code path as
 * `image_generate` — at least one of `image` / `images` must be present.
 *
 * Plan §4.3.
 */

import { imageGenerate, hasReferenceImage } from './image-generate.js'
import { providerError } from './error.js'

export async function imageEdit(input, ctx) {
  if (!hasReferenceImage(input)) {
    throw providerError('router', 'invalid-input', {
      hint: 'image_edit requires at least one reference image'
    })
  }
  return imageGenerate(input, ctx)
}
