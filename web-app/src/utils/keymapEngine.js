import { TouchSlots } from './touchSlots.js'

const DOWN = 0
const UP = 1
const MOVE = 2
const DIRECTIONS = ['up', 'down', 'left', 'right']

function getPhysicalKey(event) {
  return event.code && event.code !== 'Unidentified' ? event.code : event.key.toLowerCase()
}

export class KeymapEngine {
  constructor(sendTouch, sendCommand, slots = new TouchSlots()) {
    this.sendTouch = sendTouch
    this.sendCommand = sendCommand
    this.slots = slots
    this.mappings = []
    this.pressedKeys = new Map()
    this.taps = new Map()
    this.swipes = new Map()
    this.joysticks = new Map()
    this.wheels = new Map()
  }

  updateProfile(profile) {
    this.releaseAll()
    this.mappings = profile?.mappings ?? []
  }

  releaseAll() {
    for (const pointer of this.taps.values()) this.endTouch(pointer)
    for (const swipe of this.swipes.values()) {
      cancelAnimationFrame(swipe.frame)
      this.endTouch(swipe.pointer)
    }
    for (const joystick of this.joysticks.values()) {
      if (joystick.pointer) this.endTouch(joystick.pointer)
    }
    for (const wheel of this.wheels.values()) {
      clearTimeout(wheel.timer)
      for (const pointer of wheel.pointers) this.endTouch(pointer)
    }
    this.pressedKeys.clear()
    this.taps.clear()
    this.swipes.clear()
    this.joysticks.clear()
    this.wheels.clear()
  }

  handleKeyDown(event, width, height) {
    const key = event.key.toLowerCase()
    const physicalKey = getPhysicalKey(event)
    if (this.pressedKeys.has(physicalKey)) return true

    const bindings = []
    for (const mapping of this.mappings) {
      if (mapping.type === 'joystick') {
        const direction = DIRECTIONS.find(dir => mapping.keys[dir]?.toLowerCase() === key)
        if (direction) bindings.push({ mapping, direction })
      } else if (mapping.key?.toLowerCase() === key) {
        bindings.push({ mapping })
      }
    }
    if (!bindings.length) return false
    if (event.repeat) return true

    this.pressedKeys.set(physicalKey, bindings)
    for (const { mapping, direction } of bindings) {
      switch (mapping.type) {
        case 'tap': {
          if (this.taps.has(mapping)) break
          const [pointer] = this.startTouches([this.toPixels(mapping.pos, width, height)])
          if (pointer) this.taps.set(mapping, pointer)
          break
        }
        case 'swipe':
          this.startSwipe(mapping, width, height)
          break
        case 'joystick':
          this.updateJoystick(mapping, direction, true, width, height)
          break
        case 'command':
          this.sendCommand(mapping.cmd)
          break
      }
    }
    return true
  }

  handleKeyUp(event, width, height) {
    const physicalKey = getPhysicalKey(event)
    const bindings = this.pressedKeys.get(physicalKey)
    if (!bindings) return false

    this.pressedKeys.delete(physicalKey)
    for (const { mapping, direction } of bindings) {
      const stillPressed = Array.from(this.pressedKeys.values()).some(keys =>
        keys.some(binding => binding.mapping === mapping && binding.direction === direction))
      if (stillPressed) continue
      const pointer = this.taps.get(mapping)
      if (pointer) {
        this.endTouch(pointer)
        this.taps.delete(mapping)
      }
      if (direction) this.updateJoystick(mapping, direction, false, width, height)
    }
    return true
  }

  toPixels(pos, width, height) {
    return { x: pos.x * width, y: pos.y * height }
  }

  startTouches(positions) {
    const slots = this.slots.acquire(positions.length)
    if (!slots) return []

    return positions.map(({ x, y }, index) => {
      const pointer = { id: slots[index], x, y }
      this.emitTouch(DOWN, pointer)
      return pointer
    })
  }

  moveTouch(pointer, x, y) {
    pointer.x = x
    pointer.y = y
    this.emitTouch(MOVE, pointer)
  }

  endTouch(pointer) {
    this.emitTouch(UP, pointer)
    this.slots.release(pointer.id)
  }

  emitTouch(action, { id, x, y }) {
    this.sendTouch(action, 0, 0, id, { x, y, isRotated: true })
  }

