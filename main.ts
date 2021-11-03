import {app, BrowserWindow, dialog, globalShortcut, ipcMain, shell} from "electron"
import Store from "electron-store"
import {autoUpdater} from "electron-updater"
import * as localShortcut from "electron-shortcuts"
import fs from "fs"
import imageSize from "image-size"
import path from "path"
import process from "process"
import "./dev-app-update.yml"
import pack from "./package.json"
import functions from "./structures/functions"
import imagemin from "imagemin"
import imageminMozjpeg from "imagemin-mozjpeg"
import imageminGifsicle from "imagemin-gifsicle"
import imageminWebp from "imagemin-webp"
import imageminPngquant from "imagemin-pngquant"
import phash from "sharp-phash"
import dist from "sharp-phash/distance"
import sharp from "sharp"

process.setMaxListeners(0)
let window: Electron.BrowserWindow | null
autoUpdater.autoDownload = false
const store = new Store()

const history: Array<{id: number, source: string, dest?: string}> = []
const active: Array<{id: number, source: string, dest: string, action: null | "stop"}> = []
const queue: Array<{started: boolean, info: any}> = []

ipcMain.handle("on-drop", async (event, files: any) => {
  window?.webContents.send("on-drop", files)
})

const getDimensions = (path: string) => {
  const dimensions = imageSize(path)
  return {width: dimensions.width ?? 0, height: dimensions.height ?? 0}
}

ipcMain.handle("get-dimensions", async (event, path: string) => {
  return getDimensions(path)
})

ipcMain.handle("delete-duplicates", async () => {
  const hashMap = new Map()
  for (let i = 0; i < history.length; i++) {
    const source = history[i].source
    if (fs.existsSync(source)) {
      const hash = await phash(fs.readFileSync(source))
      let dupeArray = []
      let found = false
      hashMap.forEach((value, key) => {
        if (dist(key, hash) < 5) {
          dupeArray = functions.removeDuplicates([...value, source])
          hashMap.set(key, dupeArray)
          found = true
        }
      })
      if (!found) {
        dupeArray = [source]
        hashMap.set(hash, dupeArray)
      }
    }
  }
  hashMap.forEach(async (value: string[]) => {
    if (value.length > 1) {
      let arr = []
      for (let i = 0; i < value.length; i++) {
        const {width, height} = getDimensions(value[i])
        const id = history.find((h) => h.source === value[i])?.id
        arr.push({id, width, height, source: value[i]})
      }
      arr = arr.sort((a, b) => a.width - b.width)
      while (arr.length > 1) {
        const val = arr.shift()
        let counter = 1
        let error = true
        while (error && counter < 20) {
          await functions.timeout(100)
          try {
            fs.unlinkSync(val?.source!)
            error = false
          } catch {
            // ignore
          }
          counter++
        }
        window?.webContents.send("deleted-source", {id: val?.id})
      }
    }
  })
})

ipcMain.handle("close-conversion", async (event, id: number) => {
  let index = history.findIndex((h) => h.id === id)
  if (index !== -1) history.splice(index, 1)
})

ipcMain.handle("delete-conversion", async (event, id: number) => {
  let dest = ""
  let source = ""
  let index = active.findIndex((a) => a.id === id)
  if (index !== -1) {
    active[index].action = "stop"
    dest = active[index].dest
    source = active[index].source
  } else {
    index = history.findIndex((a) => a.id === id)
    if (index !== -1) {
      dest = history[index].dest as string
      source = history[index].source
    }
  }
  if (dest) {
      let counter = 1
      let error = true
      while (error && counter < 20) {
        await functions.timeout(100)
        try {
          fs.unlinkSync(dest)
          error = false
        } catch {
          // ignore
        }
        counter++
      }
    return true
  }
  return false
})

const nextQueue = async (info: any) => {
  const index = active.findIndex((a) => a.id === info.id)
  if (index !== -1) active.splice(index, 1)
  const settings = store.get("settings", {}) as any
  let qIndex = queue.findIndex((q) => q.info.id === info.id)
  if (qIndex !== -1) {
    queue.splice(qIndex, 1)
    let concurrent = Number(settings?.queue)
    if (Number.isNaN(concurrent) || concurrent < 1) concurrent = 1
    if (active.length < concurrent) {
      const next = queue.find((q) => !q.started)
      if (next) {
        await compress(next.info)
      }
    }
  }
}

