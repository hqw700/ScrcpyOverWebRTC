import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createPinia } from 'pinia'
import { KeymapEngine } from '../src/utils/keymapEngine.js'
import { getRenderedVideoRect } from '../src/utils/renderedVideo.js'
import { TouchSlots } from '../src/utils/touchSlots.js'
import { useKeymapStore } from '../src/stores/keymap.js'

const tap = { id: 'm_1', type: 'tap', key: 'q', pos: { x: 0.25, y: 0.75 } }
const point = (x, y) => ({ x, y, isRotated: true })
const width = 400
const height = 200

function setup(mappings, slots = new TouchSlots()) {
  const touches = []
  const commands = []
  const engine = new KeymapEngine(
    (action, _clientX, _clientY, id, coord) => touches.push({ action, id, ...coord }),
    cmd => commands.push(cmd),
    slots
  )
  engine.updateProfile({ mappings })
  return { engine, touches, commands }
}

test('tap uses a VHAL slot and releases by physical key after modifiers change', () => {
  const slots = new TouchSlots()
  assert.deepEqual(slots.acquire(), [1]) // physical touch already in progress
  const { engine, touches } = setup([tap], slots)
  assert.equal(engine.handleKeyDown({ key: 'Q', code: 'KeyQ' }, width, height), true)
  engine.handleKeyDown({ key: 'Q', code: 'KeyQ', repeat: true }, width, height)
  assert.equal(engine.handleKeyUp({ key: 'й', code: 'KeyQ' }, width, height), true)
  assert.deepEqual(touches, [
    { action: 0, id: 2, ...point(100, 150) },
    { action: 1, id: 2, ...point(100, 150) }
  ])
  assert.deepEqual(slots.acquire(), [2])
})

test('releasing a profile clears a held tap and joystick at their last positions', () => {
  const joystick = {
    type: 'joystick',
    keys: { up: 'w', down: 's', left: 'a', right: 'd' },
    center: { x: 0.5, y: 0.5 },
    radius: 0.1
  }
  const { engine, touches } = setup([tap, joystick])
  engine.handleKeyDown({ key: 'q' }, width, height)
  engine.handleKeyDown({ key: 'w' }, width, height)
  engine.handleKeyDown({ key: 'd' }, width, height)
  const diagonal = touches.at(-1)
  assert.ok(Math.abs(Math.hypot(diagonal.x - 200, diagonal.y - 100) - 40) < 1e-8)

  engine.updateProfile({ mappings: [] })
  assert.deepEqual(touches.slice(-2), [
    { action: 1, id: 1, ...point(100, 150) },
    { ...diagonal, action: 1 }
  ])
  assert.equal(engine.handleKeyUp({ key: 'w' }, width, height), false)
})

test('a short key press completes the swipe and cancellation removes queued frames', (t) => {
  const frames = new Map()
  let nextFrame = 0
  t.mock.method(performance, 'now', () => 0)
  globalThis.requestAnimationFrame = callback => {
    frames.set(++nextFrame, callback)
    return nextFrame
  }
  globalThis.cancelAnimationFrame = id => frames.delete(id)
  t.after(() => {
    delete globalThis.requestAnimationFrame
    delete globalThis.cancelAnimationFrame
  })

  const swipe = { type: 'swipe', key: 'e', startPos: { x: 0.25, y: 0.5 }, endPos: { x: 0.75, y: 0.5 }, duration: 100 }
  const { engine, touches } = setup([swipe])
  engine.handleKeyDown({ key: 'e' }, width, height)
  engine.handleKeyUp({ key: 'e' }, width, height)
  assert.equal(touches.length, 1)

  const frame = frames.get(1)
  frames.delete(1)
  frame(100)
  assert.deepEqual(touches.slice(1), [
    { action: 2, id: 1, ...point(300, 100) },
    { action: 1, id: 1, ...point(300, 100) }
  ])

  engine.handleKeyDown({ key: 'e' }, width, height)
  engine.releaseAll()
  assert.equal(frames.size, 0)
  assert.deepEqual(touches.at(-1), { action: 1, id: 1, ...point(100, 100) })
})

test('wheel zoom reserves two slots atomically and releases them on timeout', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const slots = new TouchSlots()
  slots.acquire(8)
  const zoom = { type: 'wheel', action: 'zoom', pos: { x: 0.5, y: 0.5 } }
  const { engine, touches } = setup([zoom], slots)
  assert.equal(engine.handleWheelEvent({ deltaY: 0 }, width, height), false)
  engine.handleWheelEvent({ deltaY: -1 }, width, height)
  assert.equal(touches.length, 0)
  slots.release(8)
  engine.handleWheelEvent({ deltaY: -1 }, width, height)
  t.mock.timers.tick(200)
  assert.deepEqual(touches.map(({ action, id }) => [action, id]), [
    [0, 8], [0, 9], [2, 8], [2, 9], [1, 8], [1, 9]
  ])
  assert.deepEqual(slots.acquire(2), [8, 9])
})

test('wheel scrolling and imported system commands preserve their input behavior', () => {
  const wheel = { type: 'wheel', action: 'scroll', pos: { x: 0.5, y: 0.5 } }
  const command = { type: 'command', key: 'escape', cmd: 'input keyevent 4' }
  const { engine, touches, commands } = setup([wheel, command])
  engine.handleWheelEvent({ deltaY: 1 }, width, height)
  engine.releaseAll()
  assert.deepEqual(touches.map(({ action, y }) => [action, y]), [[0, 130], [2, 118], [1, 118]])
  engine.handleKeyDown({ key: 'Escape' }, width, height)
  engine.handleKeyDown({ key: 'Escape', repeat: true }, width, height)
  engine.handleKeyUp({ key: 'Escape' }, width, height)
  assert.deepEqual(commands, ['input keyevent 4'])
})

test('editor and wheel geometry ignore a hidden renderer and the letterbox on either axis', () => {
  const media = {
    isConnected: true,
    getBoundingClientRect: () => ({ left: 10, top: 20, width: 400, height: 300 })
  }
  assert.deepEqual(getRenderedVideoRect(media, 400, 200), { left: 10, top: 70, width: 400, height: 200 })
  assert.deepEqual(getRenderedVideoRect(media, 400, 200, true), { left: 135, top: 20, width: 150, height: 300 })
  media.getBoundingClientRect = () => ({ left: 0, top: 0, width: 0, height: 0 })
  assert.equal(getRenderedVideoRect(media, 400, 200), null)
})

test('loading a legacy default profile preserves custom mappings alongside invalid entries', (t) => {
  const saved = { activeProfileId: 'default', profiles: [{ id: 'default', name: 'Default', mappings: [tap, null] }] }
  const storage = globalThis.localStorage
  globalThis.localStorage = { getItem: () => JSON.stringify(saved) }
  t.after(() => {
    if (storage) globalThis.localStorage = storage
    else delete globalThis.localStorage
  })
  const store = useKeymapStore(createPinia())
  assert.deepEqual(store.activeProfile.mappings, [tap])
})
