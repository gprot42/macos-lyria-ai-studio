import { useRef, useState } from "react"
import { Play, Pause, Trash2, Music, FolderOpen } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { useAppStore, type SavedTrack } from "@/stores/app-store"
import { formatTime, cn } from "@/lib/utils"
import { open } from "@tauri-apps/plugin-dialog"
import { readFile } from "@tauri-apps/plugin-fs"

export function TrackLibrary() {
  const {
    savedTracks,
    currentPlayingTrackId,
    removeSavedTrack,
    addSavedTrack,
    setCurrentPlayingTrackId,
    setIsPlaying,
  } = useAppStore()

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playbackTime, setPlaybackTime] = useState(0)

  const handlePlay = async (track: SavedTrack) => {
    if (currentPlayingTrackId === track.id) {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      setCurrentPlayingTrackId(null)
      setIsPlaying(false)
      return
    }

    if (audioRef.current) {
      audioRef.current.pause()
    }

    try {
      const fileData = await readFile(track.path)
      const blob = new Blob([fileData], { type: track.path.endsWith('.flac') ? 'audio/flac' : 'audio/mpeg' })
      const url = URL.createObjectURL(blob)
      
      const audio = new Audio(url)
      audioRef.current = audio
      
      audio.ontimeupdate = () => {
        setPlaybackTime(audio.currentTime)
      }
      
      audio.onended = () => {
        setCurrentPlayingTrackId(null)
        setIsPlaying(false)
        URL.revokeObjectURL(url)
      }
      
      audio.onerror = () => {
        console.error("Failed to play track")
        setCurrentPlayingTrackId(null)
        setIsPlaying(false)
      }

      await audio.play()
      setCurrentPlayingTrackId(track.id)
      setIsPlaying(true)
    } catch (err) {
      console.error("Failed to load track:", err)
    }
  }

  const handleImport = async () => {
    try {
      const filePath = await open({
        filters: [
          { name: "Audio Files", extensions: ["mp3", "flac", "wav"] }
        ],
        multiple: false,
      })

      if (filePath && typeof filePath === 'string') {
        const name = filePath.split('/').pop() || 'Imported Track'
        const track: SavedTrack = {
          id: `${Date.now()}`,
          name: name.replace(/\.(mp3|flac|wav)$/, ''),
          path: filePath,
          duration: 0,
          createdAt: Date.now(),
        }
        addSavedTrack(track)
      }
    } catch (err) {
      console.error("Failed to import:", err)
    }
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-text">Track Library</h3>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleImport}
          className="h-8 px-2 text-sm"
        >
          <FolderOpen className="w-4 h-4 mr-1" />
          Import
        </Button>
      </div>

      {savedTracks.length === 0 ? (
        <div className="p-6 border border-dashed border-border rounded-md text-center">
          <Music className="w-8 h-8 mx-auto mb-2 text-text-muted" />
          <p className="text-sm text-text-muted">
            Saved tracks appear here
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[200px] overflow-auto">
          {savedTracks.map((track) => {
            const isPlaying = currentPlayingTrackId === track.id
            
            return (
              <div
                key={track.id}
                className={cn(
                  "flex items-center gap-2 p-2 rounded-md border transition-colors",
                  isPlaying 
                    ? "bg-accent/10 border-accent" 
                    : "bg-surface border-border hover:border-border"
                )}
              >
                <Button
                  size="icon"
                  variant={isPlaying ? "accent" : "ghost"}
                  onClick={() => handlePlay(track)}
                  className="h-8 w-8 shrink-0"
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                </Button>

                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{track.name}</p>
                  <p className="text-xs text-text-muted">
                    {formatDate(track.createdAt)}
                    {isPlaying && ` • ${formatTime(playbackTime)}`}
                  </p>
                </div>

                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => removeSavedTrack(track.id)}
                  className="h-7 w-7 shrink-0 opacity-50 hover:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
