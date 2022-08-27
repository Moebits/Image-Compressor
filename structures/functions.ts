
import GifEncoder from "gif-encoder"
import pixels from "image-pixels"
import gifFrames from "gif-frames"
import fs from "fs"
import path from "path"
import Sagiri from "sagiri"
import {translate} from "bing-translate-api"

const images = [".png", ".jpg", ".jpeg", ".webp", ".avif", ".tiff"]
const gifs = [".gif"]

export default class Functions {
    public static arrayIncludes = (str: string, arr: string[]) => {
        for (let i = 0; i < arr.length; i++) {
            if (str.includes(arr[i])) return true
        }
        return false
    }

    public static cleanTitle = (str: string) => {
        const ext = path.extname(str)
        const split = str.match(/.{1,30}/g)?.join(" ").replace(ext, "")!
        return `${split.slice(0, 70)}${ext}`
    }

    public static getType = (str: string) => {
        if (Functions.arrayIncludes(path.extname(str), images)) return "image"
        if (Functions.arrayIncludes(path.extname(str), gifs)) return "gif"
    }

    public static arrayRemove = <T>(arr: T[], val: T) => {
        return arr.filter((item) => item !== val)
    }

    public static removeDuplicates = <T>(array: T[]) => {
        return array.filter((a, b) => array.indexOf(a) === b)
    }

    public static timeout = async (ms: number) => {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }

    public static removeDirectory = (dir: string) => {
        if (dir === "/" || dir === "./") return
        if (fs.existsSync(dir)) {
            fs.readdirSync(dir).forEach(function(entry) {
                const entryPath = path.join(dir, entry)
                if (fs.lstatSync(entryPath).isDirectory()) {
                    Functions.removeDirectory(entryPath)
                } else {
                    fs.unlinkSync(entryPath)
                }
            })
            try {
                fs.rmdirSync(dir)
            } catch (e) {
                console.log(e)
            }
        }
    }

    public static logoDrag = (enable?: boolean) => {
        if (enable) {
            // @ts-expect-error
            document.querySelector(".logo-bar-drag")?.style["-webkit-app-region"] = "drag"
        } else {
            // @ts-expect-error
            document.querySelector(".logo-bar-drag")?.style["-webkit-app-region"] = "no-drag"
        }
    }

    public static newDest = (dest: string, active: any[]) => {
        let duplicate = active.find((a) => a.dest === dest)
        let i = 1
        let newDest = dest
        while (fs.existsSync(newDest) || duplicate) {
            newDest = `${path.dirname(dest)}\\${path.basename(dest, path.extname(dest))}_${i}${path.extname(dest)}`
            duplicate = active.find((a) => a.dest === newDest)
            i++
        }
        return newDest
    }

    public static countDecimals = (value: number, max?: number) => {
        const count = value % 1 ? value.toString().split(".")[1].length : 0
        if (max && count > max) return max
        return count
    }

    public static readableFileSize = (bytes: number) => {
        const i = bytes === 0 ? 0 : Math.floor(Math.log(bytes) / Math.log(1024))
        return `${Number((bytes / Math.pow(1024, i)).toFixed(2))} ${["B", "KB", "MB", "GB", "TB"][i]}`
    }

    public static parseFileSize = (size: string) => {
        if (!size) return 0
        const num = parseFloat(size)
        if (Number.isNaN(num)) return 0
        const type = size.replace(/\d+/g, "").replaceAll(".", "").trim()
        let multiplier = 1
        if (type === "KB") multiplier = 1000
        if (type === "MB") multiplier = 1000000
        if (type === "GB") multiplier = 1000000000
        if (type === "TB") multiplier = 1000000000000
        return num * multiplier
    }

    public static parseNewDimensions = (width: number, height: number, resizeWidth: number, resizeHeight: number, percentage: boolean, keepRatio: boolean) => {
        let newWidth = width
        let newHeight = height
        if (keepRatio) {
            if (percentage) {
                newWidth = width * (resizeWidth / 100)
                newHeight = height * (resizeWidth / 100)
            } else {
                const ratio = resizeWidth / width 
                newWidth = resizeWidth
                newHeight = height * ratio
            }
        } else {
            if (percentage) {
                newWidth = width * (resizeWidth / 100)
                newHeight = height * (resizeHeight / 100)
            } else {
                newWidth = resizeWidth
                newHeight = resizeHeight
            }
        }
        return {width: parseInt(String(newWidth)), height: parseInt(String(newHeight))}
    }

    public static translateTitle = async (title: string) => {
        if (!title) return ""
        try {
            const translated = await translate(title, "ja", "en")
            return translated.translation
        } catch {
            return title
        }
    }

