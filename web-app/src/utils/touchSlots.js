export class TouchSlots {
  reserved = new Set()

  acquire(count = 1) {
    const slots = []
    // The Linux VHAL accepts slots 0–9 and routes mouse input to slot 0.
    for (let slot = 1; slot < 10 && slots.length < count; slot++) {
      if (!this.reserved.has(slot)) slots.push(slot)
    }
    if (slots.length !== count) return null
    for (const slot of slots) this.reserved.add(slot)
    return slots
  }

  release(slot) {
    this.reserved.delete(slot)
  }
}
