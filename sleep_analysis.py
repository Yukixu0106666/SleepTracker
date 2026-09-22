#!/usr/bin/env python3
"""
Sleep Health and Lifestyle Dataset Analysis
深度数据分析脚本 - 无需 Jupyter 可独立运行
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import os
import subprocess
import zipfile
import warnings

from sleep_model_comparison import compare_models

warnings.filterwarnings('ignore')

# 设置样式
sns.set_style("whitegrid")
plt.rcParams['figure.figsize'] = (12, 6)

def download_dataset():
    """尝试下载 Kaggle 数据集"""
    data_path = 'Sleep_health_and_lifestyle_dataset.csv'
    
    if os.path.exists(data_path):
        print(f"✅ 数据文件已存在: {data_path}")
        return data_path
    
    print("📥 正在下载数据集...")
    try:
        # 尝试使用 Kaggle API
        result = subprocess.run(
            ['kaggle', 'datasets', 'download', '-d', 'deadmau49/sleep-health-and-lifestyle-dataset', '-p', '.'],
            capture_output=True, 
            text=True, 
            timeout=60
        )
        
        # 解压文件
        zip_file = 'sleep-health-and-lifestyle-dataset.zip'
        if os.path.exists(zip_file):
            print("📦 正在解压文件...")
            with zipfile.ZipFile(zip_file, 'r') as zip_ref:
                zip_ref.extractall('.')
            os.remove(zip_file)
            print("✅ 数据集下载并解压成功！")
            return data_path
    except Exception as e:
        print(f"⚠️ Kaggle API 下载失败: {e}")
    
    print("\n❌ 无法自动下载，请手动下载：")
    print("   1. 访问: https://www.kaggle.com/datasets/deadmau49/sleep-health-and-lifestyle-dataset")
    print("   2. 下载 CSV 文件到项目目录")
    print("   3. 重新运行此脚本")
    return None

def load_and_explore_data(df):
    """加载并探索数据"""
    print("\n" + "="*80)
    print("🔍 数据集基本信息")
    print("="*80)
    
    print(f"\n📊 数据形状: {df.shape[0]} 行 × {df.shape[1]} 列")
    print(f"\n📋 列名和数据类型：")
    print(df.info())
    
    print(f"\n🔢 前 5 行数据：")
    print(df.head())
    
    return df.columns.tolist()

def clean_data(df):
    """数据清理"""
    print("\n" + "="*80)
    print("🧹 数据清理")
    print("="*80)
    
    # 缺失值检查
    missing = df.isnull().sum()
    if missing.sum() == 0:
        print("\n✅ 无缺失值")
    else:
        print("\n⚠️ 缺失值统计：")
        print(missing[missing > 0])
    
    # 重复值检查
    duplicates = df.duplicated().sum()
    if duplicates > 0:
        print(f"\n⚠️ 发现 {duplicates} 条重复记录，正在删除...")
        df = df.drop_duplicates()
        print(f"✅ 删除后剩余 {len(df)} 条记录")
    else:
        print("\n✅ 无重复值")
    
    return df

def descriptive_statistics(df):
    """基础统计分析"""
    print("\n" + "="*80)
    print("📊 基础统计分析")
    print("="*80)
    
    numeric_df = df.select_dtypes(include=[np.number])
    
    print("\n数值列统计摘要：")
    print(numeric_df.describe().round(2))
    
    print("\n逐列详细统计：")
    for col in numeric_df.columns:
        print(f"\n📌 {col}:")
        print(f"   均值: {numeric_df[col].mean():.2f}")
        print(f"   中位数: {numeric_df[col].median():.2f}")
        print(f"   标准差: {numeric_df[col].std():.2f}")
        print(f"   最小值: {numeric_df[col].min():.2f}")
        print(f"   最大值: {numeric_df[col].max():.2f}")
    
    return numeric_df

def visualize_data(df, numeric_cols):
    """可视化分析"""
    print("\n" + "="*80)
    print("📈 生成可视化图表...")
    print("="*80)
    
    # 1. 直方图
    if len(numeric_cols) > 0:
        fig, axes = plt.subplots(2, 2, figsize=(14, 10))
        fig.suptitle('分值特征分布分析', fontsize=16, fontweight='bold')
        axes = axes.flatten()
        
        for idx, col in enumerate(numeric_cols[:4]):
            if col in df.columns:
                axes[idx].hist(df[col].dropna(), bins=30, color='skyblue', edgecolor='black', alpha=0.7)
                axes[idx].set_title(f'{col} 分布', fontweight='bold')
                axes[idx].set_xlabel(col)
                axes[idx].set_ylabel('频数')
                axes[idx].grid(axis='y', alpha=0.3)
        
        plt.tight_layout()
        plt.savefig('01_distribution_histograms.png', dpi=300, bbox_inches='tight')
        print("✅ 已保存: 01_distribution_histograms.png")
        plt.close()
    
    # 2. 箱线图
    if len(numeric_cols) > 0:
        fig, axes = plt.subplots(1, min(3, len(numeric_cols)), figsize=(16, 5))
        if len(numeric_cols) == 1:
            axes = [axes]
        
        fig.suptitle('箱线图分析（异常值检测）', fontsize=16, fontweight='bold')
        
        for idx, col in enumerate(numeric_cols[:3]):
            sns.boxplot(y=df[col].dropna(), ax=axes[idx], color='lightblue')
            axes[idx].set_title(f'{col} 箱线图', fontweight='bold')
            axes[idx].set_ylabel(col)
        
        plt.tight_layout()
        plt.savefig('02_boxplots.png', dpi=300, bbox_inches='tight')
        print("✅ 已保存: 02_boxplots.png")
        plt.close()
    
    # 3. 分类变量分布
    categorical_cols = df.select_dtypes(include=['object']).columns.tolist()
    if len(categorical_cols) > 0:
        fig, axes = plt.subplots(1, min(3, len(categorical_cols)), figsize=(16, 4))
        if len(categorical_cols) == 1:
            axes = [axes]
        
        fig.suptitle('分类特征分布分析', fontsize=16, fontweight='bold')
        
        for idx, col in enumerate(categorical_cols[:3]):
            value_counts = df[col].value_counts()
            axes[idx].bar(range(len(value_counts)), value_counts.values, color='coral', alpha=0.7)
            axes[idx].set_xticks(range(len(value_counts)))
            axes[idx].set_xticklabels(value_counts.index, rotation=45, ha='right')
            axes[idx].set_title(f'{col} 分布', fontweight='bold')
            axes[idx].set_ylabel('数量')
            axes[idx].grid(axis='y', alpha=0.3)
        
        plt.tight_layout()
        plt.savefig('03_categorical_distribution.png', dpi=300, bbox_inches='tight')
        print("✅ 已保存: 03_categorical_distribution.png")
        plt.close()

def correlation_analysis(numeric_df):
    """相关性分析"""
    print("\n" + "="*80)
    print("🔗 相关性分析")
    print("="*80)
    
    correlation_matrix = numeric_df.corr()
    
    print("\n相关系数矩阵：")
    print(correlation_matrix.round(3))
    
    # 找强相关关系
    print("\n💡 强相关关系（|r| > 0.5）：")
    strong_correlations = []
    for i in range(len(correlation_matrix.columns)):
        for j in range(i+1, len(correlation_matrix.columns)):
            corr_value = correlation_matrix.iloc[i, j]
            if abs(corr_value) > 0.5:
                col1 = correlation_matrix.columns[i]
                col2 = correlation_matrix.columns[j]
                strong_correlations.append((col1, col2, corr_value))
    
    if strong_correlations:
        for col1, col2, corr in sorted(strong_correlations, key=lambda x: abs(x[2]), reverse=True):
            direction = "正相关" if corr > 0 else "负相关"
            print(f"   {col1} ↔ {col2}: {corr:.3f} ({direction})")
    else:
        print("   未发现强相关关系")
    
    # 热力图
    plt.figure(figsize=(10, 8))
    sns.heatmap(correlation_matrix, annot=True, cmap='coolwarm', center=0, 
                fmt='.2f', square=True, linewidths=1, cbar_kws={"shrink": 0.8})
    plt.title('相关系数热力图', fontsize=16, fontweight='bold', pad=20)
    plt.tight_layout()
    plt.savefig('04_correlation_heatmap.png', dpi=300, bbox_inches='tight')
    print("\n✅ 已保存: 04_correlation_heatmap.png")
    plt.close()


def parse_blood_pressure(df):
    """从 Blood Pressure 提取收缩压和舒张压"""
    bp_split = df['Blood Pressure'].astype(str).str.split('/', expand=True)
    df['Systolic'] = pd.to_numeric(bp_split[0], errors='coerce')
    df['Diastolic'] = pd.to_numeric(bp_split[1], errors='coerce')
    return df


def assign_risk_category(prob_good):
    """根据预测的好睡眠概率生成风险分类"""
    if prob_good >= 0.70:
        return 'Low Risk'
    if prob_good >= 0.40:
        return 'Medium Risk'
    return 'High Risk'



def key_insights(df, numeric_df):
    """关键洞察总结"""
    print("\n" + "="*80)
    print("🎯 关键洞察和数据规律")
    print("="*80)
    
    print(f"\n📊 数据总体：")
    print(f"   • 样本数量: {len(df)} 个")
    print(f"   • 特征数量: {df.shape[1]} 个")
    print(f"   • 数值特征: {len(numeric_df.columns)} 个")
    
    # 应用建议
    print("\n" + "="*80)
    print("💡 应用到 SleepTracker App 的建议")
    print("="*80)
    print("""
