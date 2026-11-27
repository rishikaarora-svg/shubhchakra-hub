// Read a File from <input capture> and downscale it so uploads are fast and storage stays small.
export function fileToDataUrl(file, maxSide = 768, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = () => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => resolve(downscale(img, maxSide, quality))
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

/** Works for <img> and for a live <video> frame. */
export function downscale(img, maxSide, quality = 0.8) {
  const w = img.videoWidth || img.naturalWidth || img.width
  const h = img.videoHeight || img.naturalHeight || img.height
  const s = Math.min(1, maxSide / Math.max(w, h))
  const c = document.createElement('canvas')
  c.width = Math.round(w * s)
  c.height = Math.round(h * s)
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', quality)
}

export function thumbnail(dataUrl, maxSide = 320) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(downscale(img, maxSide, 0.6))
    img.onerror = () => resolve(null)
    img.src = dataUrl
  })
}
