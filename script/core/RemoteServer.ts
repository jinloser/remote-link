import { AppConfig } from "./AppConfig"

import { checkPortAvailability, getSystemConfig, printf } from "../tool/index"
import WinMain from "./WinMain"
const { spawn } = require("child_process")
const path = require("path")
const config = getSystemConfig()
let websockifyProcess
export default class RemoteServer {
  static async createRemoteServer() {
    const { remoteServer } = config
    const { localPort = 5901, connectIp = "192.168.2.26:5900" } = remoteServer
    printf(`[远程服务启动中] 本地端口: ${localPort} 连接地址: ${connectIp}`)
    const isPortAvailable = await checkPortAvailability(localPort)
    if (!isPortAvailable) {
      printf(`[远程服务启动失败] 端口 ${localPort} 已被占用`)
      WinMain.showMessageBox(`[远程服务启动失败] 端口 ${localPort} 已被占用`)
      return
    }
    const websockifyPath = AppConfig.IS_DEV_MODE
      ? path.join(__dirname, "../../websockify.js")
      : path.join(process.resourcesPath, "app/websockify.js")
    // printf(`[远程目录地址]`, websockifyPath)
    websockifyProcess = spawn("node", [websockifyPath, "--web", ".", localPort, connectIp])
    // 监听标准输出
    websockifyProcess.stdout.on("data", (data) => {
      // printf(`[stdout]`, data.toString("utf8"))
      if (data.includes(" Web server active")) {
        printf(`[远程服务启动成功]`)
      }
    })

    // websockifyProcess.stderr.on("data", (data) => {
    //   printf(`[stderr]`, data.toString("utf8"))
    // })
  }

  // 关闭 Websockify 服务的方法
  static stopWebsockify() {
    if (websockifyProcess) {
      websockifyProcess.kill() // 默认信号 SIGTERM
      printf(`远程服务已关闭`)
    }
  }
}
