from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_
from database import get_db
from models import Regulation, FormulaVersion, ComplianceCheckRecord
from schemas import (
    RegulationCreate, RegulationUpdate, RegulationResponse,
    RegulationBatchImportResult, ComplianceReportResponse,
    ComplianceCheckItem, MultiMarketCompareResponse, MultiMarketCompareItem,
    ComplianceCheckRequest, MultiMarketCompareRequest, ExportPdfRequest
)
from datetime import datetime
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.units import cm

router = APIRouter(prefix="/api/regulations", tags=["regulations"])

MARKET_OPTIONS = ["中国", "欧盟", "美国", "日本", "韩国"]
CATEGORY_OPTIONS = ["眼部", "唇部", "面部", "全身", "防晒", "染发", "烫发"]
CATEGORY_FALLBACK_ORDER = ["眼部", "唇部", "面部", "防晒", "染发", "烫发", "全身"]

STATUS_COMPLIANT = "合规"
STATUS_OVER_LIMIT = "超限"
STATUS_BANNED = "禁用"
STATUS_UNLISTED = "未收录"


@router.get("/markets", response_model=list[str])
async def get_available_markets():
    return MARKET_OPTIONS


@router.get("/categories", response_model=list[str])
async def get_available_categories():
    return CATEGORY_OPTIONS


@router.get("", response_model=list[RegulationResponse])
async def list_regulations(
    target_market: str | None = Query(None, description="目标市场"),
    ingredient_name: str | None = Query(None, description="成分名称（模糊搜索）"),
    product_category: str | None = Query(None, description="适用品类"),
    db: AsyncSession = Depends(get_db)
):
    query = select(Regulation)
    conditions = []

    if target_market:
        conditions.append(Regulation.target_market == target_market)
    if ingredient_name:
        conditions.append(Regulation.ingredient_name.like(f"%{ingredient_name}%"))
    if product_category:
        conditions.append(Regulation.product_category == product_category)

    if conditions:
        query = query.where(and_(*conditions))

    query = query.order_by(Regulation.target_market, Regulation.ingredient_name)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=RegulationResponse, status_code=201)
async def create_regulation(data: RegulationCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(
        select(Regulation).where(
            Regulation.target_market == data.target_market,
            Regulation.ingredient_name == data.ingredient_name,
            Regulation.product_category == data.product_category
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail=f"该市场下{data.ingredient_name}在{data.product_category}品类已有法规条目"
        )

    regulation = Regulation(**data.model_dump())
    db.add(regulation)
    await db.commit()
    await db.refresh(regulation)
    return regulation


@router.get("/{regulation_id}", response_model=RegulationResponse)
async def get_regulation(regulation_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Regulation).where(Regulation.id == regulation_id))
    regulation = result.scalar_one_or_none()
    if not regulation:
        raise HTTPException(status_code=404, detail="法规条目不存在")
    return regulation


@router.put("/{regulation_id}", response_model=RegulationResponse)
async def update_regulation(
    regulation_id: int,
    data: RegulationUpdate,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Regulation).where(Regulation.id == regulation_id))
    regulation = result.scalar_one_or_none()
    if not regulation:
        raise HTTPException(status_code=404, detail="法规条目不存在")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(regulation, key, value)

    await db.commit()
    await db.refresh(regulation)
    return regulation


@router.delete("/{regulation_id}", status_code=204)
async def delete_regulation(regulation_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Regulation).where(Regulation.id == regulation_id))
    regulation = result.scalar_one_or_none()
    if not regulation:
        raise HTTPException(status_code=404, detail="法规条目不存在")

    await db.delete(regulation)
    await db.commit()


@router.post("/batch-import", response_model=RegulationBatchImportResult)
async def batch_import_regulations(
    items: list[RegulationCreate],
    db: AsyncSession = Depends(get_db)
):
    if len(items) > 100:
        raise HTTPException(status_code=400, detail="批量导入最多100条")

    success_count = 0
    skipped_count = 0

    for item in items:
        existing = await db.execute(
            select(Regulation).where(
                Regulation.target_market == item.target_market,
                Regulation.ingredient_name == item.ingredient_name,
                Regulation.product_category == item.product_category
            )
        )
        if existing.scalar_one_or_none():
            skipped_count += 1
            continue

        regulation = Regulation(**item.model_dump())
        db.add(regulation)
        success_count += 1

    await db.commit()

    return RegulationBatchImportResult(
        success_count=success_count,
        skipped_count=skipped_count,
        total_count=len(items)
    )


