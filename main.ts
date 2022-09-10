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
// @ts-ignore
import Helvetica from "pdfkit/js/data/Helvetica.afm"
import PDFDocument from "pdfkit"
import child_process from "child_process"
import mkvExtractor from "mkv-subtitle-extractor"
import srt2vtt from "srt-to-vtt"

import util from "util"

const exec = util.promisify(child_process.exec)

require("@electron/remote/main").initialize()
process.setMaxListeners(0)
let window: Electron.BrowserWindow | null
let preview: Electron.BrowserWindow | null
let popplerPath = undefined as any
if (process.platform === "darwin") popplerPath = path.join(app.getAppPath(), "../../poppler/mac/bin/pdfimages")
if (process.platform === "win32") popplerPath = path.join(app.getAppPath(), "../../poppler/windows/bin/pdfimages.exe") 
if (!fs.existsSync(popplerPath)) popplerPath = undefined
autoUpdater.autoDownload = false
const store = new Store()

const history: Array<{id: number, source: string, dest?: string}> = []
const active: Array<{id: number, source: string, dest: string, action: null | "stop"}> = []
const queue: Array<{started: boolean, info: any}> = []

if (!fs.existsSync(path.join(__dirname, "data"))) fs.mkdirSync(path.join(__dirname, "data"))
fs.writeFileSync(path.join(__dirname, "data/Helvetica.afm"), Helvetica)

const srtToVtt = async (subtitles: string[]) => {
  for (let i = 0; i < subtitles.length; i++) {
    await new Promise<void>((resolve, reject) => {
      const readStream =  fs.createReadStream(subtitles[i]).pipe(srt2vtt())
      const writeStream = fs.createWriteStream(`${path.dirname(subtitles[i])}/${path.basename(subtitles[i], path.extname(subtitles[i]))}.vtt`)
      readStream.pipe(writeStream)
          .on("end", () => resolve())
          .on("finish", () => resolve())
    })
  }

  const promiseArray: any[] = []
  for (let i = 0; i < subtitles.length; i++) {
    promiseArray.push(new Promise<void>((resolve) => {
      fs.unlink(subtitles[i], () => resolve())
    }))
  }
  await Promise.all(promiseArray)
}

const extractSubtitles = async (videos: string[]) => {
  for (let i = 0; i < videos.length; i++) {
    await mkvExtractor(videos[i])
  }

  const promiseArray: any[] = []
  for (let i = 0; i < videos.length; i++) {
    promiseArray.push(new Promise<void>((resolve) => {
      fs.unlink(videos[i], () => resolve())
    }))
  }

  await Promise.all(promiseArray)
}

ipcMain.handle("extract-subtitles", async (event, files: string[]) => {
  const directories = files.filter((f) => fs.lstatSync(f).isDirectory())
  const videos = files.filter((f) => path.extname(f).toLowerCase() === ".mkv")
  const subtitles = files.filter((f) => path.extname(f).toLowerCase() === ".srt")

  let openDir = ""

  for (let i = 0; i < directories.length; i++) {
    const dir = directories[i]
    let files = fs.readdirSync(dir).map((i) => path.join(dir, i))
    let videos = files.filter((f) => path.extname(f).toLowerCase() === ".mkv")
    let subs = files.filter((f) => path.extname(f).toLowerCase() === ".srt")
    if (videos.length) {
      await extractSubtitles(videos)
      let files = fs.readdirSync(dir).map((i) => path.join(dir, i))
      let subs = files.filter((f) => path.extname(f).toLowerCase() === ".srt")
      await srtToVtt(subs)
    }
    if (subs.length) {
      await srtToVtt(subs)
    }
    try {
      fs.rmdirSync(dir)
    } catch (e) {
      console.log(e)
    }
    if (!openDir) openDir = directories[0]
  }

  if (videos.length) {
    await extractSubtitles(videos)
    let subs = fs.readdirSync(path.dirname(videos[0])).map((i) => path.join(path.dirname(videos[0]), i))
    subs = subs.filter((f) => path.extname(f).toLowerCase() === ".srt")
    await srtToVtt(subs)
    if (!openDir) openDir = videos[0]
  }

  if (subtitles.length) {
    await srtToVtt(subtitles)
    if (!openDir) openDir = subtitles[0]
  }
  shell.openPath(path.dirname(openDir))
})

