import { ConfigEnv, UserConfigExport } from "vite"
import { resolve } from "path"
import electron from "vite-electron-plugin"
import { loadViteEnv } from "vite-electron-plugin/plugin"
import { rmSync } from "fs"
import pkg from "./package.json"

/** 清空 dist */
rmSync("dist", { recursive: true, force: true })

/** 配置项文档：https://cn.vitejs.dev/config */
export default ({ mode }: ConfigEnv): UserConfigExport => {
  // const viteEnv = loadEnv(mode, process.cwd()) as ImportMetaEnv
  return {
    resolve: {
      alias: {
        /** @ 符号指向 src 目录 */
        "@": resolve(__dirname, "./src")
      }
    },
    server: {
      /** 是否自动打开浏览器 */
      open: false,
      /** 设置 host: true 才可以使用 Network 的形式，以 IP 访问项目 */
      host: pkg.env.host,
      /** 端口号 */
      port: pkg.env.port,
    },
    build: {
      /** 单个 chunk 文件的大小超过 2048KB 时发出警告 */
      chunkSizeWarningLimit: 2048,
      /** 禁用 gzip 压缩大小报告 */
      reportCompressedSize: false,
    },
    /** 混淆器 */
    esbuild:
      mode === "development"
        ? undefined
        : {
            /** 打包时移除 console.log */
            // pure: ["console.log"],
            /** 打包时移除 debugger */
            drop: ["debugger"],
            /** 打包时移除所有注释 */
            legalComments: "none"
          },
    /** Vite 插件 */
    plugins: [
      electron({
        outDir: "dist",
        include: ["script"],
        transformOptions: { sourcemap: false },
        plugins: [
          {
            name: "remove-comments",
            transform: ({ code }) => {
              let content = code
              // 匹配 块级注释、行级注释、Region注释
              // \s 是匹配所有空白符, 包括换行; \S 非空白符, 不包括换行
              const pattern1 = /\/\*[\s\S]*?\*\/|(\s)+\/\/[\s\S]*?[\n]+/g
              content = content.replaceAll(pattern1, "\n")
              // 匹配 所有空行
              const pattern2 = /^\s*[\r\n]/gm
              content = content.replaceAll(pattern2, "")
              return content
            }
          },
          loadViteEnv()
        ]
      })
    ],
    css: {
      postcss: {
        plugins: [
          {
            postcssPlugin: "internal:charset-removal",
            AtRule: {
              charset: (atRule) => {
                if (atRule.name === "charset") {
                  atRule.remove()
                }
              }
            }
          }
        ]
      }
    },
    clearScreen: false
  }
}