def _find_best_regulation(
    ingredient_name: str,
    regulations_map: dict[tuple[str, str], Regulation],
    product_category: str
) -> Regulation | None:
    key_specific = (ingredient_name, product_category)
    if key_specific in regulations_map:
        return regulations_map[key_specific]

    if product_category != "全身":
        key_general = (ingredient_name, "全身")
        if key_general in regulations_map:
            return regulations_map[key_general]

    for cat in CATEGORY_FALLBACK_ORDER:
        key = (ingredient_name, cat)
        if key in regulations_map:
            return regulations_map[key]

    return None


def _check_ingredient_compliance(
    ingredient: dict,
    regulations_map: dict[tuple[str, str], Regulation],
    product_category: str
) -> ComplianceCheckItem:
    name = ingredient["name"]
    percentage = ingredient["percentage"]

    reg = _find_best_regulation(name, regulations_map, product_category)

    if reg is None:
        return ComplianceCheckItem(
            ingredient_name=name,
            percentage=percentage,
            status=STATUS_UNLISTED,
            max_percentage=None,
            is_banned=None,
            product_category=None,
            matched_regulation_category=None,
            notes="未收录,需人工确认",
            regulation_reference=None
        )

    if reg.is_banned:
        return ComplianceCheckItem(
            ingredient_name=name,
            percentage=percentage,
            status=STATUS_BANNED,
            max_percentage=reg.max_percentage,
            is_banned=True,
            product_category=reg.product_category,
            matched_regulation_category=reg.product_category,
            notes=reg.notes,
            regulation_reference=reg.regulation_reference
        )

    if reg.max_percentage is not None and percentage > reg.max_percentage:
        return ComplianceCheckItem(
            ingredient_name=name,
            percentage=percentage,
            status=STATUS_OVER_LIMIT,
            max_percentage=reg.max_percentage,
            is_banned=False,
            product_category=reg.product_category,
            matched_regulation_category=reg.product_category,
            notes=reg.notes,
            regulation_reference=reg.regulation_reference
        )

    return ComplianceCheckItem(
        ingredient_name=name,
        percentage=percentage,
        status=STATUS_COMPLIANT,
        max_percentage=reg.max_percentage,
        is_banned=False,
        product_category=reg.product_category,
        matched_regulation_category=reg.product_category,
        notes=reg.notes,
        regulation_reference=reg.regulation_reference
    )


async def _get_version(db: AsyncSession, version_id: int) -> FormulaVersion:
    result = await db.execute(select(FormulaVersion).where(FormulaVersion.id == version_id))
    version = result.scalar_one_or_none()
    if not version:
        raise HTTPException(status_code=404, detail="版本不存在")
    return version


async def _get_regulations_map(db: AsyncSession, target_market: str) -> dict[tuple[str, str], Regulation]:
    result = await db.execute(
        select(Regulation).where(Regulation.target_market == target_market)
    )
    regulations = result.scalars().all()
    return {(r.ingredient_name, r.product_category): r for r in regulations}


@router.post("/check-compliance", response_model=ComplianceReportResponse)
async def check_compliance(
    data: ComplianceCheckRequest,
    db: AsyncSession = Depends(get_db)
):
    version = await _get_version(db, data.version_id)
    regulations_map = await _get_regulations_map(db, data.target_market)

    items = []
    for ing in version.ingredients:
        item = _check_ingredient_compliance(ing, regulations_map, data.product_category)
        items.append(item)

    compliant_count = sum(1 for item in items if item.status == STATUS_COMPLIANT)
    over_limit_count = sum(1 for item in items if item.status == STATUS_OVER_LIMIT)
    banned_count = sum(1 for item in items if item.status == STATUS_BANNED)
    unlisted_count = sum(1 for item in items if item.status == STATUS_UNLISTED)
    total = len(items)
    compliance_rate = round((compliant_count / total) * 100, 2) if total > 0 else 0.0

    if banned_count > 0:
        overall_conclusion = "存在禁用成分"
    elif over_limit_count > 0:
        overall_conclusion = "存在超限"
    else:
        overall_conclusion = "全部合规"

    check_record = ComplianceCheckRecord(
        version_id=version.id,
        target_market=data.target_market,
        product_category=data.product_category,
        overall_conclusion=overall_conclusion,
        compliance_rate=compliance_rate,
    )
    db.add(check_record)
    await db.commit()

    return ComplianceReportResponse(
        version_id=version.id,
        version_number=version.version_number,
        target_market=data.target_market,
        overall_conclusion=overall_conclusion,
        compliance_rate=compliance_rate,
        total_ingredients=total,
        compliant_count=compliant_count,
        over_limit_count=over_limit_count,
        banned_count=banned_count,
        unlisted_count=unlisted_count,
        items=items
    )


