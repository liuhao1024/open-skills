# 财报异常检测规则

基于 `financial_analyzer.py` 的 10 项自动检测规则。

## 规则列表

| # | 规则名称 | 默认阈值 | 触发逻辑 | 严重程度 |
|---|---------|---------|---------|---------|
| 1 | 应收账款暴增 | 20% | AR增速 - 营收增速 > 20pp | >40pp 为 high，否则 medium |
| 2 | 现金流背离利润 | 50% | OCF/NI < 50% 或 OCF 为负而 NI 为正 | high/medium |
| 3 | 存货积压 | 15% | 存货增速 - 营收增速 > 15pp | medium |
| 4 | 毛利率突变 | 5pp | 毛利率环比变动 > 5pp | medium |
| 5 | 净利率突变 | 3pp | 净利率环比变动 > 3pp | medium |
| 6 | 经营现金流持续为负 | 2期 | 连续 2+ 期 OCF < 0 | >=3期为 high，否则 medium |
| 7 | 商誉占比过高 | 30% | 商誉/总资产 > 30% | medium |
| 8 | 资产负债率过高 | 70% | 总负债/总资产 > 70% | medium |
| 9 | 流动比率过低 | 1.0 | 流动资产/流动负债 < 1.0 | <0.7 为 high，否则 medium |
| 10 | 应付账款异常 | 20% | \|AP增速 - 成本增速\| > 20pp | low |

## 使用方式

```bash
# 分析 JSON 格式的财报数据
python scripts/financial_analyzer.py data.json

# 输出 JSON 格式
python scripts/financial_analyzer.py data.json --json

# 生成示例数据
python scripts/financial_analyzer.py --sample > sample.json

# 自定义阈值
python scripts/financial_analyzer.py data.json --ar-threshold 0.25 --ocf-ratio 0.4
```

## 三表联动分析

异常检测之外，还需关注三表之间的逻辑关系：

- **利润表 → 资产负债表**：收入增长是否由应收账款驱动？净利润是否转化为留存收益？
- **利润表 → 现金流量表**：净利润与经营现金流是否匹配？
- **资产负债表 → 现金流量表**：资产扩张的资金来源？投资活动是否与资本开支一致？

## 注意事项

异常信号不等于"公司有问题"，需结合行业和经营背景判断：
- 应收暴增在 To-B 企业年末可能是正常季节性波动
- 高负债率在公用事业、房地产行业属行业常态
- 短期现金流为负在高成长期企业可能合理
