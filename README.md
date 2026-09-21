# 🎬 舞台演出提示链编排（Stage Cue Chain）

面向舞台技术监督 / 灯光音效执行的**提示链（Cue Chain）编排 Web 应用**。
在同一张画布上创建灯光、音效、演员提示节点，用连线表达「A 完成 → B 触发」的依赖关系；
系统自动完成 **CPM 关键路径法**调度：每个节点的最早/最晚触发时刻、机动时间与整场关键路径，
并在画布与可排序运行表之间双向高亮同步。

技术栈：**React 18 + TypeScript + Vite + React Flow（@xyflow/react v12）+ Zustand**，无后端。

---

## ✨ 功能

| 能力 | 说明 |
| --- | --- |
| 三类提示节点 | 💡 灯光 / 🔊 音效 / 🎭 演员，各自带颜色与图标 |
| 节点参数 | **持续时间**（duration）与**相对延迟**（delay，相对前置节点完成时刻） |
| 依赖连线 | 从节点右侧锚点拖出连线，建立 `source 完成 → target 触发` 依赖 |
| **环路阻止** | 任何会形成环的连线立即被拒绝并弹出提示；导入的 JSON 含环同样拒绝加载 |
| 自动重算 | 任意节点 / 连线 / 参数变更后，按依赖拓扑重新计算全部时刻与关键路径 |
| 关键路径 | 红色加粗流动边 + 节点「关键」角标 + 运行表 ⭐ 高亮 + 底部关键链面包屑 |
| 可排序运行表 | 点击表头按触发时刻 / 完成时刻 / 名称 / 类型 / 时长 / 延迟 / 机动时间排序 |
| 双向高亮 | 悬停或选中节点 ↔ 运行表行同步高亮；点击运行表行，画布平滑居中定位 |
| JSON 导入导出 | 单文件 JSON（节点位置、参数、连线），带格式校验与自愈修复 |
| 自动布局 | 按拓扑层级一键整理画布 |
| 单命令部署 | Dockerfile + docker-compose.yml，一条命令启动 |

### 调度模型

- `ES(v)` 最早触发：无前驱时为 `delay(v)`；否则为 `max(EF(u)) + delay(v)`
- `EF(v) = ES(v) + duration(v)`
- 后向传递求 `LF / LS`，`slack = LS - ES`
- `slack = 0` 的节点与紧边（`EF(u) + delay(v) = ES(v)`）构成**关键路径**，决定全剧总时长

---

## 🚀 快速开始（Docker，推荐）

前置要求：已安装 Docker（含 Compose 插件）。

```bash
docker compose up --build -d
```

然后浏览器访问：

> **http://localhost:8080**

停止：

```bash
docker compose down
```

端口在 `docker-compose.yml` 中映射为 `8080:80`，需要更换端口时修改左侧宿主机端口即可。

---

## 🧑‍💻 本地开发（Node.js 20+）

```bash
npm install
npm run dev        # 开发服务器，访问 http://localhost:5173
```

其他命令：

```bash
npm run build      # 类型检查 + 生产构建到 dist/
npm run preview    # 本地预览生产构建，访问 http://localhost:4173
```

---

## 🖱️ 操作指南

1. 顶部工具栏点击 **添加 → 灯光 / 音效 / 演员** 创建提示节点。
2. 选中节点后在右侧检查器修改名称、类型、持续时间、相对延迟。
3. 从节点**右侧圆点**拖到另一节点的左侧圆点，建立依赖；形成环的连线会被阻止。
4. **双击连线**或选中连线后在检查器中删除。
5. 底部运行表：点击表头排序；点击任意行，画布居中定位该节点；悬停行与画布节点联动高亮。
6. 底部红色胶囊链即关键路径，点击胶囊可逐个跳转。
7. 使用 **导出 JSON** 保存编排，**导入 JSON** 恢复；**示例**可随时载入内置演示工程。

---

## 📄 JSON 文件格式

```json
{
  "app": "stage-cue-chain",
  "version": 1,
  "nodes": [
    {
      "id": "cue_spot",
      "label": "追光起",
      "kind": "light",
      "duration": 4,
      "delay": 2,
      "position": { "x": 400, "y": 120 }
    }
  ],
  "edges": [
    { "id": "e1", "source": "cue_open", "target": "cue_spot" }
  ]
}
```

- `kind` 仅接受 `"light" | "sound" | "actor"`；非法值、缺字段会被自动修复或跳过。
- 引用不存在节点、自连、重复连线会被忽略；**存在环路时整个文件拒绝导入**。

---

## 📁 项目结构

```
src/
├── main.tsx                 # 入口
├── App.tsx                  # 整体布局
├── store.ts                 # Zustand 状态：图数据、选中态、增删改、导入导出
├── types.ts                 # 类型定义
├── lib/
│   ├── schedule.ts          # 拓扑排序 / 环检测 / CPM 前向后向传递 / 关键路径
│   ├── io.ts                # JSON 序列化、解析校验、下载
│   ├── layout.ts            # 拓扑层级自动布局
│   └── demo.ts              # 内置示例
└── components/
    ├── FlowCanvas.tsx       # React Flow 画布
    ├── CueNodeView.tsx      # 自定义提示节点
    ├── CriticalEdge.tsx     # 自定义边（关键路径标签）
    ├── Inspector.tsx        # 右侧属性检查器
    ├── RunSheet.tsx         # 可排序运行表 + 关键链
    ├── Toolbar.tsx          # 顶部工具栏
    ├── StatusBar.tsx        # 底部状态栏
    ├── Toasts.tsx           # 操作反馈通知
    └── meta.ts              # 类型元数据与时间格式化
```
