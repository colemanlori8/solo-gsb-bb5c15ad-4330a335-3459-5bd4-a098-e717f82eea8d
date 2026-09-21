# CueFlow · 舞台演出提示链编排

基于 **React + TypeScript + Vite + React Flow** 的舞台演出提示（Cue）链编排工具。
在画布上编排灯光、音效、演员提示节点及其依赖关系，系统自动计算每个提示的
**最早触发时刻** 与整场演出的 **关键路径**，并在画布与可排序运行表中同步高亮。

## 功能

- **三类提示节点**：💡 灯光 / 🔊 音效 / 🎭 演员，按类型着色区分
- **依赖连线**：拖动节点手柄即可建立依赖；**自动阻止形成环路**（连线时实时校验并提示）
- **节点属性**：每个节点含 `持续时间` 与 `相对延迟`（前置全部结束后再等待的秒数；无前置时相对演出开始 T+0）
- **实时调度计算**：任一节点或连线变更后，按依赖拓扑重算
  - 每个节点的最早触发 / 最早结束 / 最晚触发 / 松弛时间
  - 整场总时长与关键路径（红色高亮节点与连线）
- **同步高亮**：
  - 关键路径在画布（节点描边发光 + 红色动画连线）与运行表（红色行）中同步标记
  - 画布 ↔ 运行表双向选中联动（点表选节点、点节点滚到表行）
- **可排序运行表**：点击表头按名称 / 类型 / 最早触发 / 持续 / 延迟 / 结束 / 松弛排序
- **JSON 导入 / 导出**：导入时校验类型、数值、引用完整性与无环性
- **辅助功能**：一键分层自动布局、小地图、Delete 键删除、示例演出预置

## 快速开始（Docker，单条命令）

```bash
docker compose up --build
```

然后在浏览器访问 **http://localhost:8080**

> 端口映射为 `8080:80`（见 `docker-compose.yml`）。若 8080 被占用，
> 修改 ports 为如 `"9090:80"` 后访问对应端口即可。

停止：`docker compose down`

## 本地开发

```bash
npm install
npm run dev        # http://localhost:5173
```

其他脚本：

```bash
npm run build      # 类型检查 + 产物构建（输出 dist/）
npm run preview    # 本地预览构建产物
```

## 调度模型

连线 `A → B` 表示「B 依赖 A」：

```
B.最早触发 = max(所有前置的最早结束时刻) + B.相对延迟
B.最早结束 = B.最早触发 + B.持续时间
总时长     = max(所有节点的最早结束时刻)
```

反向传递求得各节点最晚触发时刻，`松弛 = 最晚触发 − 最早触发`；
**松弛为 0 的节点构成关键路径**——任何延误都会拉长整场演出。

环路检测：新增连线 `A → B` 时，若图中 `B` 已可达 `A`（或 `A === B`），
则拒绝该连线；JSON 导入时逐条做同样校验。

## JSON 文件格式（v1）

```json
{
  "version": 1,
  "nodes": [
    { "id": "n1", "type": "lighting", "label": "开场暖场光", "duration": 4, "delay": 0,
      "position": { "x": 60, "y": 60 } }
  ],
  "edges": [
    { "id": "e-n1-n3", "source": "n1", "target": "n3" }
  ]
}
```

- `type`：`lighting` | `sound` | `actor`
- `duration` / `delay`：非负数值（秒）
- `position`：可选，缺省时自动摆放
- 示例文件见 [`examples/opening-night.json`](examples/opening-night.json)，可直接导入

## 项目结构

```
├── Dockerfile              # 多阶段构建：node 构建 → nginx 托管
├── docker-compose.yml      # 单服务，端口 8080:80
├── index.html
├── src/
│   ├── App.tsx             # 画布 / 状态装配，变更后触发重算
│   ├── types.ts            # CueType、节点数据结构
│   ├── lib/
│   │   ├── schedule.ts     # 拓扑排序、最早/最晚时刻、关键路径、环路检测、分层布局（纯函数）
│   │   ├── io.ts           # JSON 序列化与导入校验
│   │   └── uid.ts
│   ├── components/
│   │   ├── CueNode.tsx     # 自定义 React Flow 节点
│   │   ├── Toolbar.tsx     # 添加节点 / 布局 / 导入导出 / 总时长
│   │   ├── Inspector.tsx   # 节点属性编辑（名称/类型/持续/延迟）
│   │   └── RunTable.tsx    # 可排序运行表（与画布联动高亮）
│   └── sample.ts           # 内置示例演出
└── examples/opening-night.json
```
