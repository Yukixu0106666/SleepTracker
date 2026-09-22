#!/bin/bash
# 快速启动脚本 - 运行数据分析
set -euo pipefail
cd "$(dirname "$0")"

echo "🚀 SleepTracker 数据分析启动"
echo "======================================"

# 检查 Python
if ! command -v python3 &> /dev/null; then
    echo "❌ 需要安装 Python 3"
    exit 1
fi

echo "✅ Python 已安装"

# 安装依赖
echo ""
echo "📦 安装依赖包..."
python3 -m pip install -r requirements-analysis.txt --quiet

echo "✅ 依赖包安装完成"

# 运行分析
echo ""
echo "🔍 开始数据分析..."
python3 sleep_analysis.py

echo ""
echo "✨ 分析完成！请查看生成的 PNG 图表文件"
