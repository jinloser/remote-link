/**
 * 主窗口
 */

import * as remote from "@electron/remote/main"
import { ipcMain, BrowserWindow, type BrowserWindowConstructorOptions, globalShortcut, app, dialog } from "electron"
import { AppConfig } from "./AppConfig"
import IpcDict from "../tool/ipc-dict"
import RemoteServer from "./RemoteServer"
import {
  checkIfProcessRunning,
  getLocalIP,
  getSystemConfig,
  isProgramInstalledVNC,
  launchVNCWithCMD,
  printf,
  setupVNC
} from "../tool/index"
import AppTray from "./AppTray"
const { spawn, exec } = require("child_process")
const path = require("path")
const fs = require("fs")
const config = getSystemConfig()
const { width = 1920, height = 1080, enginePath, remoteServer, isStartEngine = false } = config
const configPath = path.join(AppConfig.IS_DEV_MODE ? __dirname : process.resourcesPath, "../config.js")

export default class WinMain {
  // 打印日志

  /** 窗口实例 */
  private static winInst: BrowserWindow | null = null

  /** 窗口配置 */
  private static winOption: BrowserWindowConstructorOptions = {
    icon: AppConfig.getAppLogo(), // 图标
    title: AppConfig.getAppTitle(), // 如果由 loadURL() 加载的 HTML 文件中含有标签 <title>，此属性将被忽略
    width,
    height,
    minWidth: width,
    minHeight: height,
    show: false, // 是否在创建时显示, 默认值为 true
    frame: false, // 是否有边框
    center: true, // 是否在屏幕居中
    hasShadow: false, // 窗口是否有阴影. 默认值为 true
    resizable: true, // 是否允许拉伸大小
    fullscreenable: true, // 是否允许全屏
    // autoHideMenuBar: true, // 自动隐藏菜单栏, 除非按了 Alt 键, 默认值为 false
    // backgroundColor: "transparent", // 背景颜色
    transparent: true, // 窗口透明
    alwaysOnTop: true,
    webPreferences: {
      devTools: true, // 是否开启 DevTools, 如果设置为 false（默认值为 true）, 则无法使用 BrowserWindow.webContents.openDevTools()
      webSecurity: false, // 当设置为 false, 将禁用同源策略
      nodeIntegration: true, // 是否启用 Node 集成
      contextIsolation: false, // 是否在独立 JavaScript 环境中运行 Electron API 和指定的 preload 脚本，默认为 true
      nodeIntegrationInWorker: true, // 是否在 Web 工作器中启用了 Node 集成
      backgroundThrottling: false, // 是否在页面成为背景时限制动画和计时器，默认值为 true
      spellcheck: false // 是否启用内置拼写检查器
    }
  }

  /** 获取窗口实例 */
  static instance() {
    return this.winInst
  }

  static sendToRenderer(channel: string, ...params: any[]) {
    printf("[main.win.主进程>>>渲染进程]", `<频道>`, channel)
    printf("[main.win.主进程>>>渲染进程]", `<参数>`, ...params)
    this.winInst?.webContents.send(channel, ...params)
  }

  /** 显示窗口 */
  static show(center?: boolean) {
    printf("[main.win.显示主窗口]", { center })
    this.winInst?.show()
    this.winInst?.focus()
    center && this.winInst?.center()
  }

