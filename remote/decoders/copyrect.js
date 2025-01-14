export default class CopyRectDecoder {
  decodeRect(x, y, width, height, sock, display, depth) {
    if (sock.rQwait("COPYRECT", 4)) {
      return false
    }

    let deltaX = sock.rQshift16()
    let deltaY = sock.rQshift16()

    if (width === 0 || height === 0) {
      return true
    }

    display.copyImage(deltaX, deltaY, x, y, width, height)

    return true
  }
}