const compress = async (info: any) => {
  let qIndex = queue.findIndex((q) => q.info.id === info.id)
  if (qIndex !== -1) queue[qIndex].started = true
  const options = {
    quality: Number(info.quality),
    overwrite: info.overwrite,
    ignoreBelow: info.ignoreBelow,
    resizeWidth: Number(info.resizeWidth),
    resizeHeight: Number(info.resizeHeight),
    percentage: info.percentage,
    keepRatio: info.keepRatio,
    rename: info.rename,
    format: info.format
  }
  window?.webContents.send("conversion-started", {id: info.id})
  const fileSize = functions.parseFileSize(info.fileSize)
  const ignoredSize = functions.parseFileSize(options.ignoreBelow)
  if (fileSize < ignoredSize) {
    window?.webContents.send("conversion-finished", {id: info.id, output: info.source, skipped: true})
    return nextQueue(info)
  }
  const {width, height} = functions.parseNewDimensions(info.width, info.height, options.resizeWidth, options.resizeHeight, options.percentage, options.keepRatio)
  if (!fs.existsSync(info.dest)) fs.mkdirSync(info.dest, {recursive: true})
  let dest = await functions.parseDest(info.source, info.dest, options.rename, options.format, width, height, options.overwrite)
  const historyIndex = history.findIndex((h) => h.id === info.id)
  if (historyIndex !== -1) history[historyIndex].dest = dest
  active.push({id: info.id, source: info.source, dest, action: null})
  let output = ""
  let buffer = null
  try {
    const ext = path.extname(dest).replaceAll(".", "")
    if (ext === "gif") {
      const condition = options.keepRatio ? (options.percentage ? options.resizeWidth !== 100 : true) : (options.percentage ? (options.resizeWidth !== 100 && options.resizeHeight !== 100) : true)
      if (condition) {
        const {frameArray, delayArray} = await functions.getGIFFrames(info.source)
        const newFrameArray = [] as Buffer[]
        for (let i = 0; i < frameArray.length; i++) {
          const newFrame = await sharp(frameArray[i])
          .resize(width, height, {fit: "fill"})
          .toBuffer()
          newFrameArray.push(newFrame)
        }
        buffer = await functions.encodeGIF(newFrameArray, delayArray, width, height)
        buffer = await imagemin.buffer(buffer, {plugins: [
          imageminGifsicle({optimizationLevel: 3})
        ]})
      } else {
        buffer = await imagemin([info.source], {plugins: [
          imageminGifsicle({optimizationLevel: 3})
        ]}).then((i: any) => i[0].data)
      }
    } else {
      let s = sharp(info.source, {animated: true}).resize(width, height, {fit: "fill"})
      if (ext === "jpg" || ext === "jpeg") s.jpeg()
      if (ext === "png") s.png()
      if (ext === "webp") s.webp()
      if (ext === "gif") s.gif()
      buffer = await s.toBuffer()
      buffer = await imagemin.buffer(buffer, {plugins: [
        imageminMozjpeg({quality: options.quality}),
        imageminPngquant(),
        imageminWebp({quality: options.quality}),
        imageminGifsicle({optimizationLevel: 3})
      ]})
    }
    fs.writeFileSync(options.overwrite ? info.source : dest, buffer)
    if (options.overwrite) {
      fs.renameSync(info.source, dest)
    }
    output = dest
  } catch (e) {
    console.log(e)
    window?.webContents.send("conversion-finished", {id: info.id, output: info.source, skipped: true})
    return nextQueue(info)
  }
  window?.webContents.send("conversion-finished", {id: info.id, output, buffer, fileSize: Buffer.byteLength(buffer)})
  nextQueue(info)
}

