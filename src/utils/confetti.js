// High-performance, zero-dependency canvas particle confetti blaster
export const launchConfetti = () => {
  try {
    const canvas = document.createElement('canvas')
    canvas.style.position = 'fixed'
    canvas.style.top = '0'
    canvas.style.left = '0'
    canvas.style.width = '100vw'
    canvas.style.height = '100vh'
    canvas.style.pointerEvents = 'none'
    canvas.style.zIndex = '99999'
    document.body.appendChild(canvas)

    const ctx = canvas.getContext('2d')
    const width = (canvas.width = window.innerWidth)
    const height = (canvas.height = window.innerHeight)

    const colors = ['#111111', '#0080FF', '#00D2FF', '#10B981', '#6366F1', '#F59E0B']
    const particles = Array.from({ length: 45 }, () => ({
      x: width / 2 + (Math.random() - 0.5) * 200,
      y: height * 0.45,
      vx: (Math.random() - 0.5) * 12,
      vy: -(Math.random() * 8 + 6),
      size: Math.random() * 6 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      vRot: (Math.random() - 0.5) * 10,
      opacity: 1
    }))

    let animationId
    const startTime = Date.now()

    const render = () => {
      const elapsed = Date.now() - startTime
      ctx.clearRect(0, 0, width, height)

      particles.forEach(p => {
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.28 // gravity
        p.rotation += p.vRot
        p.opacity = Math.max(0, 1 - elapsed / 1800)

        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate((p.rotation * Math.PI) / 180)
        ctx.fillStyle = p.color
        ctx.globalAlpha = p.opacity
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6)
        ctx.restore()
      })

      if (elapsed < 1800) {
        animationId = requestAnimationFrame(render)
      } else {
        cancelAnimationFrame(animationId)
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas)
      }
    }

    render()
  } catch {
    // Graceful fallback
  }
}
