import { getLocalIP } from "./tool/index"
const localIP = getLocalIP()
console.log("本机IP", localIP)
module.exports = {
  remoteServer: {
    connectIp: `${localIP}:5900`, // 远程连接IP地址
    localPort: 5901 // web访问端口
  }
}
