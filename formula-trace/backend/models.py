from sqlalchemy import String, Float, Integer, Date, ForeignKey, UniqueConstraint, JSON, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base
from datetime import date, datetime


class ApprovalRecord(Base):
    __tablename__ = "approval_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    version_id: Mapped[int] = mapped_column(Integer, ForeignKey("formula_versions.id"), nullable=False)
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    operator: Mapped[str] = mapped_column(String(200), nullable=False)
    remark: Mapped[str] = mapped_column(String(1000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    version = relationship("FormulaVersion", back_populates="approval_records")


class ProductLine(Base):
    __tablename__ = "product_lines"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    target_effect: Mapped[str] = mapped_column(String(500), nullable=False)

    versions = relationship("FormulaVersion", back_populates="product_line", cascade="all, delete-orphan")
    exclusion_groups = relationship("ExclusionGroup", back_populates="product_line", cascade="all, delete-orphan")


class ExclusionGroup(Base):
    __tablename__ = "exclusion_groups"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    product_line_id: Mapped[int] = mapped_column(Integer, ForeignKey("product_lines.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    ingredients: Mapped[list] = mapped_column(JSON, nullable=False)

    product_line = relationship("ProductLine", back_populates="exclusion_groups")


class FormulaVersion(Base):
    __tablename__ = "formula_versions"
    __table_args__ = (
        UniqueConstraint("product_line_id", "version_number", name="unique_version_per_line"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    product_line_id: Mapped[int] = mapped_column(Integer, ForeignKey("product_lines.id"), nullable=False)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    parent_id: Mapped[int] = mapped_column(Integer, ForeignKey("formula_versions.id"), nullable=True)
    ingredients: Mapped[list] = mapped_column(JSON, nullable=False)
    approval_status: Mapped[str] = mapped_column(String(50), nullable=False, default="draft")

    product_line = relationship("ProductLine", back_populates="versions")
    parent = relationship("FormulaVersion", remote_side=[id], back_populates="children")
    children = relationship("FormulaVersion", back_populates="parent")
    batches = relationship("Batch", back_populates="version", cascade="all, delete-orphan")
    approval_records = relationship("ApprovalRecord", back_populates="version", cascade="all, delete-orphan")


class Batch(Base):
    __tablename__ = "batches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    version_id: Mapped[int] = mapped_column(Integer, ForeignKey("formula_versions.id"), nullable=False)
    batch_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    production_date: Mapped[date] = mapped_column(Date, nullable=False)
    production_amount: Mapped[float] = mapped_column(Float, nullable=False)
    skin_feel_score: Mapped[float] = mapped_column(Float, nullable=True)
    stability_score: Mapped[float] = mapped_column(Float, nullable=True)
    cost_per_kg: Mapped[float] = mapped_column(Float, nullable=True)

    version = relationship("FormulaVersion", back_populates="batches")

    @property
    def has_test_result(self) -> bool:
        return all(v is not None for v in [self.skin_feel_score, self.stability_score, self.cost_per_kg])

    @property
    def overall_score(self) -> float | None:
        if not self.has_test_result:
            return None
        return self.skin_feel_score * 0.4 + self.stability_score * 0.4


class SupplierQuote(Base):
    __tablename__ = "supplier_quotes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ingredient_name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    supplier_name: Mapped[str] = mapped_column(String(200), nullable=False)
    unit_price: Mapped[float] = mapped_column(Float, nullable=False)
    min_order_quantity: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    valid_from: Mapped[date] = mapped_column(Date, nullable=False)
    valid_to: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=datetime.now)

    @property
    def is_active(self) -> bool:
        today = date.today()
        return self.valid_from <= today <= self.valid_to


class IngredientTypeConfig(Base):
    __tablename__ = "ingredient_type_configs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ingredient_name: Mapped[str] = mapped_column(String(200), nullable=False, unique=True, index=True)
    ingredient_type: Mapped[str] = mapped_column(String(50), nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=datetime.now)

    @property
    def degradation_rate(self) -> float:
        rate_map = {
            "活性成分": 0.005,
            "防腐剂": 0.003,
            "基础原料": 0.001
        }
        return rate_map.get(self.ingredient_type, 0.001)


class CompatibilityRule(Base):
    __tablename__ = "compatibility_rules"
    __table_args__ = (
        UniqueConstraint("ingredient_a", "ingredient_b", name="unique_ingredient_pair"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ingredient_a: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    ingredient_b: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    compatibility_level: Mapped[str] = mapped_column(String(50), nullable=False)
    compatibility_score: Mapped[float] = mapped_column(Float, nullable=False)
    manifestation: Mapped[str] = mapped_column(String(200), nullable=False)
    notes: Mapped[str] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.now)


class IngredientInventory(Base):
    __tablename__ = "ingredient_inventories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ingredient_name: Mapped[str] = mapped_column(String(200), nullable=False, unique=True, index=True)
    current_quantity: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    safety_stock: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    storage_location: Mapped[str] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(default=datetime.now, onupdate=datetime.now)

    transactions = relationship("InventoryTransaction", back_populates="inventory", cascade="all, delete-orphan")

    @property
    def stock_status(self) -> str:
        if self.current_quantity < self.safety_stock:
            return "urgent"
        return "normal"


class InventoryTransaction(Base):
    __tablename__ = "inventory_transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    inventory_id: Mapped[int] = mapped_column(Integer, ForeignKey("ingredient_inventories.id"), nullable=False)
    transaction_type: Mapped[str] = mapped_column(String(20), nullable=False)
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    batch_number: Mapped[str] = mapped_column(String(50), nullable=True)
    remark: Mapped[str] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.now)

    inventory = relationship("IngredientInventory", back_populates="transactions")


class ReviewMeeting(Base):
    __tablename__ = "review_meetings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    review_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    judges: Mapped[list] = mapped_column(JSON, nullable=False)
    version_ids: Mapped[list] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=datetime.now)
    started_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    ended_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    scores = relationship("ReviewScore", back_populates="meeting", cascade="all, delete-orphan")
    decisions = relationship("ReviewDecision", back_populates="meeting", cascade="all, delete-orphan")


class ReviewScore(Base):
    __tablename__ = "review_scores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    meeting_id: Mapped[int] = mapped_column(Integer, ForeignKey("review_meetings.id"), nullable=False)
    version_id: Mapped[int] = mapped_column(Integer, ForeignKey("formula_versions.id"), nullable=False)
    judge_name: Mapped[str] = mapped_column(String(200), nullable=False)
    rationality_score: Mapped[float] = mapped_column(Float, nullable=False)
    cost_score: Mapped[float] = mapped_column(Float, nullable=False)
    feasibility_score: Mapped[float] = mapped_column(Float, nullable=False)
    comment: Mapped[str] = mapped_column(String(1000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.now)

    meeting = relationship("ReviewMeeting", back_populates="scores")


class ReviewDecision(Base):
    __tablename__ = "review_decisions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    meeting_id: Mapped[int] = mapped_column(Integer, ForeignKey("review_meetings.id"), nullable=False)
    version_id: Mapped[int] = mapped_column(Integer, ForeignKey("formula_versions.id"), nullable=False)
    avg_rationality: Mapped[float] = mapped_column(Float, nullable=False)
    avg_cost: Mapped[float] = mapped_column(Float, nullable=False)
    avg_feasibility: Mapped[float] = mapped_column(Float, nullable=False)
    final_score: Mapped[float] = mapped_column(Float, nullable=False)
    decision: Mapped[str] = mapped_column(String(20), nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=datetime.now)

    meeting = relationship("ReviewMeeting", back_populates="decisions")
    version = relationship("FormulaVersion")
