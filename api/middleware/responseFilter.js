// PERA Studio response post-processing.
// v2 keeps provider/tool references intact instead of rewriting them, so the UI can remain transparent.
export function filterGeminiResponse(responseData) {
  return responseData;
}

export function containsForbiddenTerms() {
  return false;
}

export function logFilteredContent(original, filtered) {
  if (process.env.NODE_ENV !== 'production' && original !== filtered) {
    console.log('PERA Studio response post-processed');
  }
}
