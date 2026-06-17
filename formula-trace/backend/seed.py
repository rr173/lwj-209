from datetime import date, timedelta, datetime
from sqlalchemy import select
from database import async_session_maker
from models import (
    ProductLine, ExclusionGroup, FormulaVersion, Batch, SupplierQuote,
    IngredientTypeConfig, CompatibilityRule, IngredientInventory,
    InventoryTransaction, Regulation, ApprovalRecord, ReviewMeeting,
    ReviewScore, ReviewDecision, ComplianceCheckRecord
)


async def seed_database():
    async with async_session_maker() as db:
        result = await db.execute(
            select(ProductLine).where(ProductLine.name == "美白精华")
        )
        if result.scalar_one_or_none():
            return

        pl = ProductLine(name="美白精华", target_effect="美白淡斑、提亮肤色、改善暗沉")
        db.add(pl)
        await db.flush()

        eg = ExclusionGroup(
            product_line_id=pl.id,
            name="酸类与维生素类互斥",
            ingredients=["水杨酸", "烟酰胺"]
        )
        db.add(eg)

        v1_ingredients = [
            {"name": "去离子水", "percentage": 75.00},
            {"name": "甘油", "percentage": 8.00},
            {"name": "丙二醇", "percentage": 5.00},
            {"name": "烟酰胺", "percentage": 3.00},
            {"name": "透明质酸钠", "percentage": 0.50},
            {"name": "维生素C糖苷", "percentage": 2.00},
            {"name": "卡波姆", "percentage": 0.20},
            {"name": "三乙醇胺", "percentage": 0.30},
            {"name": "防腐剂", "percentage": 0.50},
            {"name": "香精", "percentage": 0.50}
        ]
        v1 = FormulaVersion(
            product_line_id=pl.id,
            version_number=1,
            parent_id=None,
            ingredients=v1_ingredients,
            approval_status="published",
            created_at=datetime(2025, 5, 1, 10, 0, 0)
        )
        db.add(v1)
        await db.flush()

        v2_ingredients = [
            {"name": "去离子水", "percentage": 73.00},
            {"name": "甘油", "percentage": 8.00},
            {"name": "丙二醇", "percentage": 5.00},
            {"name": "烟酰胺", "percentage": 5.00},
            {"name": "透明质酸钠", "percentage": 0.50},
            {"name": "维生素C糖苷", "percentage": 3.00},
            {"name": "卡波姆", "percentage": 0.20},
            {"name": "三乙醇胺", "percentage": 0.30},
            {"name": "防腐剂", "percentage": 0.50},
            {"name": "香精", "percentage": 0.50},
            {"name": "熊果苷", "percentage": 1.00}
        ]
        v2 = FormulaVersion(
            product_line_id=pl.id,
            version_number=2,
            parent_id=v1.id,
            ingredients=v2_ingredients,
            approval_status="published",
            created_at=datetime(2025, 5, 15, 14, 30, 0)
        )
        db.add(v2)
        await db.flush()

        v3_ingredients = [
            {"name": "去离子水", "percentage": 72.00},
            {"name": "甘油", "percentage": 8.00},
            {"name": "丙二醇", "percentage": 5.00},
            {"name": "烟酰胺", "percentage": 4.00},
            {"name": "透明质酸钠", "percentage": 1.00},
            {"name": "维生素C糖苷", "percentage": 3.00},
            {"name": "卡波姆", "percentage": 0.20},
            {"name": "三乙醇胺", "percentage": 0.30},
            {"name": "防腐剂", "percentage": 0.50},
            {"name": "香精", "percentage": 0.50},
            {"name": "熊果苷", "percentage": 2.00},
            {"name": "泛醇", "percentage": 0.50}
        ]
        v3 = FormulaVersion(
            product_line_id=pl.id,
            version_number=3,
            parent_id=v2.id,
            ingredients=v3_ingredients,
            approval_status="published",
            created_at=datetime(2025, 5, 25, 9, 0, 0)
        )
        db.add(v3)
        await db.flush()

        v4_ingredients = [
            {"name": "去离子水", "percentage": 74.00},
            {"name": "甘油", "percentage": 8.00},
            {"name": "丙二醇", "percentage": 5.00},
            {"name": "水杨酸", "percentage": 1.50},
            {"name": "透明质酸钠", "percentage": 0.50},
            {"name": "维生素C糖苷", "percentage": 2.00},
            {"name": "卡波姆", "percentage": 0.20},
            {"name": "三乙醇胺", "percentage": 0.30},
            {"name": "防腐剂", "percentage": 0.50},
            {"name": "香精", "percentage": 0.50},
            {"name": "甘草酸二钾", "percentage": 0.50}
        ]
        v4 = FormulaVersion(
            product_line_id=pl.id,
            version_number=4,
            parent_id=v1.id,
            ingredients=v4_ingredients,
            approval_status="pending",
            created_at=datetime(2025, 6, 1, 11, 0, 0)
        )
        db.add(v4)
        await db.flush()

        v5_ingredients = [
            {"name": "去离子水", "percentage": 73.00},
            {"name": "甘油", "percentage": 8.00},
            {"name": "丙二醇", "percentage": 5.00},
            {"name": "水杨酸", "percentage": 2.00},
            {"name": "透明质酸钠", "percentage": 0.50},
            {"name": "维生素C糖苷", "percentage": 2.00},
            {"name": "卡波姆", "percentage": 0.20},
            {"name": "三乙醇胺", "percentage": 0.30},
            {"name": "防腐剂", "percentage": 0.50},
            {"name": "香精", "percentage": 0.50},
            {"name": "甘草酸二钾", "percentage": 1.00},
            {"name": "红没药醇", "percentage": 0.50}
        ]
        v5 = FormulaVersion(
            product_line_id=pl.id,
            version_number=5,
            parent_id=v4.id,
            ingredients=v5_ingredients,
            approval_status="published",
            created_at=datetime(2025, 6, 5, 16, 0, 0)
        )
        db.add(v5)
        await db.flush()

        approval_records = [
            ApprovalRecord(version_id=v1.id, action="submit", operator="配方师-张三", remark="初始配方提交", created_at=datetime(2025, 5, 3, 9, 0, 0)),
            ApprovalRecord(version_id=v1.id, action="approve", operator="审核员-李四", remark="配方审核通过", created_at=datetime(2025, 5, 5, 14, 0, 0)),
            ApprovalRecord(version_id=v2.id, action="submit", operator="配方师-张三", remark="增加熊果苷，提升美白效果", created_at=datetime(2025, 5, 18, 10, 0, 0)),
            ApprovalRecord(version_id=v2.id, action="approve", operator="审核员-李四", remark="审核通过", created_at=datetime(2025, 5, 20, 15, 30, 0)),
            ApprovalRecord(version_id=v3.id, action="submit", operator="配方师-张三", remark="调整烟酰胺和熊果苷比例，添加泛醇舒缓", created_at=datetime(2025, 5, 28, 9, 30, 0)),
            ApprovalRecord(version_id=v3.id, action="reject", operator="审核员-李四", remark="成本偏高，建议优化", created_at=datetime(2025, 5, 29, 11, 0, 0)),
            ApprovalRecord(version_id=v3.id, action="submit", operator="配方师-张三", remark="重新调整比例，成本已优化", created_at=datetime(2025, 5, 30, 16, 0, 0)),
            ApprovalRecord(version_id=v3.id, action="approve", operator="审核员-李四", remark="审核通过", created_at=datetime(2025, 6, 2, 10, 0, 0)),
            ApprovalRecord(version_id=v4.id, action="submit", operator="配方师-王五", remark="尝试水杨酸新配方路线", created_at=datetime(2025, 6, 2, 14, 0, 0)),
            ApprovalRecord(version_id=v4.id, action="reject", operator="审核员-李四", remark="水杨酸与烟酰胺存在互斥风险，需要进一步验证", created_at=datetime(2025, 6, 3, 9, 0, 0)),
            ApprovalRecord(version_id=v5.id, action="submit", operator="配方师-王五", remark="添加红没药醇缓解刺激，已验证互斥风险可控", created_at=datetime(2025, 6, 8, 10, 0, 0)),
            ApprovalRecord(version_id=v5.id, action="approve", operator="审核员-李四", remark="审核通过，建议试产验证", created_at=datetime(2025, 6, 10, 14, 0, 0)),
        ]
        for ar in approval_records:
            db.add(ar)

        b1 = Batch(
            version_id=v2.id,
            batch_number="B0002-20250601-001",
            production_date=date(2025, 6, 1),
            production_amount=50.0,
            skin_feel_score=7.5,
            stability_score=7.0,
            cost_per_kg=120.0
        )
        db.add(b1)

        b2 = Batch(
            version_id=v3.id,
            batch_number="B0003-20250610-001",
            production_date=date(2025, 6, 10),
            production_amount=50.0,
            skin_feel_score=8.5,
            stability_score=8.0,
            cost_per_kg=135.0
        )
        db.add(b2)

        b3 = Batch(
            version_id=v5.id,
            batch_number="B0005-20250615-001",
            production_date=date(2025, 6, 15),
            production_amount=50.0,
            skin_feel_score=8.0,
            stability_score=9.0,
            cost_per_kg=115.0
        )
        db.add(b3)
        await db.flush()

        m1 = ReviewMeeting(
            title="Q2美白精华配方评审会",
            review_date=date(2025, 6, 12),
            status="completed",
            judges=["张总工", "李总监", "王经理"],
            version_ids=[v2.id, v3.id],
            started_at=datetime(2025, 6, 12, 14, 0, 0),
            ended_at=datetime(2025, 6, 12, 16, 30, 0),
            created_at=datetime(2025, 6, 10, 10, 0, 0),
        )
        db.add(m1)
        await db.flush()

        m2 = ReviewMeeting(
            title="水杨酸配方路线专项评审",
            review_date=date(2025, 6, 18),
            status="completed",
            judges=["张总工", "陈博士", "刘安全"],
            version_ids=[v5.id],
            started_at=datetime(2025, 6, 18, 10, 0, 0),
            ended_at=datetime(2025, 6, 18, 12, 0, 0),
            created_at=datetime(2025, 6, 15, 9, 0, 0),
        )
        db.add(m2)
        await db.flush()

        scores_m1 = [
            ReviewScore(meeting_id=m1.id, version_id=v2.id, judge_name="张总工", rationality_score=8.0, cost_score=7.5, feasibility_score=8.5, comment="配方合理，美白功效有保障"),
            ReviewScore(meeting_id=m1.id, version_id=v2.id, judge_name="李总监", rationality_score=7.5, cost_score=8.0, feasibility_score=8.0, comment="成本控制良好"),
            ReviewScore(meeting_id=m1.id, version_id=v2.id, judge_name="王经理", rationality_score=8.5, cost_score=7.0, feasibility_score=9.0, comment="生产可行性高"),
            ReviewScore(meeting_id=m1.id, version_id=v3.id, judge_name="张总工", rationality_score=8.5, cost_score=7.0, feasibility_score=8.0, comment="改进思路好，但成本需注意"),
            ReviewScore(meeting_id=m1.id, version_id=v3.id, judge_name="李总监", rationality_score=8.0, cost_score=6.5, feasibility_score=8.5, comment="泛醇添加是亮点"),
            ReviewScore(meeting_id=m1.id, version_id=v3.id, judge_name="王经理", rationality_score=9.0, cost_score=7.5, feasibility_score=8.5, comment="整体优于V2"),
        ]
        for s in scores_m1:
            db.add(s)

        scores_m2 = [
            ReviewScore(meeting_id=m2.id, version_id=v5.id, judge_name="张总工", rationality_score=9.0, cost_score=8.5, feasibility_score=8.0, comment="水杨酸+红没药醇组合很好"),
            ReviewScore(meeting_id=m2.id, version_id=v5.id, judge_name="陈博士", rationality_score=9.5, cost_score=8.0, feasibility_score=8.5, comment="互斥风险控制到位"),
            ReviewScore(meeting_id=m2.id, version_id=v5.id, judge_name="刘安全", rationality_score=8.5, cost_score=8.0, feasibility_score=9.0, comment="安全性有保障"),
        ]
        for s in scores_m2:
            db.add(s)
        await db.flush()

        decisions = [
            ReviewDecision(meeting_id=m1.id, version_id=v2.id, avg_rationality=8.0, avg_cost=7.5, avg_feasibility=8.5, final_score=8.0, decision="approve", created_at=datetime(2025, 6, 12, 17, 0, 0)),
            ReviewDecision(meeting_id=m1.id, version_id=v3.id, avg_rationality=8.5, avg_cost=7.0, avg_feasibility=8.3, final_score=8.0, decision="conditional", created_at=datetime(2025, 6, 12, 17, 0, 0)),
            ReviewDecision(meeting_id=m2.id, version_id=v5.id, avg_rationality=9.0, avg_cost=8.2, avg_feasibility=8.5, final_score=8.6, decision="approve", created_at=datetime(2025, 6, 18, 12, 30, 0)),
        ]
        for d in decisions:
            db.add(d)

        compliance_records = [
            ComplianceCheckRecord(version_id=v2.id, target_market="中国", product_category="面部", overall_conclusion="compliant", compliance_rate=100.0, created_at=datetime(2025, 5, 22, 10, 0, 0)),
            ComplianceCheckRecord(version_id=v3.id, target_market="中国", product_category="面部", overall_conclusion="compliant", compliance_rate=100.0, created_at=datetime(2025, 6, 3, 14, 0, 0)),
            ComplianceCheckRecord(version_id=v3.id, target_market="欧盟", product_category="面部", overall_conclusion="warning", compliance_rate=85.7, created_at=datetime(2025, 6, 5, 9, 0, 0)),
            ComplianceCheckRecord(version_id=v5.id, target_market="中国", product_category="面部", overall_conclusion="compliant", compliance_rate=100.0, created_at=datetime(2025, 6, 12, 11, 0, 0)),
        ]
        for cr in compliance_records:
            db.add(cr)

        today = date.today()
        quotes = [
            {"ingredient": "去离子水", "supplier": "水源化工", "price": 2.5, "moq": 1000},
            {"ingredient": "去离子水", "supplier": "净化水业", "price": 3.0, "moq": 500},
            {"ingredient": "甘油", "supplier": "宝洁化工", "price": 15.0, "moq": 100},
            {"ingredient": "甘油", "supplier": "油脂化工", "price": 12.5, "moq": 500},
            {"ingredient": "丙二醇", "supplier": "宝洁化工", "price": 18.0, "moq": 100},
            {"ingredient": "烟酰胺", "supplier": "帝斯曼", "price": 120.0, "moq": 25},
            {"ingredient": "烟酰胺", "supplier": "朗盛化工", "price": 95.0, "moq": 100},
            {"ingredient": "透明质酸钠", "supplier": "华熙生物", "price": 2500.0, "moq": 1},
            {"ingredient": "透明质酸钠", "supplier": "阜丰生物", "price": 1800.0, "moq": 5},
            {"ingredient": "维生素C糖苷", "supplier": "DSM", "price": 800.0, "moq": 10},
            {"ingredient": "卡波姆", "supplier": "路博润", "price": 150.0, "moq": 20},
            {"ingredient": "三乙醇胺", "supplier": "陶氏化学", "price": 28.0, "moq": 50},
            {"ingredient": "防腐剂", "supplier": "舒美化工", "price": 65.0, "moq": 25},
            {"ingredient": "香精", "supplier": "奇华顿", "price": 450.0, "moq": 5},
            {"ingredient": "熊果苷", "supplier": "DSM", "price": 320.0, "moq": 10},
            {"ingredient": "泛醇", "supplier": "巴斯夫", "price": 180.0, "moq": 15},
            {"ingredient": "水杨酸", "supplier": "默克", "price": 95.0, "moq": 20},
            {"ingredient": "甘草酸二钾", "supplier": "甘草原料", "price": 280.0, "moq": 10},
            {"ingredient": "红没药醇", "supplier": "德之馨", "price": 650.0, "moq": 5},
        ]

        for q in quotes:
            quote = SupplierQuote(
                ingredient_name=q["ingredient"],
                supplier_name=q["supplier"],
                unit_price=q["price"],
                min_order_quantity=q["moq"],
                valid_from=today - timedelta(days=30),
                valid_to=today + timedelta(days=365)
            )
            db.add(quote)

        ingredient_types = [
            {"name": "烟酰胺", "type": "活性成分"},
            {"name": "维生素C糖苷", "type": "活性成分"},
            {"name": "熊果苷", "type": "活性成分"},
            {"name": "水杨酸", "type": "活性成分"},
            {"name": "甘草酸二钾", "type": "活性成分"},
            {"name": "红没药醇", "type": "活性成分"},
            {"name": "泛醇", "type": "活性成分"},
            {"name": "透明质酸钠", "type": "活性成分"},
            {"name": "防腐剂", "type": "防腐剂"},
            {"name": "去离子水", "type": "基础原料"},
            {"name": "甘油", "type": "基础原料"},
            {"name": "丙二醇", "type": "基础原料"},
            {"name": "卡波姆", "type": "基础原料"},
            {"name": "三乙醇胺", "type": "基础原料"},
            {"name": "香精", "type": "基础原料"},
        ]
        for it in ingredient_types:
            type_config = IngredientTypeConfig(
                ingredient_name=it["name"],
                ingredient_type=it["type"]
            )
            db.add(type_config)

        compatibility_rules = [
            {
                "a": "维生素C糖苷", "b": "烟酰胺",
                "level": "轻微不相容", "score": 70,
                "manifestation": "PH值差异可能导致变色",
                "notes": "建议控制PH在5.5-6.5之间"
            },
            {
                "a": "水杨酸", "b": "烟酰胺",
                "level": "严重不相容", "score": 30,
                "manifestation": "形成烟酸导致皮肤刺激",
                "notes": "已加入互斥组，禁止同时使用"
            },
            {
                "a": "维生素C糖苷", "b": "熊果苷",
                "level": "轻微不相容", "score": 75,
                "manifestation": "抗氧化活性互相影响",
                "notes": "建议添加稳定剂"
            },
            {
                "a": "卡波姆", "b": "三乙醇胺",
                "level": "相容", "score": 100,
                "manifestation": "正常中和增稠",
                "notes": "标准搭配，无冲突"
            },
            {
                "a": "透明质酸钠", "b": "甘油",
                "level": "相容", "score": 95,
                "manifestation": "协同保湿",
                "notes": "推荐搭配使用"
            },
            {
                "a": "泛醇", "b": "透明质酸钠",
                "level": "相容", "score": 98,
                "manifestation": "协同修复",
                "notes": "推荐搭配使用"
            },
            {
                "a": "水杨酸", "b": "红没药醇",
                "level": "相容", "score": 90,
                "manifestation": "红没药醇缓解水杨酸刺激",
                "notes": "推荐搭配，降低刺激性"
            },
            {
                "a": "维生素C糖苷", "b": "透明质酸钠",
                "level": "相容", "score": 92,
                "manifestation": "透明质酸保护维C活性",
                "notes": "推荐搭配"
            },
        ]
        for cr in compatibility_rules:
            a, b = sorted([cr["a"], cr["b"]])
            rule = CompatibilityRule(
                ingredient_a=a,
                ingredient_b=b,
                compatibility_level=cr["level"],
                compatibility_score=cr["score"],
                manifestation=cr["manifestation"],
                notes=cr["notes"]
            )
            db.add(rule)

        initial_inventories = [
            {"name": "去离子水", "current": 200.0, "safety": 100.0, "location": "A区-储水罐"},
            {"name": "甘油", "current": 25.0, "safety": 20.0, "location": "B区-原料架1"},
            {"name": "丙二醇", "current": 18.0, "safety": 15.0, "location": "B区-原料架1"},
            {"name": "烟酰胺", "current": 3.5, "safety": 5.0, "location": "C区-活性原料柜"},
            {"name": "透明质酸钠", "current": 0.8, "safety": 1.0, "location": "C区-活性原料柜"},
            {"name": "维生素C糖苷", "current": 1.2, "safety": 2.0, "location": "C区-活性原料柜"},
            {"name": "卡波姆", "current": 0.5, "safety": 1.0, "location": "B区-原料架2"},
            {"name": "三乙醇胺", "current": 0.8, "safety": 1.0, "location": "B区-原料架2"},
            {"name": "防腐剂", "current": 0.3, "safety": 0.5, "location": "D区-危险品柜"},
            {"name": "香精", "current": 0.2, "safety": 0.3, "location": "D区-危险品柜"},
            {"name": "熊果苷", "current": 0.6, "safety": 1.0, "location": "C区-活性原料柜"},
            {"name": "泛醇", "current": 0.4, "safety": 0.5, "location": "C区-活性原料柜"},
            {"name": "水杨酸", "current": 0.3, "safety": 1.0, "location": "D区-危险品柜"},
            {"name": "甘草酸二钾", "current": 0.2, "safety": 0.5, "location": "C区-活性原料柜"},
            {"name": "红没药醇", "current": 0.1, "safety": 0.3, "location": "C区-活性原料柜"},
        ]

        for inv_data in initial_inventories:
            inv = IngredientInventory(
                ingredient_name=inv_data["name"],
                current_quantity=inv_data["current"],
                safety_stock=inv_data["safety"],
                storage_location=inv_data["location"],
            )
            db.add(inv)
            await db.flush()

            if inv_data["current"] > 0:
                tx = InventoryTransaction(
                    inventory_id=inv.id,
                    transaction_type="stock_in",
                    quantity=inv_data["current"],
                    remark="初始库存",
                )
                db.add(tx)

        reg_check = await db.execute(
            select(Regulation).where(Regulation.ingredient_name == "烟酰胺")
        )
        if not reg_check.scalar_one_or_none():
            seed_regulations = [
                {"market": "中国", "ingredient": "烟酰胺", "max_pct": 4.0, "banned": False, "category": "面部",
                 "ref": "GB 7916-1987 化妆品卫生标准", "notes": "面部产品最大用量4%"},
                {"market": "中国", "ingredient": "水杨酸", "max_pct": 2.0, "banned": False, "category": "全身",
                 "ref": "GB 7916-1987 化妆品卫生标准", "notes": "最大用量2%"},
                {"market": "中国", "ingredient": "熊果苷", "max_pct": 7.0, "banned": False, "category": "面部",
                 "ref": "GB 7916-1987 化妆品卫生标准", "notes": "最大用量7%"},
                {"market": "中国", "ingredient": "维生素C糖苷", "max_pct": 3.0, "banned": False, "category": "面部",
                 "ref": "GB 7916-1987 化妆品卫生标准", "notes": "最大用量3%"},
                {"market": "中国", "ingredient": "防腐剂", "max_pct": 1.0, "banned": False, "category": "全身",
                 "ref": "GB 7916-1987 化妆品卫生标准", "notes": "总防腐剂最大用量1%"},
                {"market": "中国", "ingredient": "香精", "max_pct": 1.0, "banned": False, "category": "全身",
                 "ref": "GB 7916-1987 化妆品卫生标准", "notes": "最大用量1%"},
                {"market": "中国", "ingredient": "三乙醇胺", "max_pct": 2.5, "banned": False, "category": "全身",
                 "ref": "GB 7916-1987 化妆品卫生标准", "notes": "最大用量2.5%"},
                {"market": "中国", "ingredient": "红没药醇", "max_pct": 1.0, "banned": False, "category": "全身",
                 "ref": "GB 7916-1987 化妆品卫生标准", "notes": "最大用量1%"},
                {"market": "欧盟", "ingredient": "烟酰胺", "max_pct": 5.0, "banned": False, "category": "面部",
                 "ref": "EU Cosmetics Regulation (EC) No 1223/2009", "notes": "面部产品最大用量5%"},
                {"market": "欧盟", "ingredient": "水杨酸", "max_pct": 1.5, "banned": False, "category": "全身",
                 "ref": "EU Cosmetics Regulation (EC) No 1223/2009", "notes": "最大用量1.5%"},
                {"market": "欧盟", "ingredient": "熊果苷", "max_pct": 2.0, "banned": False, "category": "面部",
                 "ref": "EU Cosmetics Regulation (EC) No 1223/2009", "notes": "最大用量2%"},
                {"market": "欧盟", "ingredient": "对苯二酚", "max_pct": None, "banned": True, "category": "全身",
                 "ref": "EU Cosmetics Regulation (EC) No 1223/2009 Annex II", "notes": "禁用成分，禁止添加"},
                {"market": "欧盟", "ingredient": "铅", "max_pct": None, "banned": True, "category": "全身",
                 "ref": "EU Cosmetics Regulation (EC) No 1223/2009 Annex II", "notes": "禁用成分，禁止添加"},
                {"market": "欧盟", "ingredient": "卡波姆", "max_pct": 5.0, "banned": False, "category": "全身",
                 "ref": "EU Cosmetics Regulation (EC) No 1223/2009", "notes": "最大用量5%"},
                {"market": "欧盟", "ingredient": "泛醇", "max_pct": 5.0, "banned": False, "category": "全身",
                 "ref": "EU Cosmetics Regulation (EC) No 1223/2009", "notes": "最大用量5%"},
                {"market": "欧盟", "ingredient": "甘草酸二钾", "max_pct": 2.0, "banned": False, "category": "全身",
                 "ref": "EU Cosmetics Regulation (EC) No 1223/2009", "notes": "最大用量2%"},
            ]

            for reg in seed_regulations:
                regulation = Regulation(
                    target_market=reg["market"],
                    ingredient_name=reg["ingredient"],
                    max_percentage=reg["max_pct"],
                    is_banned=reg["banned"],
                    product_category=reg["category"],
                    regulation_reference=reg["ref"],
                    notes=reg["notes"]
                )
                db.add(regulation)

        await db.commit()
