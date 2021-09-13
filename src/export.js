import sketch from 'sketch'
// documentation: https://developer.sketchapp.com/reference/api/

export function OnExportIcon() {
    sketch.UI.message("Export Icon")
}

export function OnExportPage() {
    sketch.UI.message("Export Page")
}

export function OnExportAll() {
    sketch.UI.message("Export All")
}