  updateJoystick(mapping, direction, isDown, width, height) {
    let joystick = this.joysticks.get(mapping)
    if (!joystick) {
      joystick = { directions: new Set(), pointer: null }
      this.joysticks.set(mapping, joystick)
    }
    if (isDown) joystick.directions.add(direction)
    else joystick.directions.delete(direction)

    const { directions } = joystick
    const dx = Number(directions.has('right')) - Number(directions.has('left'))
    const dy = Number(directions.has('down')) - Number(directions.has('up'))
    const length = Math.hypot(dx, dy)
    if (!length) {
      if (joystick.pointer) this.endTouch(joystick.pointer)
      joystick.pointer = null
      if (!directions.size) this.joysticks.delete(mapping)
      return
    }

    const center = this.toPixels(mapping.center, width, height)
    const radius = mapping.radius * width
    if (!joystick.pointer) [joystick.pointer] = this.startTouches([center])
    if (joystick.pointer) {
      this.moveTouch(joystick.pointer, center.x + dx * radius / length, center.y + dy * radius / length)
    }
  }

  startSwipe(mapping, width, height) {
    if (this.swipes.has(mapping)) return
    const start = this.toPixels(mapping.startPos, width, height)
    const end = this.toPixels(mapping.endPos, width, height)
    const [pointer] = this.startTouches([start])
    if (!pointer) return

    const duration = mapping.duration > 0 ? mapping.duration : 150
    const startTime = performance.now()
    const swipe = { pointer, frame: null }
    const animate = (now) => {
      const progress = Math.max(0, Math.min(1, (now - startTime) / duration))
      this.moveTouch(pointer, start.x + (end.x - start.x) * progress, start.y + (end.y - start.y) * progress)
      if (progress === 1) {
        this.endTouch(pointer)
        this.swipes.delete(mapping)
      } else {
        swipe.frame = requestAnimationFrame(animate)
      }
    }
    this.swipes.set(mapping, swipe)
    swipe.frame = requestAnimationFrame(animate)
  }

  handleWheelEvent(event, width, height) {
    const direction = Math.sign(event.deltaY)
    if (!direction) return false

    let consumed = false
    for (const mapping of this.mappings) {
      if (mapping.type !== 'wheel') continue
      if (mapping.action === 'zoom') this.handleZoom(mapping, direction, width, height)
      else this.handleScroll(mapping, direction, width, height)
      consumed = true
    }
    return consumed
  }

  handleScroll(mapping, direction, width, height) {
    const { x, y } = this.toPixels(mapping.pos, width, height)
    let wheel = this.wheels.get(mapping)
    if (!wheel) {
      const offset = direction * height * 0.15
      const pointers = this.startTouches([{ x, y: Math.max(0, Math.min(height - 1, y + offset)) }])
      if (!pointers.length) return
      wheel = { pointers, offset }
      this.wheels.set(mapping, wheel)
    }

    wheel.offset -= direction * height * 0.06
    const nextY = y + wheel.offset
    this.moveTouch(wheel.pointers[0], x, Math.max(0, Math.min(height - 1, nextY)))
    this.finishWheel(mapping, wheel, nextY <= 0 || nextY >= height - 1 || Math.abs(wheel.offset) > height * 0.3)
  }

  handleZoom(mapping, direction, width, height) {
    const span = Math.min(width, height)
    const minRadius = span * 0.05
    const maxRadius = span * 0.4
    const positions = radius => [-1, 1].map(sign => {
      const offset = sign * radius / Math.SQRT2
      return { x: width / 2 + offset, y: height / 2 + offset }
    })

    let wheel = this.wheels.get(mapping)
    if (!wheel) {
      const offset = direction < 0 ? minRadius + span * 0.02 : maxRadius - span * 0.02
      const pointers = this.startTouches(positions(offset))
      if (!pointers.length) return
      wheel = { pointers, offset }
      this.wheels.set(mapping, wheel)
    }

    const nextRadius = wheel.offset - direction * span * 0.05
    wheel.offset = Math.max(minRadius, Math.min(maxRadius, nextRadius))
    positions(wheel.offset).forEach(({ x, y }, index) => this.moveTouch(wheel.pointers[index], x, y))
    this.finishWheel(mapping, wheel, nextRadius <= minRadius || nextRadius >= maxRadius)
  }

  finishWheel(mapping, wheel, atLimit) {
    clearTimeout(wheel.timer)
    const release = () => {
      for (const pointer of wheel.pointers) this.endTouch(pointer)
      this.wheels.delete(mapping)
    }
    if (atLimit) release()
    else wheel.timer = setTimeout(release, 200)
  }
}