  /** 创建窗口 */
  static async create() {
    if (this.winInst) return

    this.winInst = new BrowserWindow(this.winOption)
    this.winInst.removeMenu()

    // 启用 remote
    remote.enable(this.winInst.webContents)
    // AppConfig.IS_DEV_MODE && this.openDevtool()

    // 启动指定路径的exe文件
    let exeProcess

    if (isStartEngine && enginePath) {
      printf("[引擎目录地址]", enginePath)
      if (fs.existsSync(enginePath)) {
        const exeName = path.basename(enginePath)
        const isRunning = await checkIfProcessRunning(exeName)
        if (isRunning) {
          console.log(`[引擎已经启动] ${exeName} 正在运行`)
          await this.closeExeProcess(enginePath)
        }

        exeProcess = spawn(enginePath, [], { shell: false })
        printf(`[引擎启动中]`)

        exeProcess.stdout.on("data", (data) => {
          if (data.includes("Game Engine Initialized")) {
            printf(`[引擎启动完成]`)
          }
        })
      } else {
        WinMain.showMessageBox(`[引擎启动失败] 找不到可执行文件: ${enginePath}`)
        printf(`[引擎启动失败] 找不到可执行文件: ${enginePath}`)
      }
    }

    if (remoteServer.connectIp) {
      RemoteServer.createRemoteServer()
    }

    if (isProgramInstalledVNC()) {
      printf("[远程服务程序已安装]")
      const processName = "tvnserver.exe"
      const isRunning = await checkIfProcessRunning(processName) //监测vnc程序是否启动
      printf(`[远程服务程序是否运行状态] ${isRunning}`)
      if (!isRunning) launchVNCWithCMD()
    } else {
      printf("[远程服务程序未安装，正在启动安装程序]")
      setupVNC()
    }

    // 窗口-准备好显示
    // 在窗口的控制台中使用 F5 刷新时，也会触发该事件
    this.winInst.on("ready-to-show", () => {
      printf("[main.win.即将显示]", "<ready-to-show>")
      this.show(true)
      this.winInst?.center()
    })

    // 窗口-即将关闭
    this.winInst.on("close", () => {
      printf("[main.win.即将关闭]", "<close>")
    })

    // 窗口-已关闭
    this.winInst.on("closed", () => {
      console.log("窗口已关闭")
      if (exeProcess) {
        this.closeExeProcess(enginePath)
      }
      if (remoteServer) RemoteServer.stopWebsockify()
      printf("[main.win.已关闭]", "<closed>")
      this.winInst?.removeAllListeners()
      this.winInst = null
    })

    this.winInst?.setAlwaysOnTop(true, "screen-saver", 1)

    // 加载配置文件并发送到渲染进程
    ipcMain.on("load-config", async (event) => {
      try {
        const configModule = require(configPath) // 使用 require 导入配置文件
        event.sender.send("config-loaded", configModule)
      } catch (error: any) {
        printf("加载配置失败:", error)
        event.sender.send("config-load-error", error.message)
      }
    })

    ipcMain.on("save-config", async (event, newConfig) => {
      const configData = `module.exports = ${JSON.stringify(newConfig, null, 2)}`
      printf("接收到新配置:", newConfig)
      try {
        await fs.promises.writeFile(configPath, configData)
        printf("配置已成功更新至 config.js 文件")
        event.sender.send("restart-app")
        this.restartApp()
      } catch (error) {
        printf("保存配置失败:", error)
      }
    })

    ipcMain.handle("dialog:open", async () => {
      const result = await dialog.showOpenDialog(this.winInst!, {
        properties: ["openFile"],
        filters: [{ name: "Executables", extensions: ["exe"] }]
      })
      if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0]
      }
      return null
    })
  }

  static restartApp() {
    app.relaunch() // 重新启动应用
    app.exit() // 退出当前进程
  }

  static showMessageBox(message: string) {
    dialog
      .showMessageBox({
        type: "error",
        message: message,
        detail: "是否要修改配置信息？",
        buttons: ["是", "否"],
        defaultId: 0, // 默认选中的按钮索引
        cancelId: 1 // 取消按钮的索引
      })
      .then((result) => {
        if (result.response === 0) {
          AppTray.createSettingWindow()
        }
      })
  }

  static closeExeProcess(exePath: string) {
    const fileName = path.basename(exePath)
    return new Promise<void>((resolve, reject) => {
      exec(`taskkill /IM ${fileName} /T /F`, (err, stdout, stderr) => {
        if (err) {
          console.error(`Error killing process: ${stderr}`)
          reject(new Error(`Error killing process: ${stderr}`))
        } else {
          console.log(`All ${fileName} processes killed: ${stdout}`)
          resolve()
        }
      })
    })
  }

  /** 打开控制台 */
  static openDevtool(type?: "right" | "bottom" | "undocked") {
    if (!this.winInst) return
    const winCtns = this.winInst.webContents
    winCtns.closeDevTools()
    winCtns.openDevTools({ mode: type || "undocked", title: " " })
  }

  /** 监听通信事件 */
  static ipcListening() {
    // 设置窗口默认尺寸
    ipcMain.on(IpcDict.CODE_01001, (_, dto: WinStateDTO) => {
      if (!this.winInst) return
      const size = AppConfig.adaptByScreen(dto, this.winInst)
      this.winInst.setResizable(true)
      this.winInst.setMinimumSize(size.width, size.height)
      this.winInst.setSize(size.width, size.height)
      dto.center && this.winInst.center()
      typeof dto.maxable === "boolean" && this.winInst.setMaximizable(dto.maxable)
      typeof dto.resizable === "boolean" && this.winInst.setResizable(dto.resizable)
    })
    // 中转消息-代替中央事件总线
    ipcMain.on(IpcDict.CODE_02002, (_, args: any) => {
      if (!this.winInst || !args || !args.channel) return
      printf("[main.win.事件总线]", args)
      this.sendToRenderer(args.channel, args.data)
    })
  }
}
