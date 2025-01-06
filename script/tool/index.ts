import NodeOS from "os"
import IconvLite from "iconv-lite"
import { exec, spawn } from "child_process"
import { app, shell } from "electron"
import { AppConfig } from "../core/AppConfig"
import { LocalLogger } from "../core/AppLogger"
const path = require("path")
const net = require("net")
const fs = require("fs")
const os = require("os")

const vncPath = "C:\\Program Files\\TightVNC\\tvnserver.exe"

/** 延时器 */
export const delayer = (cd: number) => new Promise<void>((resolve) => setTimeout(resolve, cd))

/** 格式化数字 */
export const formatNumber = (num: number | string) => {
  const base = 1024
  const unitList = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB", "BB", "NB", "DB", "CB"]
  const value = Number(num)
  if (!Number.isInteger(value) || value === 0) return `0 ${unitList[0]}`
  const pow = Math.floor(Math.log(value) / Math.log(base))
  if (pow < 0) return `0 ${unitList[0]}`
  let data = (value / Math.pow(base, pow)).toFixed(2)
  if (data.endsWith(".00")) {
    data = data.substring(0, data.length - 3)
  }
  return `${data} ${unitList[pow]}`
}

/** 转义乱码 */
export const iconvDecode = (text: string | Buffer, dataDecode?: string) => {
  const value = AppConfig.IS_WIN32 ? text.toString() : IconvLite.decode(Buffer.from(text), dataDecode || "cp936")
  return value.replace(/\n$/, "").trim()
}

/** 运行 CMD 命令 */
export const runCmdOrder = (command: string, options?: object, dataEncode?: string, dataDecode?: string) => {
  return new Promise<CmdResult>((resolve) => {
    const opt: any = {
      windowsHide: true,
      ...options,
      encoding: dataEncode || "buffer"
    }
    const startTime = Date.now()
    LocalLogger.Cmd.log("[命令]", command)
    LocalLogger.Cmd.log("[配置]", opt)
    exec(command, opt, (error, stdout, stderr) => {
      const result: CmdResult = {
        tid: Date.now().toString(),
        success: false,
        command,
        options: opt,
        spent: Date.now() - startTime,
        error: error || {},
        stderr: iconvDecode(stderr || "", dataDecode),
        stdout: iconvDecode(stdout || "", dataDecode),
        message: ""
      }
      result.message = result.stderr || error?.message || ""
      result.success = !result.message
      LocalLogger.Cmd.log(result, "\n")
      return resolve(result)
    })
  })
}

export const openFolder = (path: string) => {
  const isLinuxRoot = AppConfig.IS_LINUX && NodeOS.userInfo().uid === 0
  return isLinuxRoot ? runCmdOrder(`xdg-open "${path}"`) : shell.openPath(path)
}

export const getSystemConfig = () => {
  let config
  try {
    if (AppConfig.IS_DEV_MODE) {
      config = require("../config.js")
    } else {
      config = require(path.join(process.resourcesPath, "../config.js"))
    }
  } catch (error) {
    console.error("Failed to load configuration file:", error)
  }
  return config
}

export const printf = (...params: any[]) => {
  LocalLogger.Index.log(...params)
  console.log(...params)
}

export const checkPortAvailability = (port) => {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once("error", (err) => {
      if (err.code === "EADDRINUSE") {
        resolve(false) // 端口已被占用
      } else {
        reject(err)
      }
    })

    server.once("listening", () => {
      server.close()
      resolve(true) // 端口可用
    })
    server.listen(port)
  })
}

export const checkIfProcessRunning = async (exeName: string) => {
  const { default: psList } = await import("ps-list")
  const processes = await psList()
  return processes.some((process) => process.name.toLowerCase() === exeName.toLowerCase())
}

export const isProgramInstalledVNC = () => {
  return fs.existsSync(vncPath)
}

export const launchVNCWithCMD = () => {
  exec(`cmd.exe /c "start "" "C:\\Program Files\\TightVNC\\tvnserver.exe""`, (error, stdout, stderr) => {
    if (error) {
      console.error(`exec error: ${error}`)
      return
    }
    console.log(`stdout: ${stdout}`)
    console.error(`stderr: ${stderr}`)
  })
}

export const setupVNC = () => {
  // 安装 MSI 的命令
  let msiPath
  if (AppConfig.IS_DEV_MODE) {
    msiPath = path.join(app.getAppPath(), "/script/remote.msi")
  } else {
    msiPath = path.join(process.resourcesPath, "../remote.msi")
  }
  const installCommand = `msiexec /i "${msiPath}" /quiet`
  exec(installCommand, (error, stdout, stderr) => {
    if (error) {
      printf(`远程服务程序安装失败: ${error.message}`)
      return
    }
    if (stderr) {
      printf(`远程服务程序安装时的错误输出: ${stderr}`)
    }
    printf(`远程服务程序安装成功: ${stdout}`)
  })
}

export const getLocalIP = () => {
  const interfaces = os.networkInterfaces()
  for (let interfaceName in interfaces) {
    for (let interfaceDetails of interfaces[interfaceName]) {
      if (interfaceDetails.family === "IPv4" && !interfaceDetails.internal) {
        return interfaceDetails.address // 返回本地非内网 IPv4 地址
      }
    }
  }
  return null
}
