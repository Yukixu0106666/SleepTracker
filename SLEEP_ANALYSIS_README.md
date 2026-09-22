# 三模型对比（当前实现）

保留 Logistic Regression，加入 Random Forest 和 XGBoost。只运行模型比较：

```bash
python3 -m pip install -r requirements-analysis.txt
bash run_model_comparison.sh
```

`python3 sleep_analysis.py` 或 `./run_analysis.sh` 会在完整分析中调用同一比较流程。
输出位于 `model_results/`：`model_comparison.csv` 为指标均值和标准差，
`fold_metrics.csv` 为各折指标，`out_of_fold_predictions.csv` 保存逐行分组、折号和预测概率，
`run_metadata.json` 保存参数和依赖版本，`model_comparison_report.txt` 包含分类报告和混淆矩阵。
Logistic Regression 的独立报告也保存在该目录。

本次 XGBoost 安装于项目内 `.analysis-deps/`，可直接运行 `bash run_model_comparison.sh`。
该入口在 macOS 上优先复用 sklearn 自带的 OpenMP；若环境没有可用运行库，需要安装 `libomp`（例如 `brew install libomp`）。

评估方法：

- 标签沿用原实现：睡眠质量分数小于 7 为差睡眠（0），大于等于 7 为好睡眠（1）。
- 保留原来的 11 个模型输入；不使用 Person ID、原始质量分数或派生风险标签作为特征。
- 三模型共用 seed=42 的 5 折 StratifiedGroupKFold；相同模型输入始终在同组，避免跨折重复。
- 每折独立拟合缺失值填充、标准化和独热编码；所有模型使用相同输入和预处理。
- 分类阈值固定为 0.5。报告 macro-F1、差睡眠召回率（正类为 0）和 ROC-AUC（使用好睡眠概率，正类为 1）。
- 汇总为各折指标的均值和样本标准差；每折按记录计分，重复记录仍影响权重。
- 超参数预先固定；未用评估折调参或早停。此结果是开发阶段交叉验证，不是独立外部测试。

本地 CSV 实际为 374 行、13 列，排除 ID 后有 132 种完整记录，按模型输入分为 130 组；下方旧文档中的约 450 行属于示例。
本实验评估现有表格中的睡眠质量分类，不代表下一晚预测或临床风险验证，也尚未接入 App 推荐接口。
App 上线前还需对齐实际采集字段并收集真实标签。

运行评估逻辑测试：`python3 -m unittest test_sleep_model_comparison.py`。

