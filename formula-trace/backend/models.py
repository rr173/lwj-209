from sqlalchemy import String, Float, Integer, Date, ForeignKey, UniqueConstraint, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base
from datetime import date


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

    product_line = relationship("ProductLine", back_populates="versions")
    parent = relationship("FormulaVersion", remote_side=[id], back_populates="children")
    children = relationship("FormulaVersion", back_populates="parent")
    batches = relationship("Batch", back_populates="version", cascade="all, delete-orphan")


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
