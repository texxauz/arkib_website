'use client'
import { useState, useEffect, useCallback } from 'react'

type StaffMember = {
  id: string
  full_name: string
  role: string
  clocked_in: boolean
  clock_in_time: string | null
}

function initials(name: string) {
  return name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function roleLabel(role: string) {
  const map: Record<string, string> = { owner: 'Owner', manager: 'Manager', staff: 'Bartender', full_timer: 'Full-time', part_timer: 'Part-time', bartender: 'Bartender' }
  return map[role] ?? role
}

export function KioskClient({ initialStaff }: { initialStaff: StaffMember[] }) {
  const [staff, setStaff] = useState<StaffMember[]>(initialStaff)
  const [active, setActive] = useState<StaffMember | null>(null)
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [flash, setFlash] = useState<{ name: string; action: 'clock_in' | 'clock_out' } | null>(null)
  const [shake, setShake] = useState(false)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Refresh staff status every 30s
  const refresh = useCallback(async () => {
    const res = await fetch('/api/kiosk/staff')
    if (res.ok) setStaff(await res.json())
  }, [])

  useEffect(() => {
    const t = setInterval(refresh, 30_000)
    return () => clearInterval(t)
  }, [refresh])

  const openPin = (s: StaffMember) => { setActive(s); setPin('') }
  const closePin = () => { setActive(null); setPin('') }

  const pressNum = (n: string) => {
    if (pin.length >= 4) return
    setPin(p => p + n)
  }

  const pressBack = () => setPin(p => p.slice(0, -1))

  const confirm = async () => {
    if (!active || pin.length < 4 || loading) return
    setLoading(true)
    const res = await fetch('/api/kiosk/clock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: active.id, pin }),
    })
    setLoading(false)

    if (!res.ok) {
      setShake(true)
      setPin('')
      setTimeout(() => setShake(false), 400)
      return
    }

    const data = await res.json()
    closePin()
    setFlash({ name: data.name, action: data.action })
    setTimeout(() => setFlash(null), 2500)
    await refresh()
  }

  const onCount = staff.filter(s => s.clocked_in).length

  return (
    <div style={{ minHeight: '100vh', background: '#08080B', color: '#F0EEF6', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 28px', borderBottom: '1px solid #1E1E28', background: '#0F0F14' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,#8B5CF6,#6D28D9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🍸</div>
          <div>
            <div style={{ fontWeight: 700, letterSpacing: '0.1em', fontSize: 15 }}>ARKIB</div>
            <div style={{ fontSize: 10, color: '#5A5868', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Bar Management</div>
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 34, fontWeight: 300, letterSpacing: '0.04em', fontVariantNumeric: 'tabular-nums' }}>
            {now.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
          </div>
          <div style={{ fontSize: 12, color: '#5A5868', marginTop: 2 }}>
            {now.toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: '#A78BFA', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', padding: '4px 12px', borderRadius: 20 }}>⬤ KIOSK MODE</div>
          <div style={{ fontSize: 11, color: '#5A5868', marginTop: 6 }}>{onCount} staff on shift</div>
        </div>
      </div>

      <div style={{ textAlign: 'center', padding: '10px', fontSize: 13, color: '#5A5868', background: '#08080B' }}>
        Tap your name to clock in or out
      </div>

      {/* Staff grid */}
      <div style={{ padding: '20px 28px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16, flex: 1 }}>
        {staff.map(s => (
          <button
            key={s.id}
            onClick={() => openPin(s)}
            style={{
              background: s.clocked_in ? 'rgba(16,185,129,0.04)' : '#14141C',
              border: `1px solid ${s.clocked_in ? 'rgba(16,185,129,0.2)' : '#22222C'}`,
              borderRadius: 20,
              padding: '22px 14px 18px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
              cursor: 'pointer',
              transition: 'transform 0.1s',
              color: 'inherit',
            }}
            onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.96)')}
            onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
          >
            {/* Avatar */}
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: s.clocked_in ? 'rgba(16,185,129,0.08)' : 'rgba(139,92,246,0.08)', border: `2px solid ${s.clocked_in ? 'rgba(16,185,129,0.25)' : 'rgba(139,92,246,0.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: s.clocked_in ? '#10B981' : '#A78BFA', position: 'relative' }}>
              {initials(s.full_name)}
              <div style={{ position: 'absolute', bottom: 1, right: 1, width: 13, height: 13, borderRadius: '50%', background: s.clocked_in ? '#10B981' : '#2E2E3A', border: '2px solid #14141C' }} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, textAlign: 'center', lineHeight: 1.3 }}>{s.full_name}</div>
              <div style={{ fontSize: 10, color: '#5A5868', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center', marginTop: 2 }}>{roleLabel(s.role)}</div>
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, padding: '3px 12px', borderRadius: 20, background: s.clocked_in ? 'rgba(16,185,129,0.08)' : 'rgba(90,88,104,0.1)', color: s.clocked_in ? '#10B981' : '#5A5868', border: `1px solid ${s.clocked_in ? 'rgba(16,185,129,0.2)' : '#22222C'}` }}>
              {s.clocked_in ? '● On Shift' : '○ Not In'}
            </div>
            <div style={{ fontSize: 10, color: '#5A5868', fontVariantNumeric: 'tabular-nums' }}>
              {s.clocked_in && s.clock_in_time ? `Since ${fmtTime(s.clock_in_time)}` : ' '}
            </div>
          </button>
        ))}

        {staff.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', color: '#5A5868', padding: '60px 0' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🍸</div>
            <p style={{ fontSize: 14 }}>No staff set up yet.</p>
            <p style={{ fontSize: 12, marginTop: 6 }}>Ask your manager to assign clock-in PINs in Team Access.</p>
          </div>
        )}
      </div>

      {/* PIN Modal */}
      {active && (
        <div
          onClick={e => { if (e.target === e.currentTarget) closePin() }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(4,4,8,0.88)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
        >
          <div
            style={{ background: '#0F0F14', border: '1px solid #2E2E3A', borderRadius: 28, padding: '32px 28px 28px', width: 310, display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 24px 80px rgba(0,0,0,0.7)', animation: shake ? 'shake 0.35s ease' : undefined }}
          >
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(139,92,246,0.1)', border: '2px solid rgba(139,92,246,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700, color: '#A78BFA', marginBottom: 12 }}>
              {initials(active.full_name)}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{active.full_name}</div>
            <div style={{ fontSize: 13, color: '#5A5868', marginBottom: 24 }}>
              Enter PIN to <span style={{ color: active.clocked_in ? '#F87171' : '#10B981', fontWeight: 600 }}>{active.clocked_in ? 'clock out' : 'clock in'}</span>
            </div>

            {/* Dots */}
            <div style={{ display: 'flex', gap: 14, marginBottom: 28 }}>
              {[0, 1, 2, 3].map(i => (
                <div key={i} style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${i < pin.length ? '#8B5CF6' : '#2E2E3A'}`, background: i < pin.length ? '#8B5CF6' : 'transparent', transition: 'all 0.12s' }} />
              ))}
            </div>

            {/* Numpad */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, width: '100%', marginBottom: 16 }}>
              {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((n, i) => (
                <button
                  key={i}
                  onClick={() => n === '⌫' ? pressBack() : n ? pressNum(n) : undefined}
                  style={{ height: 62, borderRadius: 14, border: '1px solid #22222C', background: n ? '#14141C' : 'transparent', borderColor: n ? '#22222C' : 'transparent', color: n === '⌫' ? '#9896A4' : '#F0EEF6', fontSize: n === '⌫' ? 16 : 22, fontWeight: 500, cursor: n ? 'pointer' : 'default', transition: 'transform 0.08s, background 0.08s' }}
                  onMouseDown={e => n && (e.currentTarget.style.transform = 'scale(0.93)')}
                  onMouseUp={e => n && (e.currentTarget.style.transform = 'scale(1)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  {n}
                </button>
              ))}
            </div>

            <button
              onClick={confirm}
              disabled={pin.length < 4 || loading}
              style={{ width: '100%', height: 54, borderRadius: 14, border: 'none', background: pin.length >= 4 && !loading ? (active.clocked_in ? '#EF4444' : '#8B5CF6') : '#22222C', color: pin.length >= 4 && !loading ? '#fff' : '#5A5868', fontSize: 16, fontWeight: 600, cursor: pin.length >= 4 && !loading ? 'pointer' : 'default', transition: 'background 0.15s', letterSpacing: '0.02em' }}
            >
              {loading ? 'Please wait…' : active.clocked_in ? 'Clock Out' : 'Clock In'}
            </button>

            <button onClick={closePin} style={{ marginTop: 14, background: 'none', border: 'none', color: '#5A5868', fontSize: 13, cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'transparent' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Success flash */}
      {flash && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(16,185,129,0.08)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, zIndex: 200, pointerEvents: 'none' }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(16,185,129,0.1)', border: '2px solid rgba(16,185,129,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>✓</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#10B981' }}>{flash.action === 'clock_in' ? 'Clocked In!' : 'Clocked Out!'}</div>
          <div style={{ fontSize: 14, color: '#9896A4' }}>
            {flash.action === 'clock_in' ? `Welcome, ${flash.name.split(' ')[0]}! Have a great shift.` : `See you, ${flash.name.split(' ')[0]}!`}
          </div>
        </div>
      )}

      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  )
}