ipcMain.handle("compress", async (event, info: any, startAll: boolean) => {
  const qIndex = queue.findIndex((q) => q.info.id === info.id)
  if (qIndex === -1) queue.push({info, started: false})
  if (startAll) {
    const settings = store.get("settings", {}) as any
    let concurrent = Number(settings?.queue)
    if (Number.isNaN(concurrent) || concurrent < 1) concurrent = 1
    if (active.length < concurrent) {
      await compress(info)
    }
  } else {
    await compress(info)
  }
})

ipcMain.handle("compress-realtime", async (event, info: any) => {
  const options = {
    quality: Number(info.quality),
    overwrite: info.overwrite,
    ignoreBelow: info.ignoreBelow,
    resizeWidth: Number(info.resizeWidth),
    resizeHeight: Number(info.resizeHeight),
    percentage: info.percentage,
    keepRatio: info.keepRatio,
    rename: info.rename,
    format: info.format
  }
  const fileSize = functions.parseFileSize(info.fileSize)
  const ignoredSize = functions.parseFileSize(options.ignoreBelow)
  if (fileSize < ignoredSize) {
    return {buffer: info.source, fileSize}
  }
  const {width, height} = functions.parseNewDimensions(info.width, info.height, options.resizeWidth, options.resizeHeight, options.percentage, options.keepRatio)
  const dest = await functions.parseDest(info.source, info.dest, "{name}", options.format, width, height, options.overwrite)
  try {
    const ext = path.extname(dest).replaceAll(".", "")
    let buffer = null
    if (ext === "gif") {
      const condition = options.keepRatio ? (options.percentage ? options.resizeWidth !== 100 : true) : (options.percentage ? (options.resizeWidth !== 100 && options.resizeHeight !== 100) : true)
      if (condition) {
        const {frameArray, delayArray} = await functions.getGIFFrames(info.source)
        const newFrameArray = [] as Buffer[]
        for (let i = 0; i < frameArray.length; i++) {
          const newFrame = await sharp(frameArray[i])
          .resize(width, height, {fit: "fill"})
          .toBuffer()
          newFrameArray.push(newFrame)
        }
        buffer = await functions.encodeGIF(newFrameArray, delayArray, width, height)
        buffer = await imagemin.buffer(buffer, {plugins: [
          imageminGifsicle({optimizationLevel: 3})
        ]})
      } else {
        buffer = await imagemin([info.source], {plugins: [
          imageminGifsicle({optimizationLevel: 3})
        ]}).then((i: any) => i[0].data)
      }
    } else {
      let s = sharp(info.source, {animated: true}).resize(width, height, {fit: "fill"})
      if (ext === "jpg" || ext === "jpeg") s.jpeg()
      if (ext === "png") s.png()
      if (ext === "webp") s.webp()
      if (ext === "gif") s.gif()
      buffer = await s.toBuffer()
      buffer = await imagemin.buffer(buffer, {plugins: [
        imageminMozjpeg({quality: options.quality}),
        imageminPngquant(),
        imageminWebp({quality: options.quality}),
        imageminGifsicle({optimizationLevel: 3})
      ]})
    }
    return {buffer, fileSize: Buffer.byteLength(buffer)}
  } catch {
    return {buffer: info.source, fileSize}
  }
})

ipcMain.handle("update-concurrency", async (event, concurrent) => {
  if (Number.isNaN(concurrent) || concurrent < 1) concurrent = 1
  let counter = active.length
  while (counter < concurrent) {
    const next = queue.find((q) => !q.started)
    if (next) {
      counter++
      await compress(next.info)
    } else {
      break
    }
  }
})


ipcMain.handle("move-queue", async (event, id: number) => {
  const settings = store.get("settings", {}) as any
  let concurrent = Number(settings?.queue)
  if (Number.isNaN(concurrent) || concurrent < 1) concurrent = 1
  if (id) {
    let qIndex = queue.findIndex((q) => q.info.id === id)
    if (qIndex !== -1) queue.splice(qIndex, 1)
  }
  if (active.length < concurrent) {
    const next = queue.find((q) => !q.started)
    if (next) {
      await compress(next.info)
    }
  }
})

