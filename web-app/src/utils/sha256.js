// 增量式 SHA-256（纯 JS 实现）
// 用于上传大文件前计算完整性校验哈希：
// - 分块读取文件，避免一次性 file.arrayBuffer() 把整个文件读入内存（移动端会因此被系统杀掉导致断连）
// - 不依赖 crypto.subtle，在非安全上下文 (http://IP 直连) 下同样可用

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
])

function rotr(x, n) {
  return (x >>> n) | (x << (32 - n))
}

export function createSha256() {
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19])
  const w = new Uint32Array(64)
  const buffer = new Uint8Array(64)
  let bufferLen = 0
  let totalLen = 0 // 字节数，使用 double 存储（2^53 内精确）

  function compress(block) {
    for (let i = 0; i < 16; i++) {
      const j = i * 4
      w[i] = ((block[j] << 24) | (block[j + 1] << 16) | (block[j + 2] << 8) | block[j + 3]) | 0
    }
    for (let i = 16; i < 64; i++) {
      const s0 = (rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3)) | 0
      const s1 = (rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10)) | 0
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0
    }
    let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7]
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
      const ch = (e & f) ^ (~e & g)
      const t1 = (h + S1 + ch + K[i] + w[i]) | 0
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const t2 = (S0 + maj) | 0
      h = g; g = f; f = e; e = (d + t1) | 0
      d = c; c = b; b = a; a = (t1 + t2) | 0
    }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0
    H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0
  }

  function update(data) {
    totalLen += data.length
    let i = 0
    if (bufferLen > 0) {
      const take = Math.min(64 - bufferLen, data.length)
      buffer.set(data.subarray(0, take), bufferLen)
      bufferLen += take
      i += take
      if (bufferLen === 64) {
        compress(buffer)
        bufferLen = 0
      }
    }
    while (i + 64 <= data.length) {
      compress(data.subarray(i, i + 64))
      i += 64
    }
    if (i < data.length) {
      buffer.set(data.subarray(i), 0)
      bufferLen = data.length - i
    }
  }

  // 结束并输出 hex（调用后状态被污染，不可继续 update）
  function digest() {
    const bitLenLo = (totalLen << 3) >>> 0
    const bitLenHi = (Math.floor(totalLen / 0x20000000)) >>> 0 // totalLen * 8 / 2^32
    buffer[bufferLen++] = 0x80
    if (bufferLen > 56) {
      buffer.fill(0, bufferLen, 64)
      compress(buffer)
      bufferLen = 0
    }
    buffer.fill(0, bufferLen, 56)
    buffer[56] = bitLenHi >>> 24
    buffer[57] = (bitLenHi >>> 16) & 0xff
    buffer[58] = (bitLenHi >>> 8) & 0xff
    buffer[59] = bitLenHi & 0xff
    buffer[60] = bitLenLo >>> 24
    buffer[61] = (bitLenLo >>> 16) & 0xff
    buffer[62] = (bitLenLo >>> 8) & 0xff
    buffer[63] = bitLenLo & 0xff
    compress(buffer)
    let hex = ''
    for (let i = 0; i < 8; i++) {
      hex += H[i].toString(16).padStart(8, '0')
    }
    return hex
  }

  return { update, digest }
}

// 分块计算 File/Blob 的 SHA-256，块间让出主线程避免卡死 UI
export async function hashFileIncremental(file, chunkSize = 4 * 1024 * 1024) {
  const hasher = createSha256()
  let offset = 0
  while (offset < file.size) {
    const end = Math.min(offset + chunkSize, file.size)
    const buf = await file.slice(offset, end).arrayBuffer()
    hasher.update(new Uint8Array(buf))
    offset = end
    if (offset < file.size) {
      await new Promise(resolve => setTimeout(resolve, 0))
    }
  }
  return hasher.digest()
}
