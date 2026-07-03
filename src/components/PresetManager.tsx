import { useState } from "react"
import { Save, Trash2, FolderOpen } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select"
import { useAppStore, type Preset } from "@/stores/app-store"
import { useSettings } from "@/hooks/useSettings"
import { generateId } from "@/lib/utils"

export function PresetManager() {
  const {
    presets,
    activePresetId,
    loadPreset,
    getCurrentSettings,
  } = useAppStore()

  const { savePreset, deletePreset } = useSettings()

  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [presetName, setPresetName] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const handleLoadPreset = (presetId: string) => {
    const preset = presets.find((p) => p.id === presetId)
    if (preset) {
      loadPreset(preset)
    }
  }

  const handleSavePreset = async () => {
    if (!presetName.trim()) return

    setIsSaving(true)

    try {
      const settings = getCurrentSettings()
      const preset: Preset = {
        id: activePresetId || generateId(),
        name: presetName,
        ...settings,
      }

      await savePreset(preset)
      setSaveDialogOpen(false)
      setPresetName("")
    } catch (err) {
      console.error("Failed to save preset:", err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeletePreset = async (presetId: string) => {
    try {
      await deletePreset(presetId)
    } catch (err) {
      console.error("Failed to delete preset:", err)
    }
  }

  const openSaveDialog = () => {
    const activePreset = presets.find((p) => p.id === activePresetId)
    setPresetName(activePreset?.name || "")
    setSaveDialogOpen(true)
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        value={activePresetId || ""}
        onValueChange={handleLoadPreset}
      >
        <SelectTrigger className="w-[180px]">
          <FolderOpen className="w-4 h-4 mr-2 opacity-50" />
          <SelectValue placeholder="Load Preset" />
        </SelectTrigger>
        <SelectContent>
          {presets.length === 0 ? (
            <div className="px-3 py-2 text-sm text-text-muted">
              No presets saved
            </div>
          ) : (
            presets.map((preset) => (
              <div
                key={preset.id}
                className="flex items-center justify-between pr-2"
              >
                <SelectItem value={preset.id} className="flex-1">
                  {preset.name}
                </SelectItem>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeletePreset(preset.id)
                  }}
                >
                  <Trash2 className="w-3 h-3 text-error" />
                </Button>
              </div>
            ))
          )}
        </SelectContent>
      </Select>

      <Button size="icon" variant="ghost" onClick={openSaveDialog}>
        <Save className="w-4 h-4" />
      </Button>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Save Preset</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <Input
              placeholder="Preset name"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSavePreset()
              }}
            />

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setSaveDialogOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="accent"
                onClick={handleSavePreset}
                disabled={!presetName.trim() || isSaving}
                className="flex-1"
              >
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
