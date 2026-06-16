from datetime import date, timedelta
from sqlalchemy import select
from database import async_session_maker
from models import ProductLine, ExclusionGroup, FormulaVersion, Batch, SupplierQuote, IngredientTypeConfig, CompatibilityRule


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
            approval_status="published"
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
            approval_status="published"
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
            approval_status="published"
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
            approval_status="pending"
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
            approval_status="published"
        )
        db.add(v5)
        await db.flush()

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

        await db.commit()