ipcMain.handle("rename", async (event, files: string[]) => {
  const directoryName = path.basename(path.dirname(files[0]))

  const fileNames = files.map((f) => path.basename(f, path.extname(f)))

  let renamed = false 
  for (let i = 0; i < fileNames.length; i++) {
    const regex = new RegExp(`(?<=${directoryName}) (.*?) (?=.)`, "gi")
    const bit = fileNames[i].match(regex)?.[0].trim()
    if (!bit) continue
    let newFilename = ""
    if (/\d+/.test(bit)) {
      newFilename = `${directoryName} ${Number(bit.match(/\d+/)?.[0])}`
    } else {
      let badBit = false
      for (let j = 0; j < fileNames.length; j++) {
        const testBit = fileNames[j].match(regex)?.[0].trim()
        if (`${directoryName} ${bit}` === `${directoryName} ${testBit}`) badBit = true
      }
      if (badBit) break
      newFilename = `${directoryName} ${bit}`
    }
    const newPath = path.join(path.dirname(files[i]), `${newFilename}${path.extname(files[i])}`)
    fs.renameSync(files[i], newPath)
    renamed = true
  }

  if (!renamed) {
    files = files.sort(new Intl.Collator(undefined, {numeric: true, sensitivity: "base"}).compare)
    for (let i = 0; i < files.length; i++) {
      const newPath = path.join(path.dirname(files[i]), `${directoryName} ${i + 1}${path.extname(files[i])}`)
      fs.renameSync(files[i], newPath)
    }
  }
  shell.openPath(path.dirname(files[0]))
})

const extractCover = async (dir: string, images: string[]) => {
  images = images.sort(new Intl.Collator(undefined, {numeric: true, sensitivity: "base"}).compare)
  fs.writeFileSync(`${path.dirname(dir)}/${path.basename(dir, path.extname(dir))}.jpg`, fs.readFileSync(images[0]))

  const promiseArray: any[] = []
  for (let i = 0; i < images.length; i++) {
    promiseArray.push(new Promise<void>((resolve) => {
      fs.unlink(images[i], () => resolve())
    }))
  }

  await Promise.all(promiseArray)
}

const createPDF = async (dir: string, images: string[]) => {
  images = images.sort(new Intl.Collator(undefined, {numeric: true, sensitivity: "base"}).compare)
  const pdf = new PDFDocument({autoFirstPage: false})

  pdf.pipe(fs.createWriteStream(`${path.dirname(dir)}/${path.basename(dir, path.extname(dir))}.pdf`))
  
  for (let i = 0; i < images.length; i++) {
    const image = pdf.openImage(images[i])
    pdf.addPage({size: [image.width, image.height]})
    pdf.image(image, 0, 0)
  }

  const promiseArray: any[] = []
  for (let i = 0; i < images.length; i++) {
    promiseArray.push(new Promise<void>((resolve) => {
      fs.unlink(images[i], () => resolve())
    }))
  }

  await Promise.all(promiseArray)

  pdf.end()
}