✨ 功能增强建议：

1. 📊 智能睡眠建议
   - 基于年龄和职业的个性化建议
   - 根据压力水平动态调整目标

2. 😰 压力管理
   - 监测压力与睡眠的关系
   - 高压力用户的特殊提醒

3. 🏃 运动追踪
   - 关联运动频率和睡眠质量
   - 建议适度运动

4. ⚖️ 健康指标
   - 监测 BMI 对睡眠的影响
   - 提供综合健康评分

5. 📈 数据对标
   - 与同龄人对比
   - 社区睡眠统计
    """)

def main():
    """主程序"""
    print("\n" + "="*80)
    print("🛏️ Sleep Health and Lifestyle Dataset Analysis")
    print("睡眠健康与生活方式数据分析")
    print("="*80)
    
    # 1. 下载数据
    data_path = download_dataset()
    if not data_path or not os.path.exists(data_path):
        print("\n❌ 分析无法继续，请先获取数据文件")
        return
    
    # 2. 加载数据
    print(f"\n📂 加载数据文件: {data_path}")
    try:
        df = pd.read_csv(data_path)
    except Exception as e:
        print(f"❌ 无法加载数据: {e}")
        return
    
    print("✅ 数据加载成功！")
    
    # 3. 数据探索
    columns = load_and_explore_data(df)
    
    # 4. 数据清理
    df = clean_data(df)
    
    # 5. 统计分析
    numeric_df = descriptive_statistics(df)
    numeric_cols = numeric_df.columns.tolist()
    
    # 6. 可视化
    visualize_data(df, numeric_cols)
    
    # 7. 相关性分析
    correlation_analysis(numeric_df)
    
    # 8. 关键洞察
    key_insights(df, numeric_df)

    # 9. 相同分组划分下比较 Logistic Regression、RF 和 XGBoost
    compare_models(df)
    
    print("\n" + "="*80)
    print("✅ 分析完成！")
    print("="*80)
    print("\n生成的图表文件：")
    print("   • 01_distribution_histograms.png - 分布直方图")
    print("   • 02_boxplots.png - 箱线图")
    print("   • 03_categorical_distribution.png - 分类分布")
    print("   • 04_correlation_heatmap.png - 相关性热力图")
    print("\n生成的模型报告：")
    print("   • model_results/model_comparison_report.txt - 三模型交叉验证报告")
    print("\n"*2)

if __name__ == "__main__":
    main()