    public static parseDest = async (source: string, dir: string, rename: string, format: string, width: number, height: number, overwrite: boolean) => {
        const sourceDir = path.dirname(source)
        const name = path.basename(source, path.extname(source))
        if (format === "original") format = path.extname(source).replaceAll(".", "")
        if (/{title}/i.test(rename) || /{id}/i.test(rename) || /{artist}/i.test(rename) || /{englishTitle}/i.test(rename)) {
            await Functions.timeout(1000)
            try {
                const sagiri = Sagiri("93ccce3cc10aed8078633c67abe3e327dea87451")
                const results = await sagiri(source, {mask: [5]})
                const englishTitle = await Functions.translateTitle(results[0].raw.data.title)
                rename = rename
                ?.replace(/{title}/gi, results[0].raw.data.title ?? "")
                .replace(/{englishTitle}/gi, englishTitle)
                .replace(/{id}/gi, results[0].raw.data.pixiv_id ?? "")
                .replace(/{artist}/gi, results[0].raw.data.member_name ?? "")
            } catch {
                rename = rename
                ?.replace(/{title}/gi, "")
                .replace(/{englishTitle}/gi, "")
                .replace(/{id}/gi, "")
                .replace(/{artist}/gi, "")
            }
        }
        rename = rename
        ?.replace(/{name}/gi, name)
        .replace(/{width}/gi, String(width))
        .replace(/{height}/gi, String(height))
        if (!rename) rename = name
        let dest = `${overwrite ? sourceDir : dir}/${rename}.${format}`
        if (!overwrite && fs.existsSync(dest)) {
            let i = 1
            while (fs.existsSync(dest)) {
                dest = `${overwrite ? sourceDir : dir}/${rename}_${i}.${format}`
                i++
            }
        }
        return dest
    }

    public static streamToBuffer = async (stream: NodeJS.ReadableStream) => {
        const chunks: Buffer[] = []
        const buffer = await new Promise<Buffer>((resolve, reject) => {
          stream.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)))
          stream.on("error", (err) => reject(err))
          stream.on("end", () => resolve(Buffer.concat(chunks)))
        })
        return buffer
    }

    public static encodeGIF = async (frames: Buffer[], delays: number[], width: number, height: number) => {
        const gif = new GifEncoder(width, height, {highWaterMark: 5 * 1024 * 1024})
        gif.setQuality(10)
        gif.setRepeat(0)
        gif.writeHeader()
        let counter = 0

        const addToGif = async (frames: Buffer[]) => {
            if (!frames[counter]) {
                gif.finish()
            } else {
                const {data} = await pixels(frames[counter])
                gif.setDelay(delays[counter])
                gif.addFrame(data)
                counter++
                addToGif(frames)
            }
        }
        await addToGif(frames)
        return Functions.streamToBuffer(gif as NodeJS.ReadableStream)
    }

    public static getGIFFrames = async (image: string, options?: {speed?: number, reverse?: boolean, cumulative?: boolean}) => {
        if (!options) options = {} as {speed: number, reverse: boolean, cumulative: boolean}
        if (!options.speed) options.speed = 1
        if (!options.reverse) options.reverse = false
        if (!options.cumulative) options.cumulative = true
        const frames = await gifFrames({url: image, frames: "all", outputType: "png", cumulative: options.cumulative})
        let frameArray = [] as Buffer[]
        let delayArray = [] as number[]
        const constraint = options.speed > 1 ? frames.length / options.speed : frames.length
        let step = Math.ceil(frames.length / constraint)
        for (let i = 0; i < frames.length; i += step) {
            frameArray.push(await Functions.streamToBuffer(frames[i].getImage()))
            delayArray.push(frames[i].frameInfo.delay * 10)
        }
        if (options.speed < 1) delayArray = delayArray.map((n) => n / options?.speed!)
        if (options.reverse) {
            frameArray = frameArray.reverse()
            delayArray = delayArray.reverse()
        }
        return {frameArray, delayArray}
    }

    public static arrayBufferToBuffer(arrayBuffer: ArrayBuffer) {
        if (!arrayBuffer.byteLength) arrayBuffer = fs.readFileSync(arrayBuffer as unknown as string)
        const buffer = Buffer.alloc(arrayBuffer.byteLength)
        const array = new Uint8Array(arrayBuffer)
        for (let i = 0; i < buffer.length; i++) {
            buffer[i] = array[i]
        }
        return buffer
    }

    public static bufferToBase64 = (buffer: Buffer, type: string) => {
        return `data:${type};base64,${buffer.toString("base64")}`
    }
}