ipcMain.handle("pdf-cover", async (event, files: string[]) => {
  const directories = files.filter((f) => fs.lstatSync(f).isDirectory())
  const PDFs = files.filter((f) => path.extname(f) === ".pdf")
  const images = files.filter((f) => path.extname(f).toLowerCase() === ".jpg" || path.extname(f).toLowerCase() === ".png" || path.extname(f).toLowerCase() === ".jpeg")

  let openDir = ""

  for (let i = 0; i < directories.length; i++) {
    const dir = directories[i]
    let images = fs.readdirSync(dir).map((i) => path.join(dir, i))
    images = images.filter((f) => path.extname(f).toLowerCase() === ".jpg" || path.extname(f).toLowerCase() === ".png" || path.extname(f).toLowerCase() === ".jpeg")
    await extractCover(dir, images)
    try {
      fs.rmdirSync(dir)
    } catch (e) {
      console.log(e)
    }
    if (!openDir) openDir = directories[0]
  }

  for (let i = 0; i < PDFs.length; i++) {
    const dir = path.dirname(PDFs[i])
    const saveFilename = path.basename(PDFs[i], path.extname(PDFs[i]))
    const savePath = path.join(dir, saveFilename)
    if (!fs.existsSync(savePath)) fs.mkdirSync(savePath)
    const pdfimages = popplerPath ? popplerPath : "pdfimages"
    exec(`cd "${savePath}" && "${pdfimages}" -png -j -q "${PDFs[i]}" "${saveFilename}"`)
    .then(async () => {
      fs.unlinkSync(PDFs[i])
      let images = fs.readdirSync(savePath).map((i) => path.join(savePath, i))
      images = images.filter((f) => path.extname(f).toLowerCase() === ".jpg" || path.extname(f).toLowerCase() === ".png" || path.extname(f).toLowerCase() === ".jpeg")
      await extractCover(savePath, images)
      try {
        fs.rmdirSync(savePath)
      } catch (e) {
        console.log(e)
      }
    })
    .catch((e) => window?.webContents.send("debug", e))
    if (!openDir) openDir = PDFs[0]
  }

  if (images.length) {
    await extractCover(images[0], images)
    if (!openDir) openDir = images[0]
  }
  shell.openPath(path.dirname(openDir))
})

ipcMain.handle("pdf", async (event, files: string[]) => {
  const directories = files.filter((f) => fs.lstatSync(f).isDirectory())
  const PDFs = files.filter((f) => path.extname(f) === ".pdf")
  const images = files.filter((f) => path.extname(f).toLowerCase() === ".jpg" || path.extname(f).toLowerCase() === ".png" || path.extname(f).toLowerCase() === ".jpeg")

  let openDir = ""

  for (let i = 0; i < directories.length; i++) {
    const dir = directories[i]
    let images = fs.readdirSync(dir).map((i) => path.join(dir, i))
    images = images.filter((f) => path.extname(f).toLowerCase() === ".jpg" || path.extname(f).toLowerCase() === ".png" || path.extname(f).toLowerCase() === ".jpeg")
    await createPDF(dir, images)
    try {
      fs.rmdirSync(dir)
    } catch (e) {
      console.log(e)
    }
    if (!openDir) openDir = directories[0]
  }

  for (let i = 0; i < PDFs.length; i++) {
    const dir = path.dirname(PDFs[i])
    const saveFilename = path.basename(PDFs[i], path.extname(PDFs[i]))
    const savePath = path.join(dir, saveFilename)
    if (!fs.existsSync(savePath)) fs.mkdirSync(savePath)
    const pdfimages = popplerPath ? popplerPath : "pdfimages"
    exec(`cd "${savePath}" && "${pdfimages}" -j -q "${PDFs[i]}" "${saveFilename}"`)
    .then(() => fs.unlinkSync(PDFs[i]))
    .catch((e) => window?.webContents.send("debug", e))
    if (!openDir) openDir = PDFs[0]
  }

  if (images.length) {
    await createPDF(images[0], images)
    if (!openDir) openDir = images[0]
  }
  shell.openPath(path.dirname(openDir))
})

ipcMain.handle("multi-open", async (event, type?: string) => {
  let title = "Convert or Extract PDF"
  let button = "Convert"
  if (type === "cover") title = "PDF or Image Directory Cover"
  if (type === "rename") {
    title = "Rename by Directory"
    button = "Rename"
  }
  if (type === "subs") {
    title = "Convert to VTT Subtitles"
    button = "Convert"
  }
  if (!window) return
  const result = await dialog.showOpenDialog(window, {
    properties: ["openFile", "openDirectory", "multiSelections"],
    buttonLabel: button,
    title
  })
  return result.filePaths
})

