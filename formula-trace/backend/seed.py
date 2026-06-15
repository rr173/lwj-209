from datetime import date
from sqlalchemy import select
from database import async_session_maker
from models import ProductLine, ExclusionGroup, FormulaVersion, Batch


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
            ingredients=v1_ingredients
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
            ingredients=v2_ingredients
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
            ingredients=v3_ingredients
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
            ingredients=v4_ingredients
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
            ingredients=v5_ingredients
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

        await db.commit()
