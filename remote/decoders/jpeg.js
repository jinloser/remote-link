export default class JPEGDecoder {
  constructor() {
    // RealVNC will reuse the quantization tables
    // and Huffman tables, so we need to cache them.
    this._cachedQuantTables = []
    this._cachedHuffmanTables = []

    this._segments = []
  }

  decodeRect(x, y, width, height, sock, display, depth) {
    // A rect of JPEG encodings is simply a JPEG file
    while (true) {
      let segment = this._readSegment(sock)
      if (segment === null) {
        return false
      }
      this._segments.push(segment)
      // End of image?
      if (segment[1] === 0xd9) {
        break
      }
    }

    let huffmanTables = []
    let quantTables = []
    for (let segment of this._segments) {
      let type = segment[1]
      if (type === 0xc4) {
        // Huffman tables
        huffmanTables.push(segment)
      } else if (type === 0xdb) {
        // Quantization tables
        quantTables.push(segment)
      }
    }

    const sofIndex = this._segments.findIndex((x) => x[1] == 0xc0 || x[1] == 0xc2)
    if (sofIndex == -1) {
      throw new Error("Illegal JPEG image without SOF")
    }

    if (quantTables.length === 0) {
      this._segments.splice(sofIndex + 1, 0, ...this._cachedQuantTables)
    }
    if (huffmanTables.length === 0) {
      this._segments.splice(sofIndex + 1, 0, ...this._cachedHuffmanTables)
    }

    let length = 0
    for (let segment of this._segments) {
      length += segment.length
    }

    let data = new Uint8Array(length)
    length = 0
    for (let segment of this._segments) {
      data.set(segment, length)
      length += segment.length
    }

    display.imageRect(x, y, width, height, "image/jpeg", data)

    if (huffmanTables.length !== 0) {
      this._cachedHuffmanTables = huffmanTables
    }
    if (quantTables.length !== 0) {
      this._cachedQuantTables = quantTables
    }

    this._segments = []

    return true
  }

  _readSegment(sock) {
    if (sock.rQwait("JPEG", 2)) {
      return null
    }

    let marker = sock.rQshift8()
    if (marker != 0xff) {
      throw new Error("Illegal JPEG marker received (byte: " + marker + ")")
    }
    let type = sock.rQshift8()
    if ((type >= 0xd0 && type <= 0xd9) || type == 0x01) {
      // No length after marker
      return new Uint8Array([marker, type])
    }

    if (sock.rQwait("JPEG", 2, 2)) {
      return null
    }

    let length = sock.rQshift16()
    if (length < 2) {
      throw new Error("Illegal JPEG length received (length: " + length + ")")
    }

    if (sock.rQwait("JPEG", length - 2, 4)) {
      return null
    }

    let extra = 0
    if (type === 0xda) {
      // start of scan
      extra += 2
      while (true) {
        if (sock.rQwait("JPEG", length - 2 + extra, 4)) {
          return null
        }
        let data = sock.rQpeekBytes(length - 2 + extra, false)
        if (data.at(-2) === 0xff && data.at(-1) !== 0x00 && !(data.at(-1) >= 0xd0 && data.at(-1) <= 0xd7)) {
          extra -= 2
          break
        }
        extra++
      }
    }

    let segment = new Uint8Array(2 + length + extra)
    segment[0] = marker
    segment[1] = type
    segment[2] = length >> 8
    segment[3] = length
    segment.set(sock.rQshiftBytes(length - 2 + extra, false), 4)

    return segment
  }
}