方法参考：[sklearn 分组分层交叉验证](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.StratifiedGroupKFold.html)、
[XGBoost 分类器 API](https://xgboost.readthedocs.io/en/stable/python/python_api.html#xgboost.XGBClassifier)。

---

# 🛏️ Sleep Health and Lifestyle Data Analysis
## Kaggle 数据分析项目

这是一个完整的睡眠健康与生活方式数据分析项目，结合 SleepTracker 应用场景。

## 📋 项目内容

### 分析功能：
1. ✅ **数据加载** - 自动下载或加载 Kaggle 数据集
2. ✅ **数据清理** - 处理缺失值、重复值、数据类型转换
3. ✅ **基础统计** - 均值、中位数、标准差等统计指标
4. ✅ **数据可视化** - 直方图、箱线图、散点图、热力图
5. ✅ **相关性分析** - 发现特征间的关系
6. ✅ **规律总结** - 输出关键洞察和应用建议

### 分析指标：
- 年龄 (Age)
- 职业 (Occupation)
- 睡眠时长 (Sleep Duration)
- 压力水平 (Stress Level)
- 身体质量指数 (BMI)
- 运动频率 (Exercise Frequency)
- 和其他相关健康指标

## 🚀 快速开始

### 前置条件
```bash
# 确保已安装 Python 3.7+
python3 --version

# 安装依赖包
pip install pandas numpy matplotlib seaborn kaggle
```

### 方式一：使用 Jupyter Notebook
```bash
cd /Users/xuri/Downloads/SleepTracker-main
jupyter notebook sleep_health_analysis.ipynb
```

### 方式二：下载数据集

#### 选项 A: 使用 Kaggle API（推荐）
```bash
# 1. 从 https://www.kaggle.com/settings/account 获取 API 密钥
# 2. 放在 ~/.kaggle/kaggle.json
# 3. 运行：
kaggle datasets download -d deadmau49/sleep-health-and-lifestyle-dataset
unzip sleep-health-and-lifestyle-dataset.zip
```

#### 选项 B: 手动下载
1. 访问 https://www.kaggle.com/datasets/deadmau49/sleep-health-and-lifestyle-dataset
2. 下载 CSV 文件
3. 放在项目目录下，命名为 `Sleep_health_and_lifestyle_dataset.csv`

## 📊 Notebook 结构

```
1. 导入库
   ↓
2. 加载数据集
   ↓
3. 数据清理与预处理
   ↓
4. 基础统计分析
   ↓
5. 可视化分析
   ├─ 直方图（分布）
   ├─ 分类图（频数）
   ├─ 箱线图（异常值）
   └─ 散点图（关系）
   ↓
6. 相关性分析
   └─ 热力图展示
   ↓
7. 规律总结与应用建议
```

## 💡 核心洞察

分析完成后，您将获得：

### 1. 睡眠模式规律
- 不同年龄的睡眠时长差异
- 睡眠质量与压力的关系
- 职业对睡眠的影响

### 2. 健康指标关联
- BMI 与睡眠的关系
- 运动频率与睡眠质量
- 压力水平的影响

### 3. 人群特征
- 不同职业的睡眠特征
- 年龄段的睡眠需求
- 健康风险识别

## 🎯 应用到 SleepTracker App

### 推荐功能增强：
1. **智能建议系统**
   - 基于年龄、职业的个性化睡眠建议
   - 根据压力水平调整目标

2. **健康报告**
   - 对标数据集中同龄人的睡眠水平
   - 健康指标对标

3. **规律发现**
   - 自动检测用户的睡眠模式
   - 提示异常情况

4. **社区洞察**
   - 展示不同人群的睡眠统计
   - 对比功能

## 🔧 可视化示例

运行 notebook 后，您将看到：
- 📈 4 张分布直方图
- 📊 3 张分类特征图表
- 📦 3 张箱线图（异常值检测）
- 📍 2 张散点图（关系探索）
- 🔥 热力图（相关性矩阵）

## 📝 输出示例

```
数据集概览:
- 样本: 450 个
- 特征: 12 个
- 数值特征: 8 个

关键统计:
睡眠时长 (Sleep Duration):
  - 均值: 7.2 小时
  - 中位数: 7.0 小时
  - 范围: [5.0, 9.5] 小时

强相关关系:
✓ 运动频率 ↔ 睡眠质量: 0.856 (很强正相关)
✓ 压力水平 ↔ 睡眠时长: -0.724 (较强负相关)
```

## 🐛 常见问题

**Q: 数据集下载失败？**
A: 检查网络连接，或手动从 Kaggle 下载 CSV 文件

**Q: 找不到数据文件？**
A: 确保文件名为 `Sleep_health_and_lifestyle_dataset.csv` 且在项目根目录

**Q: 缺少某些包？**
A: 运行 `pip install pandas numpy matplotlib seaborn`

**Q: Jupyter 无法启动？**
A: 运行 `pip install jupyter` 并重试

## 📚 参考资源

- Kaggle 数据集: https://www.kaggle.com/datasets/deadmau49/sleep-health-and-lifestyle-dataset
- Pandas 文档: https://pandas.pydata.org/
- Matplotlib 文档: https://matplotlib.org/
- Seaborn 文档: https://seaborn.pydata.org/

## 📄 许可证

此项目仅供学习和研究使用。

---

**最后更新**: 2026-06-07
**创建者**: GitHub Copilot
**项目**: SleepTracker 数据分析模块
