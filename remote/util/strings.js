// Decode from UTF-8
export function decodeUTF8(utf8string, allowLatin1 = false) {
  try {
    return decodeURIComponent(escape(utf8string))
  } catch (e) {
    if (e instanceof URIError) {
      if (allowLatin1) {
        // If we allow Latin1 we can ignore any decoding fails
        // and in these cases return the original string
        return utf8string
      }
    }
    throw e
  }
}

// Encode to UTF-8
export function encodeUTF8(DOMString) {
  return unescape(encodeURIComponent(DOMString))
}