ipcMain.handle("update-color", (event, color: string) => {
  window?.webContents.send("update-color", color)
})

ipcMain.handle("init-settings", () => {
  return store.get("settings", null)
})

ipcMain.handle("store-settings", (event, settings) => {
  const prev = store.get("settings", {}) as object
  store.set("settings", {...prev, ...settings})
})

ipcMain.handle("get-theme", () => {
  return store.get("theme", "light")
})

ipcMain.handle("save-theme", (event, theme: string) => {
  store.set("theme", theme)
})

ipcMain.handle("install-update", async (event) => {
  await autoUpdater.downloadUpdate()
  autoUpdater.quitAndInstall()
})

ipcMain.handle("check-for-updates", async (event, startup: boolean) => {
  window?.webContents.send("close-all-dialogs", "version")
  const update = await autoUpdater.checkForUpdates()
  const newVersion = update.updateInfo.version
  if (pack.version === newVersion) {
    if (!startup) window?.webContents.send("show-version-dialog", null)
  } else {
    window?.webContents.send("show-version-dialog", newVersion)
  }
})

ipcMain.handle("open-location", async (event, location: string) => {
  if (!fs.existsSync(location)) return
  if (fs.statSync(location).isDirectory()) {
    shell.openPath(path.normalize(location))
  } else {
    shell.showItemInFolder(path.normalize(location))
  }
})

ipcMain.handle("start-all", () => {
  window?.webContents.send("start-all")
})

ipcMain.handle("clear-all", () => {
  window?.webContents.send("clear-all")
})

ipcMain.handle("add-files", (event, files: string[], identifers: number[]) => {
  for (let i = 0; i < files.length; i++) {
    history.push({id: identifers[i], source: files[i]})
  }
  window?.webContents.send("add-files", files, identifers)
})

ipcMain.handle("add-file-id", (event, file: string, pos: number, id: number) => {
    history.push({id, source: file})
    window?.webContents.send("add-file-id", file, pos, id)
})

ipcMain.handle("add-file", (event, file: string, pos: number) => {
    window?.webContents.send("add-file", file, pos)
})

ipcMain.handle("select-files", async () => {
  if (!window) return
  const files = await dialog.showOpenDialog(window, {
    filters: [
      {name: "All Files", extensions: ["*"]},
      {name: "Images", extensions: ["png", "jpg", "jpeg", "webp"]},
      {name: "GIF", extensions: ["gif"]}
    ],
    properties: ["multiSelections", "openFile"]
  })
  return files.filePaths
})

ipcMain.handle("get-downloads-folder", async () => {
  if (store.has("downloads")) {
    return store.get("downloads")
  } else {
    const downloads = app.getPath("downloads")
    store.set("downloads", downloads)
    return downloads
  }
})

ipcMain.handle("select-directory", async (event, dir: string) => {
  if (!window) return
  if (dir === undefined) {
    const result = await dialog.showOpenDialog(window, {
      properties: ["openDirectory"]
    })
    dir = result.filePaths[0]
  }
  if (dir) {
    store.set("downloads", dir)
    return dir
  }
})

const singleLock = app.requestSingleInstanceLock()

if (!singleLock) {
  app.quit()
} else {
  app.on("second-instance", () => {
    if (window) {
      if (window.isMinimized()) window.restore()
      window.focus()
    }
  })

  app.on("ready", () => {
    window = new BrowserWindow({width: 800, height: 600, minWidth: 720, minHeight: 450, frame: false, backgroundColor: "#e14952", center: true, webPreferences: {nodeIntegration: true, contextIsolation: false, enableRemoteModule: true}})
    window.loadFile(path.join(__dirname, "index.html"))
    window.removeMenu()
    window.on("closed", () => {
      window = null
    })
    localShortcut.register("Ctrl+O", () => {
      window?.webContents.send("upload")
    }, window, {strict: true})
    globalShortcut.register("Control+Shift+I", () => {
      window?.webContents.toggleDevTools()
    })
    if (process.env.DEVELOPMENT === "true") {
    }
  })
}

app.allowRendererProcessReuse = false
