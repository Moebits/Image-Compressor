import "bootstrap/dist/css/bootstrap.min.css"
import {ipcRenderer} from "electron"
import React, {useState, useEffect} from "react"
import {useDropzone} from "react-dropzone"
import ReactDom from "react-dom"
import LogoBar from "./components/LogoBar"
import TitleBar from "./components/TitleBar"
import VersionDialog from "./components/VersionDialog"
import OptionsBar from "./components/OptionsBar"
import GroupAction from "./components/GroupAction"
import FileContainerList from "./components/FileContainerList"
import "./index.less"

export const DirectoryContext = React.createContext<any>(null)
export const ClearAllContext = React.createContext<any>(null)
export const QualityContext = React.createContext<any>(null)
export const OverwriteContext = React.createContext<any>(null)
export const IgnoreBelowContext = React.createContext<any>(null)
export const ResizeWidthContext = React.createContext<any>(null)
export const ResizeHeightContext = React.createContext<any>(null)
export const PercentageContext = React.createContext<any>(null)
export const KeepRatioContext = React.createContext<any>(null)
export const RenameContext = React.createContext<any>(null)
export const FormatContext = React.createContext<any>(null)
export const ProgressiveContext = React.createContext<any>(null)

const App = () => {
  const [directory, setDirectory] = useState("")
  const [clearAll, setClearAll] = useState(false)
  const [quality, setQuality] = useState(75)
  const [overwrite, setOverwrite] = useState(true)
  const [ignoreBelow, setIgnoreBelow] = useState("0KB")
  const [resizeWidth, setResizeWidth] = useState(100)
  const [resizeHeight, setResizeHeight] = useState(100)
  const [percentage, setPercentage] = useState(true)
  const [keepRatio, setKeepRatio] = useState(true)
  const [progressive, setProgressive] = useState(true)
  const [rename, setRename] = useState("{name}")
  const [format, setFormat] = useState("original")

  useEffect(() => {
    ipcRenderer.on("debug", console.log)
    return () => {
      ipcRenderer.removeListener("debug", console.log)
    }
  })

  const onDrop = (files: any) => {
    files = files.map((f: any) => f.path)
    ipcRenderer.invoke("on-drop", files)
  }

  const {getRootProps} = useDropzone({onDrop})

  return (
    <main className="app" {...getRootProps()}>
      <ProgressiveContext.Provider value={{progressive, setProgressive}}>
      <DirectoryContext.Provider value={{directory, setDirectory}}>
      <ClearAllContext.Provider value={{clearAll, setClearAll}}>
      <FormatContext.Provider value={{format, setFormat}}>
      <RenameContext.Provider value={{rename, setRename}}>
      <KeepRatioContext.Provider value={{keepRatio, setKeepRatio}}>
      <PercentageContext.Provider value={{percentage, setPercentage}}>
      <ResizeHeightContext.Provider value={{resizeHeight, setResizeHeight}}>
      <ResizeWidthContext.Provider value={{resizeWidth, setResizeWidth}}>
      <IgnoreBelowContext.Provider value={{ignoreBelow, setIgnoreBelow}}>
      <OverwriteContext.Provider value={{overwrite, setOverwrite}}>
      <QualityContext.Provider value={{quality, setQuality}}>
        <TitleBar/>
        <VersionDialog/>
        <LogoBar/>
        <OptionsBar/>
        <GroupAction/>
        <FileContainerList/>
      </QualityContext.Provider>
      </OverwriteContext.Provider>
      </IgnoreBelowContext.Provider>
      </ResizeWidthContext.Provider>
      </ResizeHeightContext.Provider>
      </PercentageContext.Provider>
      </KeepRatioContext.Provider>
      </RenameContext.Provider>
      </FormatContext.Provider>
      </ClearAllContext.Provider>
      </DirectoryContext.Provider>
      </ProgressiveContext.Provider>
    </main>
  )
}

ReactDom.render(<App/>, document.getElementById("root"))
