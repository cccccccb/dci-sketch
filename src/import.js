import sketch from 'sketch'
// documentation: https://developer.sketchapp.com/reference/api/

var Document = require('sketch/dom')
var UI = require('sketch/ui')

const ArtboardWidth = 256
const ArtboardHeight = 256
const ArtboardPadding = 40
const LightBGColor = '#f0f0f0'
const DarkBGColor = '#1f1f1f'
const GenericBGColor = '#e0e0e0'

export function OnOpen() {
    sketch.UI.message("Open")
}
export function OnCreateText() {
    createIconForType("Text")
}
export function OnCreateAction() {
    createIconForType("Action")
}
export function OnCreateIcon() {
    createIconForType("Icon")
}
export function OnCreateBackground() {
    var currentDoc = Document.getSelectedDocument()
    if (!currentDoc)
        UI.alert("No Document", "Please select a document")
    var layers = currentDoc.selectedLayers
    if (!layers || layers.layers.length == 0)
        UI.alert("No artboard", "Please select the artboard")
    layers = layers.layers
    for (const artboard of layers) {
        if (artboard.type != 'Artboard')
            continue
        // check for DCI format
        if (!artboard.name.startsWith("D."))
            continue
        const artboardName = artboard.name + ".Background"
        var newGeometry = new Document.Rectangle(artboard.frame.x + ArtboardPadding,
            artboard.frame.y + ArtboardPadding, artboard.frame.width, artboard.frame.height)
        // add offset
        createArtboard(artboard.parent, artboardName, newGeometry, artboard.background.color)
    }
}
export function OnRename() {
    var currentDoc = Document.getSelectedDocument()
    if (!currentDoc)
        UI.alert("No Document", "Please select a document")
    var layers = currentDoc.selectedLayers
    if (!layers || layers.layers.length === 0)
        UI.alert("No artboard", "Please select the artboard")
    var newName = UI.getStringFromUser("What's the icon new name?", "")
    if (newName == "") {
        return
    }
    layers = layers.layers
    for (var artboard of layers) {
        if (artboard.type != 'Artboard')
            continue
        // check for DCI format
        if (!artboard.name.startsWith("D."))
            continue
        // rename
        var name_sections = artboard.name.split(".")
        name_sections[1] = newName
        artboard.name = name_sections.join(".")
    }
}

function createIconForType(type) {
    if (!getAndCheckCurrentPage())
        return
    var options = getIconOptionsFromUser()
    if (!options)
        return

    newIconToCurrentPage(options.name, type, options.colorSensitive)
}

function getAndCheckCurrentPage() {
    var currentDoc = Document.getSelectedDocument()
    if (!currentDoc)
        UI.alert("No Document", "Please select a document")

    var currentPage = currentDoc.selectedPage

    if (!currentPage)
        UI.alert("No Page", "Please select a page")
    return currentPage
}

function getIconOptionsFromUser() {
    // Get the icon name form user
    var name = UI.getStringFromUser("What's the icon name?", "")
    if (name == "") {
        UI.message("The icon create request is cancelled")
        return
    }

    var options = ['Color Sensitive', 'Color Insensitive']
    var selection = UI.getSelectionFromUser("Is a color sensitive icon?", options)
    if (!selection[2])
        return

    return {name: name, colorSensitive: selection[1] === 0}
}

function createArtboardOfIcon(page, name, type, mode, bgColor) {
    const artboardName = 'D.' + name + "." + type + "." + mode

    var artboard = createArtboard(page, artboardName, new Document.Rectangle(0, 0, ArtboardWidth, ArtboardHeight), bgColor)
    return artboard
}

function createIconGroup(page, iconName, iconType, bgColor, initPos) {
    var normal = createArtboardOfIcon(page, iconName, iconType, "Normal", bgColor)
    normal.frame.x = initPos.x
    normal.frame.y = initPos.y

    var hover = createArtboardOfIcon(page, iconName, iconType, "Hover", bgColor)
    alignAtArtboard(hover, normal, 'right')

    var pressed = createArtboardOfIcon(page, iconName, iconType, "Pressed", bgColor)
    alignAtArtboard(pressed, hover, 'right')

    var disabled = createArtboardOfIcon(page, iconName, iconType, "Disabled", bgColor)
    alignAtArtboard(disabled, pressed, 'right')

    return [normal, hover, pressed, disabled]
}

function newIconToCurrentPage(iconName, iconType, colorSensitive) {
    var currentPage = getAndCheckCurrentPage()
    const rightEdget = getPageRightEdge(currentPage)
    var artboardList

    if (colorSensitive) {
        artboardList = createIconGroup(currentPage, iconName, iconType, LightBGColor, {"x": rightEdget + ArtboardPadding, "y": 20})
        artboardList = createIconGroup(currentPage, iconName, iconType, DarkBGColor, {"x": rightEdget + ArtboardPadding, "y": 20 + ArtboardHeight + ArtboardPadding})
    } else {
        artboardList = createIconGroup(currentPage, iconName, iconType, GenericBGColor, {"x": rightEdget + ArtboardPadding, "y": 20})
    }

    // view to center for artboard list of icon
    Document.getSelectedDocument().centerOnLayer(artboardList[1])
}

function alignAtArtboard(source, target, position) {
    if (position === 'right') {
        source.frame.x = target.frame.x + target.frame.width + ArtboardPadding
        source.frame.y = target.frame.y
    } else if (position === 'bottom') {
        source.frame.y = target.frame.y + target.frame.height + ArtboardPadding
        source.frame.x = target.frame.x
    }
}

function createArtboard(parent, name, rect, color) {
    var artboard = new Document.Artboard({
        name: name,
        parent: parent,
        frame: rect,
        flowStartPoint: false
    })

    artboard.background.enabled = true
    artboard.background.includedInExport = false
    artboard.background.color = color

    return artboard
}

function getPageRightEdge(page) {
    var right = 0
    for (const layer of page.layers) {
        if (layer.frame.x + layer.frame.width > right)
            right = layer.frame.x + layer.frame.width
    }
    return right
}