@router.post("/multi-market-compare", response_model=MultiMarketCompareResponse)
async def multi_market_compare(
    data: MultiMarketCompareRequest,
    db: AsyncSession = Depends(get_db)
):
    version = await _get_version(db, data.version_id)

    regulations_maps = {}
    for market in data.target_markets:
        regulations_maps[market] = await _get_regulations_map(db, market)

    items = []
    inconsistent_ingredients = []

    for ing in version.ingredients:
        market_statuses = {}
        for market in data.target_markets:
            item = _check_ingredient_compliance(ing, regulations_maps[market], data.product_category)
            market_statuses[market] = item.status

        status_values = list(market_statuses.values())
        has_inconsistency = len(set(status_values)) > 1

        if has_inconsistency:
            inconsistent_ingredients.append(ing["name"])

        items.append(MultiMarketCompareItem(
            ingredient_name=ing["name"],
            percentage=ing["percentage"],
            market_statuses=market_statuses,
            has_inconsistency=has_inconsistency
        ))

    return MultiMarketCompareResponse(
        version_id=version.id,
        version_number=version.version_number,
        target_markets=data.target_markets,
        items=items,
        inconsistent_ingredients=inconsistent_ingredients
    )


def _get_status_color(status: str) -> colors.Color:
    color_map = {
        STATUS_COMPLIANT: colors.HexColor("#52c41a"),
        STATUS_OVER_LIMIT: colors.HexColor("#f5222d"),
        STATUS_BANNED: colors.HexColor("#a8071a"),
        STATUS_UNLISTED: colors.HexColor("#faad14"),
    }
    return color_map.get(status, colors.grey)


