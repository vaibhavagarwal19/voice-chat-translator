// Generate a consistent, vibrant color from a string (sid)
function colorFromString(str = '') {
  const colors = [
    'bg-gradient-to-br from-purple-500 to-pink-500',
    'bg-gradient-to-br from-blue-500 to-cyan-500',
    'bg-gradient-to-br from-green-500 to-emerald-500',
    'bg-gradient-to-br from-orange-500 to-red-500',
    'bg-gradient-to-br from-indigo-500 to-purple-500',
    'bg-gradient-to-br from-pink-500 to-rose-500',
    'bg-gradient-to-br from-teal-500 to-blue-500',
    'bg-gradient-to-br from-yellow-500 to-orange-500',
  ]
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

export default function Avatar({ sid, isSelf = false, size = 'md' }) {
  const sizeClasses = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-11 h-11 text-base',
  }
  const initial = isSelf ? 'You' : (sid?.slice(0, 2).toUpperCase() || '??')
  const colorClass = isSelf ? 'bg-gradient-to-br from-blue-500 to-blue-600' : colorFromString(sid)

  return (
    <div
      className={`${sizeClasses[size]} ${colorClass} rounded-full flex items-center justify-center text-white font-bold shadow-md flex-shrink-0`}
    >
      {isSelf ? 'Y' : initial.charAt(0)}
    </div>
  )
}
