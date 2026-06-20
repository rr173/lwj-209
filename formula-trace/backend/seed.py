from datetime import date, timedelta, datetime
from sqlalchemy import select
from database import async_session_maker
from models import (
    ProductLine, ExclusionGroup, FormulaVersion, Batch, SupplierQuote,
    IngredientTypeConfig, CompatibilityRule, IngredientInventory,
    InventoryTransaction, Regulation, ApprovalRecord, ReviewMeeting,
    ReviewScore, ReviewDecision, ComplianceCheckRecord, IngredientSubstitution,
    IngredientEnvironmentalAttribute,
    ProcessCard, ProcessStep, ProcessExecution, StepExecution
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
            {"name": "去离子水", "percentage": 72.50},
            {"name": "甘油", "percentage": 8.00},
            {"name": "丙二醇", "percentage": 5.00},
            {"name": "烟酰胺", "percentage": 4.00},
            {"name": "透明质酸钠", "percentage": 1.00},
            {"name": "维生素C糖苷", "percentage": 3.00},
            {"name": "卡波姆", "percentage": 0.20},
            {"name": "三乙醇胺", "percentage": 0.30},
            {"name": "天然防腐剂", "percentage": 0.50},
            {"name": "香精", "percentage": 0.00},
            {"name": "熊果苷", "percentage": 2.00},
            {"name": "泛醇", "percentage": 0.50},
            {"name": "维生素E", "percentage": 1.00}
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
            {"ingredient": "天然防腐剂", "supplier": "天然原料", "price": 120.0, "moq": 10},
            {"ingredient": "维生素E", "supplier": "巴斯夫", "price": 150.0, "moq": 10},
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
            {"name": "维生素E", "type": "活性成分"},
            {"name": "防腐剂", "type": "防腐剂"},
            {"name": "天然防腐剂", "type": "防腐剂"},
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
            {"name": "天然防腐剂", "current": 0.2, "safety": 0.3, "location": "C区-活性原料柜"},
            {"name": "维生素E", "current": 0.3, "safety": 0.5, "location": "C区-活性原料柜"},
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

        sub_check = await db.execute(
            select(IngredientSubstitution).where(
                IngredientSubstitution.primary_ingredient == "烟酰胺"
            )
        )
        if not sub_check.scalar_one_or_none():
            seed_substitutions = [
                {"primary": "烟酰胺", "substitute": "熊果苷", "fitness": 85, "ratio": 0.6},
                {"primary": "烟酰胺", "substitute": "维生素C糖苷", "fitness": 72, "ratio": 1.2},
                {"primary": "烟酰胺", "substitute": "甘草酸二钾", "fitness": 60, "ratio": 0.8},
                {"primary": "维生素C糖苷", "substitute": "熊果苷", "fitness": 80, "ratio": 0.9},
                {"primary": "维生素C糖苷", "substitute": "烟酰胺", "fitness": 65, "ratio": 0.5},
                {"primary": "熊果苷", "substitute": "烟酰胺", "fitness": 78, "ratio": 1.5},
                {"primary": "熊果苷", "substitute": "甘草酸二钾", "fitness": 70, "ratio": 0.7},
                {"primary": "透明质酸钠", "substitute": "甘油", "fitness": 55, "ratio": 10.0},
                {"primary": "水杨酸", "substitute": "甘草酸二钾", "fitness": 68, "ratio": 1.0},
                {"primary": "泛醇", "substitute": "红没药醇", "fitness": 75, "ratio": 0.8},
                {"primary": "甘油", "substitute": "丙二醇", "fitness": 88, "ratio": 0.9},
                {"primary": "丙二醇", "substitute": "甘油", "fitness": 90, "ratio": 1.1},
            ]
            for s in seed_substitutions:
                sub = IngredientSubstitution(
                    primary_ingredient=s["primary"],
                    substitute_ingredient=s["substitute"],
                    fitness_score=s["fitness"],
                    suggested_ratio=s["ratio"]
                )
                db.add(sub)

        env_check = await db.execute(
            select(IngredientEnvironmentalAttribute).where(
                IngredientEnvironmentalAttribute.ingredient_name == "甘油"
            )
        )
        if not env_check.scalar_one_or_none():
            seed_environmental_attrs = [
                {"name": "去离子水", "bio": 100, "carbon": 0.01, "source": "天然", "microplastic": False},
                {"name": "甘油", "bio": 98, "carbon": 0.2, "source": "天然", "microplastic": False},
                {"name": "透明质酸钠", "bio": 95, "carbon": 0.5, "source": "天然", "microplastic": False},
                {"name": "熊果苷", "bio": 95, "carbon": 0.3, "source": "天然", "microplastic": False},
                {"name": "甘草酸二钾", "bio": 70, "carbon": 2.0, "source": "天然", "microplastic": False},
                {"name": "红没药醇", "bio": 75, "carbon": 1.8, "source": "天然", "microplastic": False},
                {"name": "天然防腐剂", "bio": 90, "carbon": 0.5, "source": "天然", "microplastic": False},
                {"name": "维生素E", "bio": 92, "carbon": 0.4, "source": "天然", "microplastic": False},
                {"name": "烟酰胺", "bio": 90, "carbon": 0.8, "source": "半合成", "microplastic": False},
                {"name": "维生素C糖苷", "bio": 75, "carbon": 2.5, "source": "半合成", "microplastic": False},
                {"name": "泛醇", "bio": 92, "carbon": 0.6, "source": "半合成", "microplastic": False},
                {"name": "丙二醇", "bio": 35, "carbon": 5.0, "source": "全合成", "microplastic": False},
                {"name": "卡波姆", "bio": 20, "carbon": 10.0, "source": "全合成", "microplastic": False},
                {"name": "三乙醇胺", "bio": 15, "carbon": 12.0, "source": "全合成", "microplastic": False},
                {"name": "水杨酸", "bio": 8, "carbon": 30.0, "source": "全合成", "microplastic": False},
                {"name": "防腐剂", "bio": 5, "carbon": 20.0, "source": "全合成", "microplastic": True},
                {"name": "香精", "bio": 3, "carbon": 25.0, "source": "全合成", "microplastic": False},
            ]
            for attr in seed_environmental_attrs:
                env_attr = IngredientEnvironmentalAttribute(
                    ingredient_name=attr["name"],
                    biodegradability_score=attr["bio"],
                    carbon_footprint=attr["carbon"],
                    source_category=attr["source"],
                    has_microplastic_risk=attr["microplastic"]
                )
                db.add(env_attr)

        pc_check = await db.execute(
            select(ProcessCard).where(ProcessCard.version_id == v2.id)
        )
        if not pc_check.scalar_one_or_none():
            card1 = ProcessCard(
                version_id=v2.id,
                name="烟酰胺路线-标准工艺卡",
                style="standard",
                description="适用于烟酰胺为主的美白精华，注重活性成分温和添加，避免高温破坏活性",
                created_by="工艺工程师-赵工",
                created_at=datetime(2025, 5, 22, 9, 0, 0),
                updated_at=datetime(2025, 5, 22, 9, 0, 0)
            )
            db.add(card1)
            await db.flush()

            steps_v2 = [
                {"order": 1, "name": "水相预混", "temp": 60, "dur": 600, "speed": 300, "tt": 3, "dt": 120, "st": 50, "photo": False,
                 "notes": "将去离子水、甘油、丙二醇加入水相锅，搅拌至完全溶解"},
                {"order": 2, "name": "增稠剂分散", "temp": 60, "dur": 900, "speed": 600, "tt": 3, "dt": 180, "st": 100, "photo": False,
                 "notes": "缓慢加入卡波姆，高速分散避免结块"},
                {"order": 3, "name": "中和调pH", "temp": 55, "dur": 300, "speed": 200, "tt": 3, "dt": 60, "st": 30, "photo": False,
                 "notes": "加入三乙醇胺中和，pH值控制在5.5-6.5"},
                {"order": 4, "name": "活性成分添加", "temp": 45, "dur": 600, "speed": 250, "tt": 2, "dt": 120, "st": 50, "photo": True,
                 "notes": "降温至45℃以下，依次加入烟酰胺、维C糖苷、熊果苷，低温避免活性损失"},
                {"order": 5, "name": "乳化均质", "temp": 45, "dur": 180, "speed": 1500, "tt": 2, "dt": 30, "st": 200, "photo": False,
                 "notes": "高速均质，确保粒径均匀"},
                {"order": 6, "name": "保温熟化", "temp": 40, "dur": 1200, "speed": 80, "tt": 3, "dt": 300, "st": 20, "photo": False,
                 "notes": "低温保温，促进体系稳定"},
                {"order": 7, "name": "后添加物加入", "temp": 35, "dur": 300, "speed": 150, "tt": 3, "dt": 60, "st": 30, "photo": True,
                 "notes": "加入透明质酸钠溶液、防腐剂、香精"},
                {"order": 8, "name": "冷却出料", "temp": 25, "dur": 600, "speed": 50, "tt": 5, "dt": 120, "st": 20, "photo": False,
                 "notes": "降温至室温后出料送检"},
            ]
            for s in steps_v2:
                db.add(ProcessStep(
                    process_card_id=card1.id,
                    step_order=s["order"],
                    name=s["name"],
                    target_temperature=s["temp"],
                    target_duration=s["dur"],
                    stirring_speed=s["speed"],
                    temperature_tolerance=s["tt"],
                    duration_tolerance=s["dt"],
                    speed_tolerance=s["st"],
                    requires_photo=s["photo"],
                    notes=s["notes"]
                ))

            card2 = ProcessCard(
                version_id=v5.id,
                name="水杨酸路线-高精密工艺卡",
                style="high_precision",
                description="适用于水杨酸去角质配方，需精确控制温度和pH，防止水杨酸结晶析出",
                created_by="工艺工程师-钱工",
                created_at=datetime(2025, 6, 12, 14, 0, 0),
                updated_at=datetime(2025, 6, 12, 14, 0, 0)
            )
            db.add(card2)
            await db.flush()

            steps_v5 = [
                {"order": 1, "name": "水相加热溶解", "temp": 75, "dur": 900, "speed": 200, "tt": 2, "dt": 120, "st": 30, "photo": False,
                 "notes": "去离子水+甘油+丙二醇加热至75℃，确保完全溶解"},
                {"order": 2, "name": "水杨酸醇溶", "temp": 50, "dur": 600, "speed": 400, "tt": 2, "dt": 60, "st": 50, "photo": True,
                 "notes": "水杨酸先用少量丙二醇溶解，再加入体系，必须完全溶解无颗粒"},
                {"order": 3, "name": "增稠中和", "temp": 70, "dur": 900, "speed": 500, "tt": 2, "dt": 120, "st": 80, "photo": False,
                 "notes": "加入卡波姆分散，三乙醇胺中和，pH精确控制在3.5-4.0"},
                {"order": 4, "name": "降温加活性物", "temp": 40, "dur": 900, "speed": 200, "tt": 1.5, "dt": 120, "st": 30, "photo": True,
                 "notes": "严格40℃以下加维C糖苷，防止高温降活，同时加甘草酸二钾"},
                {"order": 5, "name": "舒缓成分添加", "temp": 38, "dur": 300, "speed": 150, "tt": 2, "dt": 60, "st": 30, "photo": False,
                 "notes": "加入红没药醇，必须确保分散均匀"},
                {"order": 6, "name": "精密均质", "temp": 38, "dur": 240, "speed": 2000, "tt": 1.5, "dt": 30, "st": 200, "photo": False,
                 "notes": "高转速均质确保水杨酸不会重结晶"},
                {"order": 7, "name": "低温恒温搅拌", "temp": 32, "dur": 1800, "speed": 60, "tt": 1.5, "dt": 300, "st": 15, "photo": False,
                 "notes": "长时间低温搅拌观察是否有析晶现象"},
                {"order": 8, "name": "防腐加香出料", "temp": 28, "dur": 420, "speed": 100, "tt": 2, "dt": 60, "st": 20, "photo": True,
                 "notes": "加防腐剂香精，检测pH和粒径合格后出料"},
            ]
            for s in steps_v5:
                db.add(ProcessStep(
                    process_card_id=card2.id,
                    step_order=s["order"],
                    name=s["name"],
                    target_temperature=s["temp"],
                    target_duration=s["dur"],
                    stirring_speed=s["speed"],
                    temperature_tolerance=s["tt"],
                    duration_tolerance=s["dt"],
                    speed_tolerance=s["st"],
                    requires_photo=s["photo"],
                    notes=s["notes"]
                ))
            await db.flush()

            pc1_steps_result = await db.execute(
                select(ProcessStep).where(ProcessStep.process_card_id == card1.id).order_by(ProcessStep.step_order)
            )
            pc1_steps = pc1_steps_result.scalars().all()

            pc2_steps_result = await db.execute(
                select(ProcessStep).where(ProcessStep.process_card_id == card2.id).order_by(ProcessStep.step_order)
            )
            pc2_steps = pc2_steps_result.scalars().all()

            exec1 = ProcessExecution(
                batch_id=b1.id,
                process_card_id=card1.id,
                operator="操作员-小王",
                status="completed",
                consistency_score=96.5,
                total_deviation_count=0,
                started_at=datetime(2025, 6, 1, 8, 30, 0),
                completed_at=datetime(2025, 6, 1, 10, 15, 0),
                was_interrupted=False,
                created_at=datetime(2025, 6, 1, 8, 0, 0)
            )
            db.add(exec1)
            await db.flush()

            exec1_data = [
                {"start": datetime(2025,6,1,8,30,0), "end": datetime(2025,6,1,8,40,0),
                 "temp": 60.5, "dur": 600, "speed": 300, "dev": False, "deduct": 0, "details": None},
                {"start": datetime(2025,6,1,8,40,0), "end": datetime(2025,6,1,8,55,0),
                 "temp": 61, "dur": 900, "speed": 620, "dev": False, "deduct": 0, "details": None},
                {"start": datetime(2025,6,1,8,55,0), "end": datetime(2025,6,1,9,0,0),
                 "temp": 54, "dur": 300, "speed": 200, "dev": False, "deduct": 0, "details": None},
                {"start": datetime(2025,6,1,9,0,0), "end": datetime(2025,6,1,9,10,0),
                 "temp": 44, "dur": 600, "speed": 260, "dev": False, "deduct": 0, "details": None,
                 "photo": "https://example.com/photos/b1-s4.jpg", "remark": "活性物添加顺序正确"},
                {"start": datetime(2025,6,1,9,10,0), "end": datetime(2025,6,1,9,13,0),
                 "temp": 44.5, "dur": 180, "speed": 1480, "dev": False, "deduct": 0, "details": None},
                {"start": datetime(2025,6,1,9,13,0), "end": datetime(2025,6,1,9,33,0),
                 "temp": 40, "dur": 1200, "speed": 80, "dev": False, "deduct": 0, "details": None},
                {"start": datetime(2025,6,1,9,33,0), "end": datetime(2025,6,1,9,38,0),
                 "temp": 35, "dur": 300, "speed": 150, "dev": False, "deduct": 0, "details": None,
                 "photo": "https://example.com/photos/b1-s7.jpg", "remark": "透明质酸钠完全溶解"},
                {"start": datetime(2025,6,1,9,38,0), "end": datetime(2025,6,1,10,15,0),
                 "temp": 25, "dur": 600, "speed": 52, "dev": False, "deduct": 0, "details": None},
            ]
            for i, step in enumerate(pc1_steps):
                d = exec1_data[i]
                db.add(StepExecution(
                    execution_id=exec1.id,
                    process_step_id=step.id,
                    step_order=step.step_order,
                    status="completed",
                    actual_temperature=d["temp"],
                    actual_duration=d["dur"],
                    actual_stirring_speed=d["speed"],
                    start_time=d["start"],
                    end_time=d["end"],
                    photo_url=d.get("photo"),
                    remark=d.get("remark"),
                    has_deviation=d["dev"],
                    deviation_details=d["details"],
                    deviation_deduction=d["deduct"],
                    completed_by="操作员-小王"
                ))

            exec2 = ProcessExecution(
                batch_id=b2.id,
                process_card_id=card1.id,
                operator="操作员-小李",
                status="completed",
                consistency_score=89.2,
                total_deviation_count=0,
                started_at=datetime(2025, 6, 10, 9, 0, 0),
                completed_at=datetime(2025, 6, 10, 11, 10, 0),
                interrupted_at=datetime(2025, 6, 10, 9, 35, 0),
                interruption_reason="车间临时停电，等待供电恢复",
                resumed_at=datetime(2025, 6, 10, 10, 15, 0),
                was_interrupted=True,
                created_at=datetime(2025, 6, 10, 8, 30, 0)
            )
            db.add(exec2)
            await db.flush()

            exec2_data = [
                {"start": datetime(2025,6,10,9,0,0), "end": datetime(2025,6,10,9,10,0),
                 "temp": 60, "dur": 600, "speed": 310, "dev": False, "deduct": 0, "details": None},
                {"start": datetime(2025,6,10,9,10,0), "end": None,
                 "temp": None, "dur": None, "speed": None, "dev": False, "deduct": 0, "details": None,
                 "interrupted": datetime(2025,6,10,9,35,0), "resumed": datetime(2025,6,10,10,15,0)},
                {"start": None, "end": None,
                 "temp": None, "dur": None, "speed": None, "dev": False, "deduct": 0, "details": None},
                {"start": None, "end": None,
                 "temp": None, "dur": None, "speed": None, "dev": False, "deduct": 0, "details": None},
                {"start": None, "end": None,
                 "temp": None, "dur": None, "speed": None, "dev": False, "deduct": 0, "details": None},
                {"start": None, "end": None,
                 "temp": None, "dur": None, "speed": None, "dev": False, "deduct": 0, "details": None},
                {"start": None, "end": None,
                 "temp": None, "dur": None, "speed": None, "dev": False, "deduct": 0, "details": None},
                {"start": None, "end": None,
                 "temp": None, "dur": None, "speed": None, "dev": False, "deduct": 0, "details": None},
            ]

            exec2_full = [
                {"start": datetime(2025,6,10,9,0,0), "end": datetime(2025,6,10,9,10,0),
                 "temp": 60, "dur": 600, "speed": 310, "dev": False, "deduct": 0, "details": None},
                {"start": datetime(2025,6,10,9,10,0), "end": datetime(2025,6,10,10,32,0),
                 "temp": 59, "dur": 1020, "speed": 580, "dev": False, "deduct": 0, "details": None,
                 "interrupted": datetime(2025,6,10,9,35,0), "resumed": datetime(2025,6,10,10,15,0),
                 "remark": "中途停电40分钟，已延长搅拌时间补够"},
                {"start": datetime(2025,6,10,10,32,0), "end": datetime(2025,6,10,10,37,0),
                 "temp": 56, "dur": 300, "speed": 190, "dev": False, "deduct": 0, "details": None},
                {"start": datetime(2025,6,10,10,37,0), "end": datetime(2025,6,10,10,47,0),
                 "temp": 44, "dur": 600, "speed": 240, "dev": False, "deduct": 0, "details": None,
                 "photo": "https://example.com/photos/b2-s4.jpg", "remark": "停电后重新测温，合格"},
                {"start": datetime(2025,6,10,10,47,0), "end": datetime(2025,6,10,10,50,0),
                 "temp": 44, "dur": 180, "speed": 1500, "dev": False, "deduct": 0, "details": None},
                {"start": datetime(2025,6,10,10,50,0), "end": datetime(2025,6,10,11,10,0),
                 "temp": 40, "dur": 1200, "speed": 80, "dev": False, "deduct": 0, "details": None},
                {"start": datetime(2025,6,10,11,10,0), "end": datetime(2025,6,10,11,15,0),
                 "temp": 34, "dur": 300, "speed": 150, "dev": False, "deduct": 0, "details": None,
                 "photo": "https://example.com/photos/b2-s7.jpg"},
                {"start": datetime(2025,6,10,11,15,0), "end": datetime(2025,6,10,11,55,0),
                 "temp": 24, "dur": 600, "speed": 50, "dev": False, "deduct": 0, "details": None},
            ]
            for i, step in enumerate(pc1_steps):
                d = exec2_full[i]
                db.add(StepExecution(
                    execution_id=exec2.id,
                    process_step_id=step.id,
                    step_order=step.step_order,
                    status="completed",
                    actual_temperature=d["temp"],
                    actual_duration=d["dur"],
                    actual_stirring_speed=d["speed"],
                    start_time=d["start"],
                    end_time=d["end"],
                    interrupted_at=d.get("interrupted"),
                    resumed_at=d.get("resumed"),
                    photo_url=d.get("photo"),
                    remark=d.get("remark"),
                    has_deviation=d["dev"],
                    deviation_details=d["details"],
                    deviation_deduction=d["deduct"],
                    completed_by="操作员-小李"
                ))

            exec3 = ProcessExecution(
                batch_id=b3.id,
                process_card_id=card2.id,
                operator="操作员-小张",
                status="completed",
                consistency_score=74.8,
                total_deviation_count=2,
                started_at=datetime(2025, 6, 15, 8, 0, 0),
                completed_at=datetime(2025, 6, 15, 10, 30, 0),
                was_interrupted=False,
                created_at=datetime(2025, 6, 15, 7, 30, 0)
            )
            db.add(exec3)
            await db.flush()

            dev_temp = [{
                "parameter": "temperature",
                "target_value": 50,
                "actual_value": 56,
                "tolerance": 2,
                "deviation": 6,
                "deviation_percentage": 12.0
            }]
            dev_dur = [{
                "parameter": "duration",
                "target_value": 240,
                "actual_value": 180,
                "tolerance": 30,
                "deviation": 60,
                "deviation_percentage": 25.0
            }]

            exec3_data = [
                {"start": datetime(2025,6,15,8,0,0), "end": datetime(2025,6,15,8,15,0),
                 "temp": 76, "dur": 900, "speed": 210, "dev": False, "deduct": 0, "details": None},
                {"start": datetime(2025,6,15,8,15,0), "end": datetime(2025,6,15,8,25,0),
                 "temp": 56, "dur": 600, "speed": 400, "dev": True, "deduct": 6.0, "details": dev_temp,
                 "photo": "https://example.com/photos/b3-s2.jpg",
                 "remark": "温度偏高，观察到少量颗粒，延长搅拌后溶解"},
                {"start": datetime(2025,6,15,8,25,0), "end": datetime(2025,6,15,8,40,0),
                 "temp": 70, "dur": 900, "speed": 520, "dev": False, "deduct": 0, "details": None,
                 "remark": "pH值3.8，在合格范围"},
                {"start": datetime(2025,6,15,8,40,0), "end": datetime(2025,6,15,8,55,0),
                 "temp": 40, "dur": 900, "speed": 200, "dev": False, "deduct": 0, "details": None,
                 "photo": "https://example.com/photos/b3-s4.jpg", "remark": "温度准确，维C添加顺利"},
                {"start": datetime(2025,6,15,8,55,0), "end": datetime(2025,6,15,9,0,0),
                 "temp": 38, "dur": 300, "speed": 150, "dev": False, "deduct": 0, "details": None},
                {"start": datetime(2025,6,15,9,0,0), "end": datetime(2025,6,15,9,3,0),
                 "temp": 38, "dur": 180, "speed": 2000, "dev": True, "deduct": 12.5, "details": dev_dur,
                 "remark": "均质时间不足，担心温度升高提前停止"},
                {"start": datetime(2025,6,15,9,3,0), "end": datetime(2025,6,15,9,33,0),
                 "temp": 32, "dur": 1800, "speed": 60, "dev": False, "deduct": 0, "details": None,
                 "remark": "延长保温补偿均质不足"},
                {"start": datetime(2025,6,15,9,33,0), "end": datetime(2025,6,15,10,30,0),
                 "temp": 28, "dur": 420, "speed": 100, "dev": False, "deduct": 0, "details": None,
                 "photo": "https://example.com/photos/b3-s8.jpg", "remark": "出料检测合格，但粒径略大"},
            ]
            for i, step in enumerate(pc2_steps):
                d = exec3_data[i]
                db.add(StepExecution(
                    execution_id=exec3.id,
                    process_step_id=step.id,
                    step_order=step.step_order,
                    status="completed",
                    actual_temperature=d["temp"],
                    actual_duration=d["dur"],
                    actual_stirring_speed=d["speed"],
                    start_time=d["start"],
                    end_time=d["end"],
                    photo_url=d.get("photo"),
                    remark=d.get("remark"),
                    has_deviation=d["dev"],
                    deviation_details=d["details"],
                    deviation_deduction=d["deduct"],
                    completed_by="操作员-小张"
                ))

        await db.commit()
