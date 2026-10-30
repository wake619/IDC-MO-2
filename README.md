# 超级智算数据中心 AI 基础设施运维管理透视化平台

面向智算数据中心（GPU 集群）的 AI 基础设施运维管理透视化平台，采用深色科技风驾驶舱设计。平台为**高保真演示系统**：纯前端实现，内置确定性种子的仿真数据引擎（1 秒心跳），实时模拟 2 机房 × 192 机柜 × 768 节点 × 6144 GPU 的指标漂移、告警流转、任务调度与故障自愈，无需任何后端即可完整体验运维透视场景。

## 🌐 在线演示

**https://wake619.github.io/IDC-MO-2/**

> 由 GitHub Actions 自动构建发布：push 到 `main` 分支后 1~2 分钟内站点自动更新。

## ✨ 功能模块

| 模块 | 路由 | 说明 |
|---|---|---|
| 总览驾驶舱 | `/` | KPI 数字滚动、集群健康度仪表、3D 机房缩略、实时告警滚动 |
| GPU 集群 | `/gpu` | 768 节点卡片墙（每节点 8 卡位）、温度热力图、节点详情抽屉 |
| 3D 机房透视 | `/dc3d` | Three.js 机房场景：温度/负载/告警/线缆拓扑四视图、机柜点击详情、自动巡检相机巡游 |
| 告警中心 | `/alerts` | 实时告警列表、级别/来源筛选、确认-静默-解决闭环操作 |
| 性能分析 | `/performance` | 集群利用率趋势、慢节点检测、MFU/吞吐分析 |
| 算力调度 | `/scheduling` | 训练任务队列、资源分配视图、任务提交表单（触发仿真调度） |
| AIOps 智能运维 | `/aiops` | 故障预测列表、异常检测曲线、规则式智能诊断助手对话 |
| 资产 CMDB | `/cmdb` | 972+ 资产台账（服务器/GPU 卡/交换机等）、检索与详情 |
| 能耗 PUE | `/energy` | PUE 实时曲线、机柜温度分布、制冷与功耗分析 |
| 容量规划 | `/capacity` | 资源容量水位、扩容预测、机房/排级容量分布 |

## 🛠 技术栈

- **框架**：React 18 + TypeScript + Vite 5（HashRouter 路由，天然兼容静态托管）
- **3D 可视化**：Three.js + @react-three/fiber + @react-three/drei（自发光材质模拟辉光）
- **图表**：ECharts 5（自定义 `cockpit` 深色主题，option 工厂集中于 `src/theme/chartOptions.ts`）
- **状态与仿真**：Zustand 全局 store + 确定性伪随机仿真引擎（Mulberry32 固定种子，刷新数据一致）
- **样式**：Tailwind CSS 深色赛博主题（自定义色板 void/cyber/alarm/amber/online）+ framer-motion 入场动效

## 🚀 本地运行

环境要求：Node.js ≥ 18

```bash
# 安装依赖
npm install

# 启动开发服务器（http://localhost:5173）
npm run dev

# 类型检查 + 生产构建（产物输出至 dist/）
npm run build

# 本地预览生产构建
npm run preview
```

## 📁 目录结构

```
src/
├── components/        # UI 组件（Layout/Panel/ChartBox/Badges 等）
│   └── scene/         # Three.js 3D 机房场景
├── mock/              # 确定性数据生成器 + 仿真引擎
├── pages/             # 10 个路由页面
├── stores/            # Zustand 全局仿真状态（simStore）
├── theme/             # 色板 / ECharts 主题 / option 工厂
└── types/             # 领域模型类型定义
```

## 📄 License

仅供演示与学习使用。