def _generate_pdf_report(
    report: ComplianceReportResponse,
    compare_data: MultiMarketCompareResponse | None = None
) -> BytesIO:
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=2 * cm, leftMargin=2 * cm,
                            topMargin=2 * cm, bottomMargin=2 * cm)

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=20,
        textColor=colors.HexColor("#1890ff"),
        spaceAfter=20
    )
    subtitle_style = ParagraphStyle(
        'Subtitle',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=colors.HexColor("#333333"),
        spaceAfter=12
    )
    normal_style = styles['Normal']

    story = []

    story.append(Paragraph("配方合规检测报告", title_style))
    story.append(Paragraph(f"版本号: V{report.version_number}", subtitle_style))
    story.append(Paragraph(f"检测日期: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", normal_style))
    story.append(Spacer(1, 0.5 * cm))

    conclusion_color = _get_status_color(report.overall_conclusion.replace("存在", "").replace("全部", "合规"))
    story.append(Paragraph(
        f"整体结论: <font color='{conclusion_color.hexval()}'><b>{report.overall_conclusion}</b></font>",
        subtitle_style
    ))

    stats_data = [
        ["合规率", f"{report.compliance_rate}%"],
        ["总成分数", str(report.total_ingredients)],
        ["合规成分", str(report.compliant_count)],
        ["超限成分", str(report.over_limit_count)],
        ["禁用成分", str(report.banned_count)],
        ["未收录成分", str(report.unlisted_count)],
    ]
    stats_table = Table(stats_data, colWidths=[5 * cm, 5 * cm])
    stats_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor("#f0f5ff")),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor("#1890ff")),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#d9d9d9")),
        ('ROWBACKGROUNDS', (1, 0), (-1, -1), [colors.white, colors.HexColor("#fafafa")]),
    ]))
    story.append(stats_table)
    story.append(Spacer(1, 1 * cm))

    story.append(Paragraph(f"目标市场: {report.target_market}", subtitle_style))
    story.append(Spacer(1, 0.3 * cm))

    table_data = [
        ["成分名称", "实际含量", "限用上限", "状态", "匹配品类", "备注"]
    ]

    for item in report.items:
        status_color = _get_status_color(item.status)
        max_pct = f"{item.max_percentage}%" if item.max_percentage is not None else "-"
        notes = item.notes or "-"
        if item.status == STATUS_OVER_LIMIT:
            notes = f"实际值 {item.percentage}% vs 限值 {item.max_percentage}%"
        matched_cat = item.matched_regulation_category or "-"

        table_data.append([
            item.ingredient_name,
            f"{item.percentage}%",
            max_pct,
            item.status,
            matched_cat,
            notes
        ])

    detail_table = Table(table_data, colWidths=[3.5 * cm, 2 * cm, 2 * cm, 2 * cm, 2 * cm, 5.5 * cm])
    table_style = [
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1890ff")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#d9d9d9")),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('TEXTCOLOR', (0, 1), (-1, -1), colors.HexColor("#333333")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#fafafa")]),
    ]

    for i, item in enumerate(report.items, start=1):
        status_color = _get_status_color(item.status)
        table_style.append(('TEXTCOLOR', (3, i), (3, i), status_color))
        table_style.append(('FONTNAME', (3, i), (3, i), 'Helvetica-Bold'))

    detail_table.setStyle(TableStyle(table_style))
    story.append(detail_table)

    if compare_data and len(compare_data.target_markets) > 1:
        story.append(PageBreak())
        story.append(Paragraph("多市场对比矩阵", title_style))
        story.append(Spacer(1, 0.5 * cm))

        matrix_header = ["成分名称", "实际含量"] + compare_data.target_markets
        matrix_data = [matrix_header]

        for item in compare_data.items:
            row = [
                item.ingredient_name,
                f"{item.percentage}%"
            ]
            for market in compare_data.target_markets:
                status = item.market_statuses[market]
                row.append(status)
            matrix_data.append(row)

        col_widths = [4 * cm, 2.5 * cm] + [3 * cm] * len(compare_data.target_markets)
        matrix_table = Table(matrix_data, colWidths=col_widths)

        matrix_style = [
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#722ed1")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#d9d9d9")),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#fafafa")]),
        ]

        for row_idx, item in enumerate(compare_data.items, start=1):
            if item.has_inconsistency:
                matrix_style.append(('BACKGROUND', (0, row_idx), (-1, row_idx),
                                   colors.HexColor("#fffbe6")))
            for col_idx, market in enumerate(compare_data.target_markets, start=2):
                status = item.market_statuses[market]
                status_color = _get_status_color(status)
                matrix_style.append(('TEXTCOLOR', (col_idx, row_idx), (col_idx, row_idx), status_color))
                matrix_style.append(('FONTNAME', (col_idx, row_idx), (col_idx, row_idx), 'Helvetica-Bold'))

        matrix_table.setStyle(TableStyle(matrix_style))
        story.append(matrix_table)

        if compare_data.inconsistent_ingredients:
            story.append(Spacer(1, 0.5 * cm))
            story.append(Paragraph(
                f"<b>不一致成分:</b> {', '.join(compare_data.inconsistent_ingredients)}",
                normal_style
            ))

    doc.build(story)
    buffer.seek(0)
    return buffer


@router.post("/export-pdf")
async def export_compliance_pdf(
    data: ExportPdfRequest,
    db: AsyncSession = Depends(get_db)
):
    primary_market = data.target_markets[0]

    check_req = ComplianceCheckRequest(
        version_id=data.version_id,
        target_market=primary_market,
        product_category=data.product_category
    )
    report = await check_compliance(check_req, db)

    compare_data = None
    if len(data.target_markets) >= 2:
        compare_req = MultiMarketCompareRequest(
            version_id=data.version_id,
            target_markets=data.target_markets,
            product_category=data.product_category
        )
        compare_data = await multi_market_compare(compare_req, db)

    pdf_buffer = _generate_pdf_report(report, compare_data)
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    filename_ascii = f"ComplianceReport_V{report.version_number}_{timestamp}.pdf"

    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={filename_ascii}"
        }
    )
