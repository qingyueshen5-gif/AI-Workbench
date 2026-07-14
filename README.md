# AI-Workbench

AI 投研工作台 —— 自动化投研流程与量化分析系统。

## 核心能力

- **全球数据采集**：Finviz 美股 / 腾讯 A 股 / Sina 现金流 / 宏观数据
- **多模型估值**：DCF / PE / PB / PS / EV/EBITDA 多维度交叉验证
- **智能修复引擎**：FCF 负值替代 / 分行业 PE / 股本修正
- **统一报告输出**：multi_valuation_all + stock_overview

## 快速开始

```bash
cd scripts
python finviz_collect.py   # 美股数据采集
python repair_engine.py    # 估值修复 + 报告生成
```

## 目录结构

```
AI-Workbench/
├── scripts/          # 采集 & 修复脚本
├── data/             # 原始数据 & 估值结果
├── reports/          # 统一报告输出
└── docs/             # 系统文档
```