const subFiles = (directory: string) => {
  let files: string[] = []
  let directories: string[] = []
  let dirFiles = fs.readdirSync(directory).map((f) => `${directory}/${f}`)
  dirFiles = dirFiles.sort(new Intl.Collator(undefined, {numeric: true, sensitivity: "base"}).compare)
  for (let i = 0; i < dirFiles.length; i++) {
    if (fs.lstatSync(dirFiles[i]).isDirectory()) {
      directories.push(dirFiles[i])
      const sub = subFiles(dirFiles[i])
      files.push(...sub.files)
      directories.push(...sub.directories)
    } else {
      files.push(dirFiles[i])
    }
  }
  return {files, directories}
}

ipcMain.handle("flatten", async (event, directory: string) => {
  const {files, directories} = subFiles(directory)
  let conflict = false 
  loop1:
  for (let i = 0; i < files.length; i++) {
    let newName = path.basename(files[i])
    for (let j = 0; j < files.length; j++) { 
      if (`${path.dirname(files[i])}/${path.basename(files[i])}` === `${path.dirname(files[j])}/${path.basename(files[j])}`) continue
      let checkName = path.basename(files[j])
      if (newName === checkName) {
        conflict = true
        break loop1
      }
    }
  }
  let renameIndex = 0
  for (let i = 0; i < files.length; i++) {
    let newName = `${directory}/${path.basename(files[i])}`
    if (conflict) newName = `${directory}/${renameIndex}_${path.basename(files[i])}`
    fs.renameSync(files[i], newName)
    renameIndex++
  }
  for (let i = 0; i < directories.length; i++) {
    fs.rmdirSync(directories[i])
  }
  shell.openPath(directory)
})

ipcMain.handle("flatten-directory", async () => {
  if (!window) return
  const result = await dialog.showOpenDialog(window, {
    properties: ["openDirectory"],
    buttonLabel: "Flatten",
    title: "Flatten Directory"
  })
  return result.filePaths[0]
})

ipcMain.handle("zoom-out", () => {
  preview?.webContents.send("zoom-out")
})

ipcMain.handle("zoom-in", () => {
  preview?.webContents.send("zoom-in")
})

const openPreview = async () => {
  if (!preview) {
    preview = new BrowserWindow({width: 800, height: 600, minWidth: 720, minHeight: 450, frame: false, backgroundColor: "#181818", center: false, webPreferences: {nodeIntegration: true, contextIsolation: false, enableRemoteModule: true}})
    await preview.loadFile(path.join(__dirname, "preview.html"))
    require("@electron/remote/main").enable(preview.webContents)
    preview?.on("closed", () => {
      preview = null
    })
  } else {
    if (preview.isMinimized()) preview.restore()
    preview.focus()
  }
}

ipcMain.handle("preview-realtime", async (event, info: any) => {
  preview?.webContents.send("update-buffer-realtime", info)
})

ipcMain.handle("preview", async (event, info: any) => {
  await openPreview()
  preview?.webContents.send("update-buffer", info)
})

ipcMain.handle("on-drop", async (event, files: any) => {
  window?.webContents.send("on-drop", files)
})

const getDimensions = (path: string) => {
  try {
    const dimensions = imageSize(path)
    return {width: dimensions.width ?? 0, height: dimensions.height ?? 0}
  } catch {
    return {width: 0, height: 0}
  }
}

ipcMain.handle("get-dimensions", async (event, path: string) => {
  return getDimensions(path)
})

