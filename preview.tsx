import {ipcRenderer} from "electron"
import React, {useState, useEffect, useRef} from "react"
import ReactDom from "react-dom"
import PreviewTitleBar from "./components/PreviewTitleBar"
import {TransformWrapper, TransformComponent} from "react-zoom-pan-pinch"
import {ReactCompareSlider, ReactCompareSliderHandle} from "react-compare-slider"
import functions from "./structures/functions"
import "./preview.less"

const App: React.FunctionComponent = () => {
    const [oldImage, setOldImage] = useState("")
    const [oldFileSize, setOldFileSize] = useState("0")
    const [newImage, setNewImage] = useState("")
    const [newFileSize, setNewFileSize] = useState("0")
    const [zoomScale, setZoomScale] = useState(1)
    const [id, setID] = useState(0)
    const [title, setTitle] = useState("")
    const [position, setPosition] = useState(50)
    const zoomRef = useRef(null) as any

    useEffect(() => {
        const updateBuffer = (event: any, info: {id: number, title: string, source: string, fileSize: string, newSource: string, newFileSize: string}) => { 
            setOldImage(info.source)
            setOldFileSize(info.fileSize)
            setID(info.id)
            setTitle(info.title)
            resetZoom()
            if (!info.newFileSize || !parseInt(info.newFileSize)) {
                setNewImage(info.source)
                setNewFileSize(info.fileSize)
            } else {
                setNewImage(info.newSource)
                setNewFileSize(info.newFileSize)
            }
        }
        ipcRenderer.on("update-buffer", updateBuffer)
        ipcRenderer.on("zoom-in", zoomIn)
        ipcRenderer.on("zoom-out", zoomOut)
        return () => {
            ipcRenderer.removeListener("update-buffer", updateBuffer)
            ipcRenderer.removeListener("zoom-in", zoomIn)
            ipcRenderer.removeListener("zoom-out", zoomOut)
        }
    }, [])

    useEffect(() => {
        const updateBufferRealtime = (event: any, info: {id: number, newSource: string, newFileSize: string}) => {
            if (id === info.id) {
                setNewImage(info.newSource)
                setNewFileSize(info.newFileSize)
            }
        }
        ipcRenderer.on("update-buffer-realtime", updateBufferRealtime)
        return () => {
            ipcRenderer.removeListener("update-buffer-realtime", updateBufferRealtime)
        }
    })

    const resetZoom = () => {
        zoomRef?.current!.resetTransform(0)
    }

    const zoomIn = () => {
        zoomRef?.current!.zoomIn(0.5, 0)
    }

    const zoomOut = () => {
        zoomRef?.current!.zoomOut(0.5, 0)
    }

    return (
        <main className="app">
            <PreviewTitleBar title={title}/>
            <TransformWrapper ref={zoomRef} minScale={0.75} limitToBounds={false} minPositionX={-200} maxPositionX={200} minPositionY={-200} maxPositionY={200} onZoomStop={(ref) => setZoomScale(ref.state.scale)} wheel={{step: 0.1}} pinch={{disabled: true}} zoomAnimation={{disabled: true}} alignmentAnimation={{disabled: true}} doubleClick={{mode: "reset", animationTime: 0}}>
                <TransformComponent>
                        <div className="preview-container">
                            <ReactCompareSlider
                                changePositionOnHover={true}
                                handle={<><p className="preview-text">{oldFileSize}</p><ReactCompareSliderHandle buttonStyle={{display: "none"}} linesStyle={{height: "100%", width: 1, color: "black", opacity: 0.5, cursor: "default"}}/><p className="preview-text2">{newFileSize}</p></>}
                                itemOne={<img src={oldImage} className="image"/>}
                                itemTwo={<img src={newImage} className="image"/>}
                            />
                        </div>
                </TransformComponent>
            </TransformWrapper>
        </main>
    )
}

ReactDom.render(<App/>, document.getElementById("root"))