export function getRenderedVideoRect(media, width, height, rotated = false) {
  if (!media || !width || !height || !media.isConnected) return null

  const rect = media.getBoundingClientRect()
  if (!rect.width || !rect.height) return null

  const ratio = rotated ? height / width : width / height
  const renderedWidth = Math.min(rect.width, rect.height * ratio)
  const renderedHeight = renderedWidth / ratio
  return {
    left: rect.left + (rect.width - renderedWidth) / 2,
    top: rect.top + (rect.height - renderedHeight) / 2,
    width: renderedWidth,
    height: renderedHeight
  }
}
