import { useEffect, useState, useRef } from 'react'
import { Activity, Brain, Server, Terminal, Trophy, Play, Pause } from 'lucide-react'

export default function App() {
  const [data, setData] = useState({
    generation: 0,
    max_fitness: 0,
    active_dinos: 0,
    logs: [],
    preview_frames: [null, null, null, null],
    training: false,
    paused: true
  })

  const ws = useRef(null)

  useEffect(() => {
    ws.current = new WebSocket('ws://localhost:8000/ws')
    ws.current.onmessage = (event) => {
      const parsed = JSON.parse(event.data)
      setData(parsed)
    }
    return () => {
      if (ws.current) ws.current.close()
    }
  }, [])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3">
            <Brain className="w-6 h-6 text-indigo-600" />
            <h1 className="text-xl font-bold tracking-tight">DinoBot Neural Engine</h1>
            <div className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-2 ${data.training && !data.paused ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
              <div className={`w-2 h-2 rounded-full ${data.training && !data.paused ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              {data.training && !data.paused ? 'TRAINING ACTIVE' : 'PAUSED'}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => fetch('http://localhost:8000/start', { method: 'POST' })}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
            >
              <Play className="w-4 h-4" /> Start
            </button>
            <button 
              onClick={() => fetch('http://localhost:8000/pause', { method: 'POST' })}
              className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-sm font-semibold rounded-lg transition-colors shadow-sm"
            >
              <Pause className="w-4 h-4" /> Pause
            </button>
            <div className="flex items-center gap-2 ml-2 border-l border-slate-200 pl-4">
              <span className="text-sm font-medium text-slate-500">Preview FPS:</span>
              <select 
                className="bg-white border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-1.5 shadow-sm font-medium"
                onChange={(e) => fetch('http://localhost:8000/config', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ preview_skip_frames: parseInt(e.target.value) })
                })}
                defaultValue="30"
              >
                <option value="10">High (~6 FPS)</option>
                <option value="30">Medium (~2 FPS)</option>
                <option value="90">Low (~0.5 FPS)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Left Panel: Metrics */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Server className="w-4 h-4" /> Runtime Metrics
              </h2>
              
              <div className="space-y-4">
                <div>
                  <div className="text-sm font-medium text-slate-500">Generation</div>
                  <div className="text-3xl font-bold text-slate-900">{data.generation}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-500">Active Dinos</div>
                  <div className="text-3xl font-bold text-slate-900">{data.active_dinos}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-500">Max Fitness</div>
                  <div className="text-3xl font-bold text-indigo-600">{data.max_fitness.toFixed(1)}</div>
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Trophy className="w-4 h-4" /> Victory Condition
              </h2>
              <div className="text-sm text-slate-600 mb-2">
                Training halts and model is saved when fitness reaches 100,000.
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5">
                <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${Math.min((data.max_fitness / 100000) * 100, 100)}%` }}></div>
              </div>
              <div className="text-right text-xs font-medium text-slate-500 mt-1">
                {((data.max_fitness / 100000) * 100).toFixed(2)}%
              </div>
            </div>
          </div>

          {/* Center/Right Panel: Video & Logs */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* Live Preview */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
               <div className="bg-slate-900 px-4 py-3 flex items-center justify-between border-b border-slate-800">
                 <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                   <Activity className="w-4 h-4 text-emerald-400" /> Live Simulation Previews (4 Browsers)
                 </h2>
               </div>
               <div className="bg-slate-950 p-2 grid grid-cols-2 gap-2">
                 {data.preview_frames.map((frame, idx) => (
                   <div key={idx} className="aspect-video bg-slate-900 rounded border border-slate-800 flex items-center justify-center overflow-hidden relative">
                     {frame ? (
                       <img 
                         src={`data:image/png;base64,${frame}`} 
                         alt={`Browser ${idx + 1}`} 
                         className="w-full h-full object-cover opacity-90"
                       />
                     ) : (
                       <div className="text-slate-700 font-mono text-xs flex flex-col items-center gap-2">
                          <div className="w-1.5 h-1.5 bg-slate-700 rounded-full animate-pulse" />
                          Browser {idx + 1}
                       </div>
                     )}
                   </div>
                 ))}
               </div>
            </div>

            {/* Logs Terminal */}
            <div className="bg-[#1e1e2e] rounded-xl shadow-sm border border-slate-200 overflow-hidden h-96 flex flex-col">
              <div className="bg-[#181825] px-4 py-3 flex items-center gap-2 border-b border-[#313244]">
                <Terminal className="w-4 h-4 text-[#cba6f7]" />
                <h2 className="text-xs font-bold text-[#a6adc8] uppercase tracking-wider">
                  Engine Logs (Manual Scroll)
                </h2>
              </div>
              <div className="p-4 overflow-y-auto flex-1 font-mono text-sm text-[#cdd6f4] space-y-1">
                {data.logs.map((log, idx) => (
                  <div key={idx}>
                    {/* The timestamp is already built into the backend string, just regex color it if desired, or just print it */}
                    {log.startsWith('[') ? (
                      <>
                        <span className="text-[#89b4fa] mr-2">{log.split(']')[0] + ']'}</span>
                        {log.substring(log.indexOf(']') + 1)}
                      </>
                    ) : (
                      log
                    )}
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