ipcMain.handle("delete-duplicates", async () => {
  const hashMap = new Map()
  for (let i = 0; i < history.length; i++) {
    const source = history[i].source
    if (fs.existsSync(source)) {
      try {
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
      } catch {
        continue
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
    let concurrent = 1 // Number(settings?.queue)
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
  const activeIndex = active.findIndex((a) => a.id === info.id)
  if (activeIndex !== -1) active[activeIndex].dest = dest
  let output = ""
  let buffer = fs.readFileSync(info.source)
  try {
    const sourceExt = path.extname(info.source).replaceAll(".", "")
    const ext = path.extname(dest).replaceAll(".", "")
    const resizeCondition = options.keepRatio ? (options.percentage ? options.resizeWidth !== 100 : true) : (options.percentage ? (options.resizeWidth !== 100 && options.resizeHeight !== 100) : true)
    if (ext === "gif") {
      if (resizeCondition) {
        const {frameArray, delayArray} = await functions.getGIFFrames(info.source)
        const newFrameArray = [] as Buffer[]
        for (let i = 0; i < frameArray.length; i++) {
          const newFrame = await sharp(frameArray[i])
          .resize(width, height, {fit: "fill"})
          .toBuffer()
          newFrameArray.push(newFrame)
        }
        buffer = await functions.encodeGIF(newFrameArray, delayArray, width, height)
        if (options.quality !== 100) {
          buffer = await imagemin.buffer(buffer, {plugins: [
            imageminGifsicle({optimizationLevel: 3})
          ]})
        }
      } else {
        if (options.quality !== 100) {
          buffer = await imagemin([info.source], {plugins: [
            imageminGifsicle({optimizationLevel: 3})
          ]}).then((i: any) => i[0].data)
        }
      }
    } else {
      if (resizeCondition) {
        buffer = await sharp(buffer, {animated: true}).resize(width, height, {fit: "fill"}).toBuffer()
      }
      if (sourceExt !== ext) {
        let s = sharp(buffer, {animated: true})
        if (ext === "jpg" || ext === "jpeg") s.jpeg()
        if (ext === "png") s.png()
        if (ext === "webp") s.webp()
        if (ext === "gif") s.gif()
        buffer = await s.toBuffer()
      }
      if (options.quality !== 100) {
        buffer = await imagemin.buffer(buffer, {plugins: [
          imageminMozjpeg({quality: options.quality}),
          imageminPngquant(),
          imageminWebp({quality: options.quality}),
          imageminGifsicle({optimizationLevel: 3})
        ]})
      }
    }
    fs.writeFileSync(options.overwrite ? info.source : dest, buffer)
    if (options.overwrite) {
      fs.renameSync(info.source, dest)
    }
    output = dest
    window?.webContents.send("conversion-finished", {id: info.id, output, buffer, fileSize: Buffer.byteLength(buffer)})
    return nextQueue(info)
  } catch (error) {
    console.log(error)
    window?.webContents.send("conversion-finished", {id: info.id, output: info.source, skipped: true})
    return nextQueue(info)
  }
}

ipcMain.handle("compress", async (event, info: any, startAll: boolean) => {
  const qIndex = queue.findIndex((q) => q.info.id === info.id)
  if (qIndex === -1) queue.push({info, started: false})
  if (startAll) {
    const settings = store.get("settings", {}) as any
    let concurrent = 1 // Number(settings?.queue)
    if (Number.isNaN(concurrent) || concurrent < 1) concurrent = 1
    if (active.length < concurrent) {
      active.push({id: info.id, source: info.source, dest: "", action: null})
      await compress(info)
    }
  } else {
    active.push({id: info.id, source: info.source, dest: "", action: null})
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
  let buffer = fs.readFileSync(info.source)
  try {
    const sourceExt = path.extname(info.source).replaceAll(".", "")
    const ext = path.extname(dest).replaceAll(".", "")
    const resizeCondition = options.keepRatio ? (options.percentage ? options.resizeWidth !== 100 : true) : (options.percentage ? (options.resizeWidth !== 100 && options.resizeHeight !== 100) : true)
    if (ext === "gif") {
      if (resizeCondition) {
        const {frameArray, delayArray} = await functions.getGIFFrames(info.source)
        const newFrameArray = [] as Buffer[]
        for (let i = 0; i < frameArray.length; i++) {
          const newFrame = await sharp(frameArray[i])
          .resize(width, height, {fit: "fill"})
          .toBuffer()
          newFrameArray.push(newFrame)
        }
        buffer = await functions.encodeGIF(newFrameArray, delayArray, width, height)
        if (options.quality !== 100) {
          buffer = await imagemin.buffer(buffer, {plugins: [
            imageminGifsicle({optimizationLevel: 3})
          ]})
        }
      } else {
        if (options.quality !== 100) {
          buffer = await imagemin([info.source], {plugins: [
            imageminGifsicle({optimizationLevel: 3})
          ]}).then((i: any) => i[0].data)
        }
      }
    } else {
      if (resizeCondition) {
        buffer = await sharp(buffer, {animated: true}).resize(width, height, {fit: "fill"}).toBuffer()
      }
      if (sourceExt !== ext) {
        let s = sharp(buffer, {animated: true})
        if (ext === "jpg" || ext === "jpeg") s.jpeg()
        if (ext === "png") s.png()
        if (ext === "webp") s.webp()
        if (ext === "gif") s.gif()
        buffer = await s.toBuffer()
      }
      if (options.quality !== 100) {
        buffer = await imagemin.buffer(buffer, {plugins: [
          imageminMozjpeg({quality: options.quality}),
          imageminPngquant(),
          imageminWebp({quality: options.quality}),
          imageminGifsicle({optimizationLevel: 3})
        ]})
      }
    }
    console.log(buffer)
    return {buffer, fileSize: Buffer.byteLength(buffer)}
  } catch (error) {
    console.log(error)
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
  let concurrent = 1 // Number(settings?.queue)
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
  if (process.platform === "darwin") {
    const update = await autoUpdater.checkForUpdates()
    const url = `${pack.repository.url}/releases/download/v${update.updateInfo.version}/${update.updateInfo.files[0].url}`
    await shell.openExternal(url)
    app.quit()
  } else {
    await autoUpdater.downloadUpdate()
    autoUpdater.quitAndInstall()
  }
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
      {name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "avif", "tiff"]},
      {name: "GIF", extensions: ["gif"]}
    ],
    properties: ["multiSelections", "openFile", "openDirectory"]
  })
  const filePaths = files.filePaths
  if (filePaths.length === 1) {
    if (fs.lstatSync(filePaths[0]).isDirectory()) {
      return fs.readdirSync(filePaths[0]).map((f) => `${filePaths[0]}/${f}`)
    }
  }
  return filePaths
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
    require("@electron/remote/main").enable(window.webContents)
    if (process.platform === "darwin") {
      if (process.env.DEVELOPMENT === "true") {
        fs.chmodSync(path.join(__dirname, "../vendor/cjpeg"), "777")
        fs.chmodSync(path.join(__dirname, "../vendor/cwebp"), "777")
        fs.chmodSync(path.join(__dirname, "../vendor/gifsicle"), "777")
        fs.chmodSync(path.join(__dirname, "../vendor/pngquant"), "777")
      } else {
        fs.chmodSync(path.join(app.getAppPath(), "vendor/cjpeg"), "777")
        fs.chmodSync(path.join(app.getAppPath(), "vendor/cwebp"), "777")
        fs.chmodSync(path.join(app.getAppPath(), "vendor/gifsicle"), "777")
        fs.chmodSync(path.join(app.getAppPath(), "vendor/pngquant"), "777")
      }
    }
    window.on("close", () => {
      preview?.close()
    })
    window.on("closed", () => {
      window = null
    })
    localShortcut.register("Ctrl+O", () => {
      window?.webContents.send("upload")
    }, window, {strict: true})
    globalShortcut.register("Control+Shift+I", () => {
      window?.webContents.toggleDevTools()
      preview?.webContents.toggleDevTools()
    })
  })
}

app.allowRendererProcessReuse = false
